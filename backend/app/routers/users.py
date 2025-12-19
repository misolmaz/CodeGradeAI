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
        "avatar_url": current_user.avatar_url
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
    
    db.commit()
    return {
        "message": "Profil güncellendi",
        "avatar_url": current_user.avatar_url,
        "full_name": current_user.full_name
    }

