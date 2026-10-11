import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import Any, Dict, List, Optional
from datetime import datetime
from ..database import get_db
from ..models import Submission, User, Assignment
from ..schemas import SubmissionCreate, SubmissionOut, Badge
from .users import get_current_user
from .assignments import is_assignment_targeted_to_user
from ..study_config import (
    SUBMISSION_SOURCE_TEACHER_REMOVED,
    feedback_mode_for,
    student_view_of_grading_result,
    visible_submission_clause,
)
from ..services import _log_interaction_event

router = APIRouter(prefix="/submissions", tags=["Submissions"])


def _coerce_grading_result(raw: Any) -> Optional[Dict[str, Any]]:
    """JSONB (dict) veya eski kayıtlardan gelen JSON string'i güvenle dict'e çevirir."""
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None
        return parsed if isinstance(parsed, dict) else None
    return None

@router.post("/", response_model=SubmissionOut)
async def create_submission(
    submission: SubmissionCreate,
    current_user: User = Depends(get_current_user)
):
    # Eski iki adımlı akışta not istemciden geliyordu (grading_result gövdede); bu,
    # öğrencinin notu kendisinin yazabilmesi demekti. Teslim artık yalnızca
    # POST /api/grade ile yapılır: teslim sunucuda oluşturulur ve değerlendirilir.
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Bu uç nokta kullanımdan kaldırıldı. Teslimler /api/grade üzerinden yapılır.",
    )


@router.get("/", response_model=List[SubmissionOut])
async def get_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # joinedload: owner (öğrenci adı) ve evaluation (Faz 3 JSONB fallback) N+1 sorgusunu önler.
    query = (
        db.query(Submission)
        .options(joinedload(Submission.owner), joinedload(Submission.evaluation))
        .join(User, Submission.user_id == User.id)
        .filter(User.organization_id == current_user.organization_id)
    )
    is_student = current_user.role not in ("teacher", "superadmin")
    if is_student:
        query = query.filter(Submission.user_id == current_user.id)
    # AI hatasıyla sonuçlanan ve öğretmence kaldırılan teslimler logda kalır ama
    # listede (ve deneme sayısında) yer almaz.
    query = query.filter(visible_submission_clause())
    feedback_mode = feedback_mode_for(current_user)

    results = query.order_by(Submission.submitted_at.desc()).all()

    output: List[SubmissionOut] = []
    for res in results:
        # Faz 3: submissions.grading_result senkronize olmadıysa evaluations tablosundaki
        # tam JSONB sonucuna düş (submission_id/evaluation ilişkisi üzerinden).
        grading_result = _coerce_grading_result(res.grading_result)
        if not grading_result and res.evaluation is not None:
            grading_result = _coerce_grading_result(res.evaluation.grading_result_json)

        if is_student:
            # grade_only koşulunda öğrenci yalnızca puanı görür (süzme sunucu tarafında).
            grading_result = student_view_of_grading_result(grading_result, feedback_mode)

        submission_out = SubmissionOut.model_validate(res)
        submission_out.grading_result = grading_result
        submission_out.student_name = res.owner.full_name if res.owner else "Öğrenci"
        output.append(submission_out)

    return output


@router.delete("/{submission_id}")
async def delete_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_submission = db.query(Submission).join(User).filter(Submission.id == submission_id, User.organization_id == current_user.organization_id).first()
    if not db_submission:
        raise HTTPException(status_code=404, detail="Teslimat bulunamadı")
    
    # Öğrenciler kendi teslimlerini silemez: silme deneme hakkını sıfırlar ve araştırma
    # verisini yok eder. Silme yetkisi yalnızca öğretmen/yöneticidedir.
    if current_user.role not in ("teacher", "superadmin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    if db_submission.session_id is not None:
        # Araştırma kaydı: evaluations/interaction_events bu teslime bağlı olduğundan
        # fiziksel silme yapılmaz. Teslim listeden ve deneme sayısından çıkarılır,
        # öğrenci yeniden gönderebilir; işlem loglanır.
        db_submission.submission_source = SUBMISSION_SOURCE_TEACHER_REMOVED
        session = db_submission.study_session
        if session is not None:
            _log_interaction_event(
                db,
                session,
                "submission_removed_by_teacher",
                submission_id=db_submission.submission_id,
                actor_type="teacher",
                actor_id=current_user.id,
                metadata={"attempt_no": db_submission.attempt_no},
            )
        db.commit()
        return {"message": "Teslimat kaldırıldı"}

    db.delete(db_submission)
    db.commit()
    return {"message": "Teslimat silindi"}
