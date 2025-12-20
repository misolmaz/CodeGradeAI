from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..services import process_excel_upload

router = APIRouter(
    prefix="/admin",
    tags=["admin"]
)

@router.post("/upload-students")
async def upload_students(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Sadece Excel dosyaları kabul edilir.")
    
    try:
        content = await file.read()
        results = process_excel_upload(content, db)
        return {"message": "İşlem tamamlandı", "details": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/students")
async def get_students(db: Session = Depends(get_db)):
    from ..models import User
    students = db.query(User).filter(User.role == "student").all()
    return students

@router.post("/reset-password/{student_number}")
async def reset_student_password(
    student_number: str,
    db: Session = Depends(get_db)
):
    from ..models import User
    from ..auth import get_password_hash
    
    student = db.query(User).filter(User.student_number == student_number, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı.")
    
    # Reset password to student_number
    student.password_hash = get_password_hash(student_number)
    db.commit()
    
    return {"message": f"{student_number} numaralı öğrencinin şifresi başarıyla sıfırlandı."}

