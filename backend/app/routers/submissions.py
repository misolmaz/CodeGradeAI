from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from ..database import get_db
from ..models import Submission, User, Assignment
from ..schemas import SubmissionCreate, SubmissionOut, Badge
from .users import get_current_user
from ..badges import check_badges

router = APIRouter(prefix="/submissions", tags=["Submissions"])

@router.post("/", response_model=SubmissionOut)
async def create_submission(
    submission: SubmissionCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Deadline Check
    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Ödev bulunamadı")
    
    if assignment.due_date:
        try:
            # Handle ISO format from seed or simple date string
            # If ISO format ends with Z or +00:00, fromisoformat handles it (Python 3.11+ better, but 3.9+ supports basic)
            # Our seed uses .isoformat(), which usually gives 'YYYY-MM-DDTHH:MM:SS.mmmmmm'
            deadline = datetime.fromisoformat(assignment.due_date)
            if datetime.now() > deadline:
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
