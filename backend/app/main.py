from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .schemas import SubmissionRequest, GradingResult
from .services import grade_submission
from .database import engine, Base
from . import models
from .routers import admin, auth, users, assignments, submissions, announcements
import os
from dotenv import load_dotenv

load_dotenv()

# Create Database Tables
models.Base.metadata.create_all(bind=engine)
from .initial_data import create_admin_user
create_admin_user()



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
