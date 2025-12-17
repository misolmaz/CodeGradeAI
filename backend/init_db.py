from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import User, Base
from app.auth import get_password_hash

def init_db():
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
        print(f"Error initializing DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("Initializing database...")
    Base.metadata.create_all(bind=engine)
    init_db()
    print("Done.")
