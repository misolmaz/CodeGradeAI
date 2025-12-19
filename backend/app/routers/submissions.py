from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Submission, User
from ..schemas import SubmissionCreate, SubmissionOut
from .users import get_current_user

router = APIRouter(prefix="/submissions", tags=["Submissions"])

@router.post("/", response_model=SubmissionOut)
async def create_submission(
    submission: SubmissionCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_submission = Submission(
        user_id=current_user.id,
        assignment_id=submission.assignment_id,
        code_content=submission.code_content,
        grading_result=submission.grading_result
    )
    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    return db_submission

@router.get("/", response_model=List[SubmissionOut])
async def get_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Submission)
    if current_user.role != "teacher":
        query = query.filter(Submission.user_id == current_user.id)
    
    results = query.all()
    # Manually attach full_name for now or use a join
    for res in results:
        res.student_name = res.owner.full_name
    return results


@router.delete("/{submission_id}")
async def delete_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not db_submission:
        raise HTTPException(status_code=404, detail="Teslimat bulunamadı")
    
    if current_user.role != "teacher" and db_submission.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    db.delete(db_submission)
    db.commit()
    return {"message": "Teslimat silindi"}
