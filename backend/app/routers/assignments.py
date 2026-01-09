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
    db_assignment.organization_id = current_user.organization_id
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
    # Filter by Organization
    assignments = db.query(Assignment).filter(Assignment.organization_id == current_user.organization_id).all()
    
    # Fetch Teacher Name for this Organization
    teacher = db.query(User).filter(
        User.organization_id == current_user.organization_id, 
        User.role == 'teacher'
    ).first()
    teacher_name = teacher.full_name if teacher else "Eğitmen"

    # Convert to schema and inject teacher_name
    results = []
    for a in assignments:
        # Pydantic's from_orm (v1) or model_validate (v2) or constructor
        # Using from_attributes=True in Config allowing direct dict conversion or constructor
        # easiest is to construct it or use validation.
        # Let's use simple manual construction or Pydantic copy.
        # Actually since response_model is List[AssignmentOut], FastAPI handles the conversion usually.
        # But we need to inject a field that is NOT in the ORM model (teacher_name).
        
        # We can create a partial dict from ORM and add our field
        a_data = AssignmentOut.from_orm(a)
        a_data.teacher_name = teacher_name
        results.append(a_data)
        
    return results

@router.delete("/{assignment_id}")
async def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    db_assignment = db.query(Assignment).filter(Assignment.id == assignment_id, Assignment.organization_id == current_user.organization_id).first()
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
    
    db_assignment = db.query(Assignment).filter(Assignment.id == assignment_id, Assignment.organization_id == current_user.organization_id).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Ödev bulunamadı")
    
    for key, value in assignment.dict().items():
        setattr(db_assignment, key, value)
    
    db.commit()
    db.refresh(db_assignment)
    return db_assignment
