from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import User, Organization
from .auth import get_password_hash

def create_initial_data():
    db = SessionLocal()
    try:
        # 1. Create Default Organization (System Admin Workspace)
        default_org = db.query(Organization).first()
        if not default_org:
            print("Creating System Admin Workspace...")
            default_org = Organization(name="System Admin Workspace", is_active=True)
            db.add(default_org)
            db.commit()
            db.refresh(default_org)

        # 2. Check if admin exists
        user = db.query(User).filter(User.student_number == "admin").first()
        if not user:
            print("Creating SUPER ADMIN user...")
            hashed_pwd = get_password_hash("admin123")
            admin_user = User(
                student_number="admin",
                full_name="SaaS System Admin",
                password_hash=hashed_pwd,
                role="superadmin", # NEW ROLE
                class_code="SYSTEM",
                is_first_login=False,
                organization_id=default_org.id
            )
            db.add(admin_user)
            db.commit()
            print("Super Admin user created successfully.")
        else:
            # Upgrade existing admin to superadmin if needed
            if user.role != "superadmin":
                print("Upgrading 'admin' user to 'superadmin' role...")
                user.role = "superadmin"
                user.full_name = "SaaS System Admin"
                db.commit()

            if user.organization_id is None:
                user.organization_id = default_org.id
                db.commit()

    except Exception as e:
        print(f"Error initializing data: {e}")
        db.rollback()
    finally:
        db.close()
