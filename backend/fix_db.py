import sqlite3
import os

def migrate():
    db_path = 'sql_app.db'
    if not os.path.exists(db_path):
        print("Database not found, create_all will handle it.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check User table for avatar_url
    cursor.execute("PRAGMA table_info(users)")
    columns = [column[1] for column in cursor.fetchall()]
    if 'avatar_url' not in columns:
        print("Adding avatar_url to users...")
        cursor.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")

    # Handle Submissions table changes
    # Old: id, user_id, code_content, ai_feedback, score, created_at
    # New: id, user_id, assignment_id, code_content, grading_result, submitted_at
    cursor.execute("PRAGMA table_info(submissions)")
    sub_columns = [column[1] for column in cursor.fetchall()]
    
    if 'grading_result' not in sub_columns:
        print("Migrating submissions table...")
        # Simplest way for dev: Rename old table, create new one, move what we can
        cursor.execute("ALTER TABLE submissions RENAME TO submissions_old")
        
        # New table creation (simplified from SQLAlchemy model)
        cursor.execute("""
            CREATE TABLE submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                assignment_id INTEGER,
                code_content TEXT,
                grading_result TEXT,
                submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(assignment_id) REFERENCES assignments(id)
            )
        """)
        
        # We don't really have a good way to map old scores/feedback back to the new structure perfectly 
        # without an assignment, but we can try to preserve data.
        # For now, let's just create the table. If there were submissions, we might lose them or leave them in submissions_old.
        print("Submissions table updated. Old data preserved in submissions_old.")

    # Create other tables if not exist (Assignments, Announcements)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            description TEXT,
            due_date TEXT,
            language TEXT,
            student_level TEXT,
            status TEXT DEFAULT 'active',
            target_type TEXT DEFAULT 'all',
            target_class TEXT,
            target_students TEXT
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            content TEXT,
            type TEXT DEFAULT 'info',
            date TEXT
        )
    """)

    conn.commit()
    conn.close()
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
