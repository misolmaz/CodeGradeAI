
import sqlite3
import os

# Path to database
DB_PATH = "sql_app.db"

def migrate_constraints():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        print("Starting schema migration for multi-tenant email support...")

        # 1. Drop existing index on email if it exists (usually created by SQLAlchemy as ix_users_email)
        # We try to drop both the index and any potential unique constraint name
        try:
            cursor.execute("DROP INDEX IF EXISTS ix_users_email")
            print("Dropped index: ix_users_email")
        except Exception as e:
            print(f"Info: Could not drop ix_users_email: {e}")

        # 2. Create new composite unique index
        # This enforces (organization_id, email) uniqueness
        try:
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS _email_org_uc 
                ON users(email, organization_id) 
                WHERE email IS NOT NULL
            """)
            print("Created new unique index: _email_org_uc (email + organization_id)")
        except Exception as e:
            print(f"Error creating new index: {e}")

        # 3. Also recreate the standard index for email searches (non-unique) for performance
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users(email)")
            print("Re-created performance index: ix_users_email")
        except Exception as e:
            print(f"Error recreating search index: {e}")

        conn.commit()
        print("Migration completed successfully.")

    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_constraints()
