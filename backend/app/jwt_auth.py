from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from pydantic import BaseModel
import os
from .models import User

# Secret key for signing JWTs. MUST be provided via .env — there is no safe
# fallback, because a predictable/default key allows anyone to forge valid
# access tokens for any user (including teachers and superadmins).
SECRET_KEY = os.getenv("SECRET_KEY")

_KNOWN_WEAK_SECRETS = {
    "your_secret_key_here_please_change",
    "changeme",
    "change_me",
    "secret",
    "password",
    "123456",
    "supersecret",
    "your-secret-key",
    "please_change_me",
}

_MIN_SECRET_KEY_LENGTH = 16

if not SECRET_KEY or not SECRET_KEY.strip():
    raise ValueError(
        "Zorunlu SECRET_KEY tanımlanmamış! Lütfen backend/.env dosyasına güçlü, "
        "rastgele üretilmiş bir SECRET_KEY değeri ekleyin."
    )

if SECRET_KEY.strip().lower() in _KNOWN_WEAK_SECRETS or len(SECRET_KEY.strip()) < _MIN_SECRET_KEY_LENGTH:
    raise ValueError(
        "SECRET_KEY zayıf veya varsayılan bir değer! Tahmin edilebilir token üretimini "
        "önlemek için backend/.env dosyasına en az 16 karakterlik, rastgele üretilmiş "
        "güçlü bir SECRET_KEY tanımlayın (örn: python -c \"import secrets; print(secrets.token_hex(32))\")."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    student_number: str
    class_code: str | None = None
    avatar_url: str | None = None
    user_id: int



class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            return None
        return TokenData(username=username, role=role)
    except JWTError:
        return None


def decode_token_payload(token: str) -> Optional[dict]:
    """Returns the raw JWT payload (claims dict), or None if invalid/expired."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
