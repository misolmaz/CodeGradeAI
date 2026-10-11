"""AI değerlendirme uç noktası ve arayüz ayarları (YAYIN 016 hazırlığı).

Öğrenci teslimi artık tek adımdır: POST /api/grade teslimi sunucuda oluşturur,
değerlendirir, kaydeder ve öğrencinin koşuluna göre süzülmüş sonucu döndürür.
Notu istemcinin bildirdiği eski iki adımlı akış (POST /submissions/) kapatılmıştır.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..badges import check_badges
from ..database import get_db
from ..models import Assignment, Submission, User
from ..schemas import Badge, GradeResponse, InteractionLogRequest, SubmissionRequest
from ..services import _log_interaction_event, _utcnow, grade_submission_with_persistence
from ..study_config import (
    SUBMISSION_SOURCE_AI_ERROR,
    feedback_mode_for,
    gamification_enabled,
    max_attempts_per_assignment,
    public_config,
    student_view_of_grading_result,
    success_grade_threshold,
    visible_submission_clause,
)
from .assignments import is_assignment_targeted_to_user
from .users import get_current_user

router = APIRouter(tags=["Grading"])


def counted_submissions_query(db: Session, user_id: int, assignment_id: int):
    """Deneme hakkından düşen teslimler: değerlendirilmiş, AI hatası olmayan ve öğretmence kaldırılmamış olanlar."""
    return db.query(Submission).filter(
        Submission.user_id == user_id,
        Submission.assignment_id == assignment_id,
        Submission.grading_result.isnot(None),
        visible_submission_clause(),
    )


def _deadline_passed(assignment: Assignment) -> bool:
    if not assignment.due_date:
        return False
    try:
        deadline = datetime.fromisoformat(assignment.due_date)
    except ValueError:
        return False
    if deadline.tzinfo:
        deadline = deadline.replace(tzinfo=None)
    return datetime.utcnow() > deadline


def _grade_of(submission: Submission) -> int:
    data = submission.grading_result
    if isinstance(data, dict):
        try:
            return int(data.get("grade") or 0)
        except (TypeError, ValueError):
            return 0
    return 0


def _validate_student_submission(db: Session, student: User, request: SubmissionRequest) -> None:
    if student.is_first_login:
        raise HTTPException(status_code=403, detail="Ödev göndermeden önce parolanızı değiştirmelisiniz.")
    if not request.assignmentId:
        raise HTTPException(status_code=400, detail="Ödev bilgisi eksik.")

    assignment = (
        db.query(Assignment)
        .filter(Assignment.id == request.assignmentId, Assignment.organization_id == student.organization_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Ödev bulunamadı")
    if not is_assignment_targeted_to_user(assignment, student):
        raise HTTPException(status_code=403, detail="Bu ödev size atanmamış.")
    if _deadline_passed(assignment):
        raise HTTPException(status_code=400, detail="Bu ödevin teslim süresi dolmuştur.")

    previous = counted_submissions_query(db, student.id, assignment.id).all()
    if len(previous) >= max_attempts_per_assignment():
        raise HTTPException(status_code=409, detail="Bu ödev için teslim hakkınız dolmuştur.")
    if any(_grade_of(s) >= success_grade_threshold() for s in previous):
        raise HTTPException(status_code=409, detail="Bu ödevi zaten başarıyla tamamladınız.")


@router.get("/api/config")
async def get_public_config():
    return public_config()


@router.post("/api/grade", response_model=GradeResponse)
async def grade_code(
    request: SubmissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kimlik doğrulaması zorunludur.

    Öğrenci: teslim kuralları (atama, süre, deneme hakkı) sunucuda denetlenir; teslim ve
    değerlendirme kaydedilir; yanıt öğrencinin koşuluna göre süzülür.
    Öğretmen/yönetici: kayıt oluşturmadan deneme değerlendirmesi (tam rapor).
    """
    is_student = current_user.role == "student"
    feedback_mode = feedback_mode_for(current_user)

    if is_student:
        _validate_student_submission(db, current_user, request)
        persist_user = current_user
    else:
        request = request.model_copy(update={"assignmentId": None})
        persist_user = None

    try:
        result, submission = await grade_submission_with_persistence(
            db, request, persist_user, feedback_mode=feedback_mode if is_student else None
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if is_student and submission is not None and submission.submission_source == SUBMISSION_SOURCE_AI_ERROR:
        # Deneme hakkından düşülmez; öğrenci tekrar gönderebilir.
        raise HTTPException(
            status_code=503,
            detail=result.feedback or "Değerlendirme şu anda yapılamadı. Lütfen birkaç dakika sonra tekrar deneyin.",
        )

    full = result.model_dump(mode="json")
    view = student_view_of_grading_result(full, feedback_mode) if is_student else dict(full)

    new_badges = []
    if is_student and submission is not None and gamification_enabled():
        new_badges = [Badge(**b) for b in check_badges(current_user.id, db, submission.id)]

    payload = dict(view)
    if submission is not None:
        payload.update(
            submissionId=submission.id,
            assignmentId=submission.assignment_id,
            userId=current_user.id,
            studentName=current_user.full_name,
            submittedAt=submission.submitted_at,
            attemptNo=submission.attempt_no,
        )
    payload["newBadges"] = new_badges
    return GradeResponse(**payload)


# Arayüz kademeleri (App.tsx scaffoldingLevel): 0 farkındalık sorusu, 1 + yönlendirici soru,
# 2 + ipucu ve sonraki adım, 3 tam rapor.
UI_LEVEL_NAMES = {0: "awareness_question", 1: "guiding_question", 2: "hint_next_action", 3: "full_report"}


@router.post("/api/interaction", status_code=204)
async def log_interaction(
    payload: InteractionLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Uygulama sadakati logu (YAYIN 016). Yalnızca öğrencinin kendi araştırma teslimleri için.

    result_viewed: sonuç ekranı açıldı (iki koşulda da). scaffold_advanced: deney koşulunda
    öğrenci bir sonraki ipucu kademesine geçti; kademe 3'e geçiş tam raporun öğrenci isteğiyle
    açılması demektir (full_report_unlocked olayı ve study_sessions.full_report_unlocked_at).
    """
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Yalnızca öğrenci etkileşimleri loglanır.")

    submission = (
        db.query(Submission)
        .filter(Submission.id == payload.submissionId, Submission.user_id == current_user.id)
        .first()
    )
    if submission is None or submission.session_id is None or submission.study_session is None:
        raise HTTPException(status_code=404, detail="Teslim bulunamadı.")
    session = submission.study_session
    feedback_mode = feedback_mode_for(current_user)
    base_meta = {"attempt_no": submission.attempt_no, "feedback_mode": feedback_mode}

    if payload.event == "result_viewed":
        _log_interaction_event(
            db, session, "result_viewed",
            submission_id=submission.submission_id, actor_type="student", actor_id=current_user.id,
            metadata={**base_meta, "ui_level": payload.uiLevel,
                      "ui_level_name": UI_LEVEL_NAMES.get(payload.uiLevel)},
        )
    else:
        if feedback_mode != "socratic":
            raise HTTPException(status_code=400, detail="Bu koşulda kademe yoktur.")
        if payload.fromLevel is None or payload.toLevel is None or payload.toLevel != payload.fromLevel + 1:
            raise HTTPException(status_code=422, detail="Geçersiz kademe geçişi.")
        _log_interaction_event(
            db, session, "scaffold_advanced",
            submission_id=submission.submission_id, actor_type="student", actor_id=current_user.id,
            metadata={**base_meta, "from_level": payload.fromLevel, "to_level": payload.toLevel,
                      "to_level_name": UI_LEVEL_NAMES[payload.toLevel]},
        )
        if payload.toLevel == 3:
            previous_status = session.session_status
            session.session_status = "FULL_REPORT_UNLOCKED"
            if session.full_report_unlocked_at is None:
                session.full_report_unlocked_at = _utcnow()
            session.updated_at = _utcnow()
            _log_interaction_event(
                db, session, "full_report_unlocked",
                submission_id=submission.submission_id, actor_type="student", actor_id=current_user.id,
                from_status=previous_status, to_status="FULL_REPORT_UNLOCKED",
                metadata={**base_meta, "unlock_reason": "student_request"},
            )

    session.last_activity_at = _utcnow()
    db.commit()
    return Response(status_code=204)
