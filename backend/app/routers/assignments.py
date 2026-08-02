import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Assignment, Submission, User
from ..schemas import AssignmentCreate, AssignmentOut
from .users import get_current_user

router = APIRouter(prefix="/assignments", tags=["Assignments"])


def parse_target_students(raw) -> List[str]:
    """Normalizes the `target_students` column into a list of student_number strings.

    The frontend historically stored this as a JSON-encoded string (e.g. via
    JSON.stringify) inside a JSON column, but it may also already be a list
    depending on how it was written. Anything unparseable is treated as empty.
    """
    if not raw:
        return []
    if isinstance(raw, list):
        return [str(s) for s in raw]
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return []
        return [str(s) for s in parsed] if isinstance(parsed, list) else []
    return []


def is_assignment_targeted_to_user(assignment: Assignment, user: User) -> bool:
    """Backend-enforced targeting: mirrors the (previously frontend-only) logic that
    decides whether a given assignment should be visible/submittable for a student.

    Teachers/superadmins are never restricted by targeting — only students are.
    """
    if user.role != "student":
        return True

    target_type = assignment.target_type or "all"
    if target_type == "all":
        return True
    if target_type == "class":
        return bool(user.class_code) and user.class_code == assignment.target_class
    if target_type == "specific":
        return user.student_number in parse_target_students(assignment.target_students)
    return False

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
    # Filter by Organization (tenant isolation)
    assignments = db.query(Assignment).filter(Assignment.organization_id == current_user.organization_id).all()

    # Security: assignment targeting (class/specific-student visibility) must be
    # enforced server-side, not just on the frontend — otherwise a student could
    # call this API directly and see assignments never intended for them.
    # Teachers/superadmins are unaffected and continue to see every assignment in
    # their organization (needed to manage/edit them).
    if current_user.role == "student":
        # An assignment a student already submitted to should always stay visible
        # (e.g. for their submission history), even if targeting changed later.
        submitted_assignment_ids = {
            row[0] for row in db.query(Submission.assignment_id)
            .filter(Submission.user_id == current_user.id)
            .all()
        }
        assignments = [
            a for a in assignments
            if a.id in submitted_assignment_ids or is_assignment_targeted_to_user(a, current_user)
        ]
    
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
