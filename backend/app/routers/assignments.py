from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Assignment, User
from ..schemas import AssignmentCreate, AssignmentOut
from .users import get_current_user

router = APIRouter(prefix="/assignments", tags=["Assignments"])

@router.post("/", response_model=AssignmentOut)
async def create_assignment(
    assignment: AssignmentCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Sadece öğretmenler ödev oluşturabilir")
    
    db_assignment = Assignment(**assignment.dict())
    db.add(db_assignment)
    db.commit()
    db.refresh(db_assignment)
    return db_assignment

@router.get("/", response_model=List[AssignmentOut])
async def get_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Teachers see all, students might have filtering logic here or on frontend
    # For now, let's return all, and let frontend filter for simplicity like before,
    # or implement filtering here.
    return db.query(Assignment).all()

@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    db_assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Ödev bulunamadı")
    
    db.delete(db_assignment)
    db.commit()
    return {"message": "Ödev silindi"}
@router.put("/{assignment_id}", response_model=AssignmentOut)
async def update_assignment(
    assignment_id: int,
    assignment: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    db_assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Ödev bulunamadı")
    
    for key, value in assignment.dict().items():
        setattr(db_assignment, key, value)
    
    db.commit()
    db.refresh(db_assignment)
    return db_assignment
