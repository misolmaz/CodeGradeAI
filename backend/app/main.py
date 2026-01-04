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
from .initial_data import create_initial_data
create_initial_data()

# Auto-migration system
try:
    with engine.connect() as conn:
        # 1. Check assignments.created_at
        try:
            conn.execute(text("SELECT created_at FROM assignments LIMIT 1"))
        except Exception:
            print("Migrating: Adding 'created_at' to assignments...")
            # Detect DB type
            if "postgres" in str(engine.url):
                conn.execute(text("ALTER TABLE assignments ADD COLUMN created_at TIMESTAMP"))
            else:
                conn.execute(text("ALTER TABLE assignments ADD COLUMN created_at DATETIME"))
            conn.commit()

        # 2. Check organizations.is_active
        try:
            conn.execute(text("SELECT is_active FROM organizations LIMIT 1"))
        except Exception:
            print("Migrating: Adding 'is_active' to organizations...")
            if "postgres" in str(engine.url):
                 conn.execute(text("ALTER TABLE organizations ADD COLUMN is_active BOOLEAN DEFAULT TRUE"))
            else:
                 conn.execute(text("ALTER TABLE organizations ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            conn.commit()

except Exception as e:
    print(f"Migration check warning: {e}")



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
