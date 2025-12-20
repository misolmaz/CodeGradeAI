from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import User
from .auth import get_password_hash

def create_admin_user():
    db = SessionLocal()
    try:
        # Check if admin exists
        user = db.query(User).filter(User.student_number == "admin").first()
        if not user:
            print("Creating default admin user...")
            hashed_pwd = get_password_hash("admin123")
            admin_user = User(
                student_number="admin",
                full_name="System Admin",
                password_hash=hashed_pwd,
                role="teacher",
                class_code="ADMIN",
                is_first_login=False
            )
            db.add(admin_user)
            db.commit()
            print("Admin user created successfully.")
        else:
            print("Admin user already exists.")
            
    except Exception as e:
        print(f"Error creating admin user: {e}")
    finally:
        db.close()
