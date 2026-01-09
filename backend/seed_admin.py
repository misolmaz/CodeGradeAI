
import sys
import os

# Add current directory to path so we can import 'app' module
sys.path.append(os.getcwd())

from app.database import SessionLocal
from app.models import User
from app.auth import get_password_hash

def seed_admin():
    db = SessionLocal()
    try:
        target_email = "admin@edustack.cloud"
        target_username = "ADMIN001" 
        target_password = "admin123"
        hashed_pwd = get_password_hash(target_password)

        print(f"Checking for admin user ({target_email})...")
        
        # Try to find by email
        user = db.query(User).filter(User.email == target_email).first()
        
        # If not by email, try by username (common alternative for admin)
        if not user:
            user = db.query(User).filter(User.student_number == "admin").first()
        if not user:
            user = db.query(User).filter(User.student_number == target_username).first()

        if user:
            print(f"Admin user found (ID: {user.id}, Username: {user.student_number}). Updating password...")
            user.password_hash = hashed_pwd
            # Ensure email is set if missing
            if not user.email:
                user.email = target_email
            db.commit()
            print("Password and email updated successfully.")
        else:
            print("Admin user not found. Creating new Super Admin...")
            new_admin = User(
                student_number=target_username,
                full_name="System Administrator",
                email=target_email,
                password_hash=hashed_pwd,
                role="superadmin",
                is_first_login=False,
                organization_id=None 
            )
            db.add(new_admin)
            db.commit()
            print(f"Super Admin created with username: {target_username}, email: {target_email}, password: {target_password}")

    except Exception as e:
        print(f"Error seeding admin: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
