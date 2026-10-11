"""AI değerlendirme uç noktası ve arayüz ayarları (YAYIN 016 hazırlığı).

Öğrenci teslimi artık tek adımdır: POST /api/grade teslimi sunucuda oluşturur,
değerlendirir, kaydeder ve öğrencinin koşuluna göre süzülmüş sonucu döndürür.
Notu istemcinin bildirdiği eski iki adımlı akış (POST /submissions/) kapatılmıştır.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..badges import check_badges
from ..database import get_db
from ..models import Assignment, Submission, User
from ..schemas import Badge, GradeResponse, SubmissionRequest
from ..services import grade_submission_with_persistence
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
