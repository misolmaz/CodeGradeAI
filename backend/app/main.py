from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import SubmissionRequest, GradingResult
from .services import grade_submission
from .database import engine, Base
from . import models
from .routers import admin, auth, users, assignments, submissions, announcements, leaderboard
import os
from dotenv import load_dotenv

load_dotenv()

# Create Database Tables
models.Base.metadata.create_all(bind=engine)
from .initial_data import create_admin_user
create_admin_user()

# Auto-migration for SQLite (Poor man's migration)
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
try:
    with engine.connect() as conn:
        try:
            # Try to select the new column to see if it exists
            conn.execute(text("SELECT created_at FROM assignments LIMIT 1"))
        except OperationalError:
            # If it fails, add the column
            print("Migrating database: Adding 'created_at' to assignments...")
            conn.execute(text("ALTER TABLE assignments ADD COLUMN created_at DATETIME"))
            conn.commit()
            print("Migration successful.")
except Exception as e:
    print(f"Migration check failed (might be already correct or other issue): {e}")



app = FastAPI(
    title="CodeGradeAI Backend",
    description="AI-powered code grading API using Google Gemini",
    version="1.0.0"
)

app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(assignments.router)
app.include_router(submissions.router)
app.include_router(announcements.router)
app.include_router(leaderboard.router)





# CORS Configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "CodeGradeAI Backend is running", "status": "active"}

@app.post("/api/grade", response_model=GradingResult)
async def grade_code(request: SubmissionRequest):
    """
    Analyzes and grades the submitted code using Google Gemini AI.
    """
    try:
        result = await grade_submission(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # This block is for running main.py directly (e.g. python -m app.main)
    # The Dockerfile uses uvicorn command directly.
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
