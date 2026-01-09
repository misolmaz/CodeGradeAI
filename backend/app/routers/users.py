from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from ..database import get_db
from ..models import User
from ..schemas import PasswordChange, UserUpdate
from ..auth import verify_password, get_password_hash
from ..jwt_auth import SECRET_KEY, ALGORITHM

router = APIRouter(prefix="/users", tags=["Users"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        student_number: str = payload.get("sub")
        if student_number is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.student_number == student_number).first()
    if user is None:
        raise credentials_exception
    return user

@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "full_name": current_user.full_name,
        "student_number": current_user.student_number,
        "role": current_user.role,
        "class_code": current_user.class_code,
        "avatar_url": current_user.avatar_url,
        "email": current_user.email
    }

@router.post("/change-password")
async def change_password(
    data: PasswordChange, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if not verify_password(data.oldPassword, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mevcut şifre hatalı")
    
    current_user.password_hash = get_password_hash(data.newPassword)
    db.commit()
    return {"message": "Şifre başarıyla güncellendi"}

@router.put("/update-profile")
async def update_profile(
    data: UserUpdate, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if data.avatarUrl is not None:
        current_user.avatar_url = data.avatarUrl
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.email is not None:
        current_user.email = data.email
    
    db.commit()
    return {
        "message": "Profil güncellendi",
        "avatar_url": current_user.avatar_url,
        "full_name": current_user.full_name,
        "email": current_user.email
    }


@router.get("/me/organizations")
async def get_my_organizations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns all organizations where the current user (identified by student_number) has an account.
    This enables the 'Tenant Switcher' feature.
    """
    # Find all user records with the same student number
    # Security: We assume if you are logged in as student X, you can see all orgs for student X.
    # Ideally we should verify passwords but we are already authenticated.
    
    # Import Organization here to avoid circular imports if any, or ensure it's imported at top
    from ..models import Organization
    
    user_records = db.query(User).filter(User.student_number == current_user.student_number).all()
    
    org_list = []
    for u in user_records:
        if u.organization_id:
            org = db.query(Organization).filter(Organization.id == u.organization_id).first()
            if org:
                # Fetch Teacher Name
                teacher = db.query(User).filter(
                    User.organization_id == org.id, 
                    User.role == 'teacher'
                ).first()
                teacher_name = teacher.full_name if teacher else "Eğitmen"

                # Determine if this is the currently active session
                is_current = (u.organization_id == current_user.organization_id)
                
                org_list.append({
                    "organization_id": org.id,
                    "organization_name": org.name,
                    "role": u.role,
                    "is_current": is_current,
                    "teacher_name": teacher_name
                })
    
    return org_list
