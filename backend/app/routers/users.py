from typing import Optional
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
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")

        # Security: user_id (exact Primary Key) is REQUIRED. The legacy fallback of
        # looking a user up by student_number alone (without an organization_id filter)
        # has been removed: student numbers are only unique *within* an organization,
        # so an org-less lookup could silently resolve to a different person in a
        # different tenant. Tokens issued without user_id (pre-multitenancy) are
        # rejected and must be re-issued via a fresh login.
        if user_id is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise credentials_exception
    return user


async def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        if user_id is None:
            return None
    except JWTError:
        return None

    return db.query(User).filter(User.id == user_id).first()


async def get_current_token_payload(token: str = Depends(oauth2_scheme)) -> dict:
    """Returns the raw JWT claims for endpoints that need session-provenance data
    (e.g. which organizations were verified with a password at login time)."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "full_name": current_user.full_name,
        "student_number": current_user.student_number,
        "role": current_user.role,
        "class_code": current_user.class_code,
        "avatar_url": current_user.avatar_url,
        "email": current_user.email,
        "is_first_login": bool(current_user.is_first_login),
    }

@router.post("/change-password")
async def change_password(
    data: PasswordChange, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if not verify_password(data.oldPassword, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Mevcut şifre hatalı")

    new_password = data.newPassword or ""
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Yeni şifre en az 6 karakter olmalı")
    if new_password == data.oldPassword or new_password == (current_user.student_number or ""):
        raise HTTPException(status_code=400, detail="Yeni şifre eski şifreden ve öğrenci numaranızdan farklı olmalı")

    current_user.password_hash = get_password_hash(new_password)
    current_user.is_first_login = False
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
    token_payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
):
    """
    Returns the organizations the current session is allowed to switch into
    (the 'Tenant Switcher' feature).

    Security: This must NOT be a blind lookup of every account sharing the same
    student_number, since student numbers are only unique per-organization and can
    coincidentally collide across unrelated tenants (account takeover risk). Instead
    we only trust the `linked_org_ids` claim, which the /token endpoint populates
    with the organizations for which the supplied password was actually verified
    at login time.
    """
    from ..models import Organization

    linked_org_ids = token_payload.get("linked_org_ids") or []
    if current_user.organization_id and current_user.organization_id not in linked_org_ids:
        linked_org_ids = [*linked_org_ids, current_user.organization_id]

    user_records = db.query(User).filter(
        User.student_number == current_user.student_number,
        User.organization_id.in_(linked_org_ids)
    ).all()

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
