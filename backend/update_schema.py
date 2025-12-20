from app.database import engine
from sqlalchemy import text

def add_created_at_column():
    with engine.connect() as conn:
        try:
            # Check if column exists strictly for SQLite
            result = conn.execute(text("PRAGMA table_info(assignments)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'created_at' not in columns:
                print("Adding 'created_at' column to assignments table...")
                conn.execute(text("ALTER TABLE assignments ADD COLUMN created_at DATETIME"))
                conn.commit()
                print("Column added successfully.")
            else:
                print("'created_at' column already exists.")
        except Exception as e:
            print(f"Error updating schema: {e}")

if __name__ == "__main__":
    add_created_at_column()
