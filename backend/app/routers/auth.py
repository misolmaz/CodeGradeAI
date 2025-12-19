from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..auth import verify_password
from ..jwt_auth import create_access_token, Token
from datetime import timedelta

router = APIRouter(tags=["Authentication"])

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.student_number == form_data.username).first()
    if not user:
        print(f"Login failed: User {form_data.username} not found")
    elif not verify_password(form_data.password, user.password_hash):
        print(f"Login failed: Password mismatch for {form_data.username}")
        # print(f"Stored Hash: {user.password_hash}") # ONLY FOR DEBUGGING
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hatalı kullanıcı adı veya şifre",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=60)
    access_token = create_access_token(
        data={"sub": user.student_number, "role": user.role}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": user.role, 
        "username": user.full_name,
        "student_number": user.student_number,
        "class_code": user.class_code,
        "avatar_url": user.avatar_url,
        "user_id": user.id
    }


