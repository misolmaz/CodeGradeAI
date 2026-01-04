import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from pathlib import Path

env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

# Default to SQLite if no env var
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///sql_app.db")
print(f"Using Database: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)

def run_migration():
    with engine.connect() as conn:
        print("Starting SaaS Migration...")
        
        # 1. Update Users Table Constraints
        print("Updating Users table constraints...")
        try:
            # Drop old unique index on student_number
            # In SQLite created by SQLAlchemy, it's usually 'ix_users_student_number'
            conn.execute(text("DROP INDEX IF EXISTS ix_users_student_number"))
            # Just in case there's a constraint (Postgres)
            try:
                conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_student_number_key"))
            except:
                pass
            print("Dropped old constraints/indices.")
        except Exception as e:
            print(f"Warning dropping constraints: {e}")
        
        try:
            # Add new composite unique INDEX (Works in SQLite & Postgres)
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS _student_org_uc ON users (student_number, organization_id)"))
            print("Created new composite unique index: (student_number, organization_id)")
        except Exception as e:
            print(f"Note on adding index: {e}")
            
        try:
             # Re-create simple index on student_number (non-unique)
             conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_student_number ON users (student_number)"))
             print("Re-created index on student_number.")
        except Exception as e:
             print(f"Note on adding simple index: {e}")

        # 2. Update Announcements Table
        print("Checking Announcements table...")
        try:
             # Check if column exists
             # For SQLite, we can inspect PRAGMA table_info or just try to select it
             try:
                 conn.execute(text("SELECT organization_id FROM announcements LIMIT 1"))
                 print("organization_id already exists in announcements.")
             except:
                 print("Adding organization_id to announcements...")
                 # SQLite supports ADD COLUMN
                 conn.execute(text("ALTER TABLE announcements ADD COLUMN organization_id INTEGER REFERENCES organizations(id)"))
                 print("Column added.")
        except Exception as e:
            print(f"Error checking announcements: {e}")

        # 3. Data Cleanup (Optional/Safety)
        print("Isolating SuperAdmins...")
        try:
            conn.execute(text("UPDATE users SET organization_id = NULL WHERE role = 'superadmin'"))
        except Exception as e:
             print(f"Error isolating SuperAdmins: {e}")
        
        conn.commit()
        print("Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
