from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import User, Organization
from .auth import get_password_hash

def create_initial_data():
    db = SessionLocal()
    try:
        # 1. Create Default Organization if not exists
        default_org = db.query(Organization).first()
        if not default_org:
            print("Creating default organization...")
            default_org = Organization(name="Varsayılan Kurum")
            db.add(default_org)
            db.commit()
            db.refresh(default_org)
            print(f"Default organization created with ID: {default_org.id}")

        # 2. Check if admin exists
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
                is_first_login=False,
                organization_id=default_org.id # Link to default org
            )
            db.add(admin_user)
            db.commit()
            print("Admin user created successfully.")
        else:
            # Fix existing admin or users who have no organization
            if user.organization_id is None:
                print("Assigning admin to default organization...")
                user.organization_id = default_org.id
                db.commit()

        # 3. Assign all users with no org to default org
        orphaned_users = db.query(User).filter(User.organization_id == None).all()
        if orphaned_users:
            print(f"Assigning {len(orphaned_users)} orphaned users to default organization...")
            for u in orphaned_users:
                u.organization_id = default_org.id
            db.commit()

    except Exception as e:
        print(f"Error initializing data: {e}")
        db.rollback()
    finally:
        db.close()
