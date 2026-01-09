
import sys
import os
from sqlalchemy import text

# Add current directory to path
sys.path.append(os.getcwd())

from app.database import engine

def fix_schema():
    print("Starting PostgreSQL schema repair...")
    
    with engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")
        
        # 1. Inspect existing constraints on 'users' table
        print("Inspecting constraints...")
        result = conn.execute(text("""
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'users'::regclass
        """))
        
        constraints = result.fetchall()
        email_constraint_name = None
        
        for name, definition in constraints:
            print(f"Found constraint: {name} -> {definition}")
            # Look for UNIQUE(email) or similar global constraints
            if 'UNIQUE' in definition and '(email)' in definition and 'organization_id' not in definition:
                email_constraint_name = name

        # 2. Drop global Unique Email constraint if found
        if email_constraint_name:
            print(f"Dropping global unique email constraint: {email_constraint_name}")
            try:
                conn.execute(text(f"ALTER TABLE users DROP CONSTRAINT {email_constraint_name}"))
                print("Global email constraint dropped.")
            except Exception as e:
                print(f"Error dropping constraint: {e}")
        else:
            print("No global unique email constraint found (or already dropped).")

        # 3. Drop 'ix_users_email' index if exists (it might enforce uniqueness too)
        try:
             conn.execute(text("DROP INDEX IF EXISTS ix_users_email"))
             print("Dropped index ix_users_email (will be recreated safely).")
        except Exception as e:
             print(f"Info dropping index: {e}")

        # 4. Add Composite Unique Constraint (email, organization_id)
        # We assume email CAN be null for some users? Ideally yes.
        # But for active users, we want one email per org.
        print("Adding composite unique constraint (organization_id, email)...")
        try:
            # Using _email_org_uc name
            conn.execute(text("""
                ALTER TABLE users 
                ADD CONSTRAINT _email_org_uc UNIQUE (organization_id, email)
            """))
            print("Constraint _email_org_uc created successfully.")
        except Exception as e:
            if "already exists" in str(e):
                 print("Constraint _email_org_uc already exists.")
            else:
                 print(f"Error creating constraint: {e}")

        # 5. Recreate simple index on email for search performance (non-unique)
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_email_search ON users(email)"))
            print("Performance index ix_users_email_search created.")
        except Exception as e:
            print(f"Error creating index: {e}")

    print("Schema repair finished.")

if __name__ == "__main__":
    fix_schema()
