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
