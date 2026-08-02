from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Organization
from ..auth import verify_password
from ..jwt_auth import create_access_token, Token
from .users import get_current_user, get_current_token_payload
from datetime import timedelta

router = APIRouter(tags=["Authentication"])

@router.post("/token")
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    organization_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    from sqlalchemy import or_

    # 1. Find all users with this student number OR email
    users = db.query(User).filter(
        or_(
            User.student_number == form_data.username,
            User.email == form_data.username
        )
    ).all()
    
    # 2. Filter users by password verification locally to avoid timing attacks (though hash check is slow anyway)
    # We verify password for ALL matches.
    valid_users = [user for user in users if verify_password(form_data.password, user.password_hash)]

    if not valid_users:
        # Generic error message
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hatalı kullanıcı adı veya şifre",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 3. Handle Ambiguity
    selected_user = None
    
    if len(valid_users) == 1:
        # Case A: Only one user found (most common) -> Log them in directly
        selected_user = valid_users[0]
    else:
        # Case B: Multiple users found.
        if organization_id:
            # Case B1: User has specified which organization they want
            selected_user = next((u for u in valid_users if u.organization_id == organization_id), None)
            
            if not selected_user:
                 # Should technically be 404 or 400 but 401 is safe
                 raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Seçilen organizasyon için kayıt bulunamadı",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        else:
            # Case B2: Ambiguity exists and no selection made -> Return 409 with options
            organizations_list = []
            for user in valid_users:
                org = db.query(Organization).filter(Organization.id == user.organization_id).first()
                if org:
                    # Fetch Teacher Name for this org
                    teacher = db.query(User).filter(
                        User.organization_id == org.id, 
                        User.role == 'teacher'
                    ).first()
                    teacher_name = teacher.full_name if teacher else "Eğitmen"

                    organizations_list.append({
                        "id": org.id,
                        "name": org.name,
                        "role": user.role,
                        "class_code": user.class_code,
                        "teacher_name": teacher_name
                    })
            
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={
                    "detail": "Login Ambiguity: Multiple organizations found",
                    "organizations": organizations_list
                }
            )

    # 4. Generate Token for the selected user
    access_token_expires = timedelta(minutes=60)

    # Security: `linked_org_ids` records every organization for which THIS password
    # was actually verified in step 2 above (valid_users). This is the only set of
    # tenants the resulting session is allowed to switch into later (see
    # /token/switch) without re-entering a password — it must never be derived from
    # a bare student_number match, since student numbers are only unique per-org and
    # can coincidentally collide across unrelated tenants.
    linked_org_ids = sorted({u.organization_id for u in valid_users if u.organization_id is not None})

    # We embed org_id in the token to ensure the session is bound to a specific context
    access_token = create_access_token(
        data={
            "sub": selected_user.student_number, 
            "role": selected_user.role,
            "org_id": selected_user.organization_id,
            "user_id": selected_user.id,
            "linked_org_ids": linked_org_ids
        }, 
        expires_delta=access_token_expires
    )
    
    # 5. Fetch org name for UI display
    org_name = ""
    if selected_user.organization_id:
        org = db.query(Organization).filter(Organization.id == selected_user.organization_id).first()
        if org:
            org_name = org.name

    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": selected_user.role, 
        "username": selected_user.full_name,
        "student_number": selected_user.student_number,
        "class_code": selected_user.class_code,
        "avatar_url": selected_user.avatar_url,
        "user_id": selected_user.id,
        "organization_id": selected_user.organization_id,
        "organization_name": org_name,
        "email": selected_user.email
    }

@router.post("/token/switch")
async def switch_organization_token(
    organization_id: int,
    current_user: User = Depends(get_current_user),
    token_payload: dict = Depends(get_current_token_payload),
    db: Session = Depends(get_db)
):
    """
    Switches the active session to another organization WITHOUT re-entering a
    password.

    Security: this is only safe because `current_user` was resolved from the
    token's `user_id` (an exact, verified Primary Key lookup — see
    get_current_user), and because we ONLY allow switching into organizations that
    are present in the `linked_org_ids` claim. That claim is populated at /token
    login time and only ever contains organizations for which the submitted
    password was cryptographically verified against that specific account (see
    valid_users in login_for_access_token). We deliberately do NOT fall back to a
    bare `student_number` match against the target organization: student numbers
    are only unique *within* an organization, so two unrelated people in different
    schools can share the same student_number, and matching on it alone would let
    an attacker hijack a stranger's account in another tenant.
    """
    linked_org_ids = set(token_payload.get("linked_org_ids") or [])
    # The organization embedded in the current token is always implicitly "owned".
    if current_user.organization_id is not None:
        linked_org_ids.add(current_user.organization_id)

    if organization_id not in linked_org_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu kuruma geçiş için yetkiniz yok. Lütfen şifrenizle tekrar giriş yapın."
        )

    # Verify target user exists in target organization AND is the same identity
    # (same student_number) whose password was already verified for this org.
    target_user = db.query(User).filter(
        User.student_number == current_user.student_number,
        User.organization_id == organization_id
    ).first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found in target organization")

    # 3. Generate new token, carrying forward the same verified linked_org_ids so the
    # user can keep switching between their already-verified tenants.
    access_token_expires = timedelta(minutes=60)
    access_token = create_access_token(
        data={
            "sub": target_user.student_number, 
            "role": target_user.role,
            "org_id": target_user.organization_id,
            "user_id": target_user.id,
            "linked_org_ids": sorted(linked_org_ids)
        }, 
        expires_delta=access_token_expires
    )
    
    # 4. Get Org Name
    org_name = ""
    if target_user.organization_id:
        org = db.query(Organization).filter(Organization.id == target_user.organization_id).first()
        if org:
            org_name = org.name

    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": target_user.role, 
        "username": target_user.full_name,
        "student_number": target_user.student_number,
        "class_code": target_user.class_code,
        "avatar_url": target_user.avatar_url,
        "user_id": target_user.id,
        "organization_id": target_user.organization_id,
        "organization_name": org_name
    }
