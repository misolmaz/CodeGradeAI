from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv
from pathlib import Path

env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path)

# Default to SQLite if no env var
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///sql_app.db")
print(f"Using Database for FIX: {DATABASE_URL}")

engine = create_engine(DATABASE_URL)

def run_fix():
    with engine.connect() as conn:
        print("Starting STRICT Database Fix...")
        
        # 1. DROP ALL POTENTIAL UNIQUE INDEXES ON student_number
        print("Dropping legacy unique constraints on student_number...")
        
        # List of potential names based on different DB conventions
        potential_names = [
            "ix_users_student_number", 
            "users_student_number_key", 
            "sqlite_autoindex_users_1", # SQLite sometimes does this
            "sqlite_autoindex_users_2"
        ]
        
        for name in potential_names:
            try:
                # SQLite syntax
                conn.execute(text(f"DROP INDEX IF EXISTS {name}"))
            except Exception as e:
                print(f"Ignored error dropping index {name}: {e}")

            try:
                # Postgres Syntax (Constraint)
                conn.execute(text(f"ALTER TABLE users DROP CONSTRAINT IF EXISTS {name}"))
            except:
                pass

        # 2. CREATE NEW COMPOSITE UNIQUE INDEX
        print("Creating new composite unique index (organization_id + student_number)...")
        try:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS _student_org_uc ON users (student_number, organization_id)"))
            print("SUCCESS: Composite Index Created.")
        except Exception as e:
            print(f"Error creating composite index: {e}")

        # 3. RESTORE NON-UNIQUE INDEX ON student_number (for fast Lookups)
        print("Restoring non-unique index on student_number...")
        try:
             conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_student_number_nonunique ON users (student_number)"))
        except Exception as e:
             print(f"Note: {e}")

        # 4. FIX SUPERADMIN
        print("Isolating SuperAdmins (org_id=NULL)...")
        conn.execute(text("UPDATE users SET organization_id = NULL WHERE role = 'superadmin'"))
        
        conn.commit()
        print("Fix completed.")

if __name__ == "__main__":
    run_fix()
