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
from ..badges import check_badges

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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Deadline Check
    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id, Assignment.organization_id == current_user.organization_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Ödev bulunamadı")

    # Security: enforce assignment targeting (class/specific-student) server-side.
    # Previously this was only checked in the frontend UI, so a student could call
    # this endpoint directly to submit to an assignment never assigned to them.
    if not is_assignment_targeted_to_user(assignment, current_user):
        raise HTTPException(status_code=403, detail="Bu ödev size atanmamış.")

    if assignment.due_date:
        try:
            # Handle ISO format from seed or simple date string
            # If ISO format ends with Z or +00:00, fromisoformat handles it (Python 3.11+ better, but 3.9+ supports basic)
            # Our seed uses .isoformat(), which usually gives 'YYYY-MM-DDTHH:MM:SS.mmmmmm'
            deadline = datetime.fromisoformat(assignment.due_date)
            # Ensure both are offset-naive for comparison to avoid TypeError
            if deadline.tzinfo:
                deadline = deadline.replace(tzinfo=None)
                
            if datetime.utcnow() > deadline:
                raise HTTPException(status_code=400, detail="Bu ödevin teslim süresi dolmuştur.")
        except ValueError:
            pass # Invalid date format in DB, skipping check for safety

    db_submission = Submission(
        user_id=current_user.id,
        assignment_id=submission.assignment_id,
        code_content=submission.code_content,
        grading_result=submission.grading_result
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    db.refresh(db_submission)
    
    # Check Badges
    new_badges_data = check_badges(current_user.id, db, db_submission.id)
    
    # Convert to Pydantic model response
    response = SubmissionOut.model_validate(db_submission)
    # Manually populate computed fields if needed (student_name usually None in simple mapping unless hybrid prop)
    response.student_name = current_user.full_name 
    response.new_badges = [Badge(**b) for b in new_badges_data]
                      
    return response

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
    if current_user.role not in ("teacher", "superadmin"):
        query = query.filter(Submission.user_id == current_user.id)

    results = query.order_by(Submission.submitted_at.desc()).all()

    output: List[SubmissionOut] = []
    for res in results:
        # Faz 3: submissions.grading_result senkronize olmadıysa evaluations tablosundaki
        # tam JSONB sonucuna düş (submission_id/evaluation ilişkisi üzerinden).
        grading_result = _coerce_grading_result(res.grading_result)
        if not grading_result and res.evaluation is not None:
            grading_result = _coerce_grading_result(res.evaluation.grading_result_json)

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
    
    if current_user.role != "teacher" and db_submission.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    db.delete(db_submission)
    db.commit()
    return {"message": "Teslimat silindi"}
