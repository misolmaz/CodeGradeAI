from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..services import process_excel_upload
from ..schemas import TenantCreate
from ..models import User, Organization
from ..auth import get_password_hash
from .users import get_current_user

router = APIRouter(
    prefix="/admin",
    tags=["admin"]
)

@router.post("/upload-students")
async def upload_students(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["teacher", "superadmin"]:
        raise HTTPException(status_code=403, detail="Yetkisiz işlem")

    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="Sadece Excel dosyaları kabul edilir.")
    
    try:
        content = await file.read()
        # Pass current_user to associate students with this org
        results = process_excel_upload(content, db, admin_user=current_user)
        return {"message": "İşlem tamamlandı", "details": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/students")
async def get_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["teacher", "superadmin"]:
        raise HTTPException(status_code=403, detail="Yetkisiz işlem")
        
    students = db.query(User).filter(User.role == "student", User.organization_id == current_user.organization_id).all()
    return students

@router.post("/reset-password/{student_number}")
async def reset_student_password(
    student_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["teacher", "superadmin"]:
        raise HTTPException(status_code=403, detail="Yetkisiz işlem")
    
    student = db.query(User).filter(User.student_number == student_number, User.role == "student", User.organization_id == current_user.organization_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı.")
    
    # Reset password to student_number
    student.password_hash = get_password_hash(student_number)
    db.commit()
    
    return {"message": f"{student_number} numaralı öğrencinin şifresi başarıyla sıfırlandı."}

@router.post("/create-tenant")
async def create_new_tenant_api(
    tenant_data: TenantCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a new TEACHER WORKSPACE (SaaS Tenant).
    Only SUPERADMIN can perform this action.
    """
    if current_user.role != "superadmin":
         raise HTTPException(status_code=403, detail="Sadece Sistem Yöneticisi yeni öğretmen hesabı açabilir.")
    # 1. Create Organization
    existing_org = db.query(Organization).filter(Organization.name == tenant_data.org_name).first()
    if existing_org:
        raise HTTPException(status_code=400, detail=f"'{tenant_data.org_name}' adında bir kurum zaten var.")

    new_org = Organization(name=tenant_data.org_name)
    db.add(new_org)
    db.commit()
    db.refresh(new_org)

    # 2. Create Teacher
    existing_user = db.query(User).filter(User.student_number == tenant_data.teacher_username).first()
    if existing_user:
        # Cleanup
        db.delete(new_org)
        db.commit()
        raise HTTPException(status_code=400, detail=f"'{tenant_data.teacher_username}' kullanıcı adı zaten kullanılıyor.")

    hashed_pwd = get_password_hash(tenant_data.teacher_password)
    new_teacher = User(
        student_number=tenant_data.teacher_username,
        full_name=tenant_data.teacher_fullname,
        password_hash=hashed_pwd,
        role="teacher",
        class_code="ADMIN",
        is_first_login=False,
        organization_id=new_org.id
    )
    db.add(new_teacher)
    db.commit()
    
    return {
        "message": "Yeni Öğretmen (SaaS Müşterisi) başarıyla oluşturuldu.",
        "workspace": new_org.name,
        "teacher_login": new_teacher.student_number,
        "note": "Kullanıcı oluşturuldu ve aktif edildi."
    }

@router.put("/tenant/{org_id}/status")
async def update_tenant_status(
    org_id: int, 
    is_active: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Activate or Deactivate a Teacher's Workspace (Subscription Management).
    """
    if current_user.role != "superadmin":
         raise HTTPException(status_code=403, detail="Yetkiniz yok.")
         
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organizasyon bulunamadı")
        
    org.is_active = is_active
    db.commit()
    
    status_str = "Aktif" if is_active else "Pasif"
    return {"message": f"Organizasyon '{org.name}' başarıyla {status_str} durumuna getirildi."}
