from app.database import SessionLocal
from app.models import User
from app.auth import verify_password
import sys

db = SessionLocal()
try:
    user = db.query(User).filter(User.student_number == "admin").first()
    if not user:
        print("User 'admin' NOT FOUND in database!")
    else:
        print(f"User 'admin' found. Role: {user.role}")
        print(f"Stored Hash: {user.password_hash}")
        
        is_valid = verify_password("admin123", user.password_hash)
        print(f"Password 'admin123' valid? {is_valid}")
        
        if not is_valid:
            print("Trying to update password to simpler hash...")
            from app.auth import get_password_hash
            new_hash = get_password_hash("admin123")
            user.password_hash = new_hash
            db.commit()
            print("Password updated. Try logging in again.")

except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
