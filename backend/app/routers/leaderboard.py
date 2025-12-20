from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Submission, Assignment
import json
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(
    prefix="/leaderboard",
    tags=["leaderboard"]
)

class LeaderboardEntry(BaseModel):
    rank: int
    username: str
    full_name: str
    avatar_url: str | None
    total_xp: int
    average_score: int
    completed_tasks: int
    streak: bool
    badges: List[str]

@router.get("/", response_model=List[LeaderboardEntry])
async def get_leaderboard(class_code: Optional[str] = None, db: Session = Depends(get_db)):
    # Base query for students
    users_query = db.query(User).filter(User.role == "student")
    if class_code:
        users_query = users_query.filter(User.class_code == class_code)
    
    students = users_query.all()
    student_ids = [s.id for s in students]
    
    # Fetch all relevant submissions
    submissions = db.query(Submission).filter(Submission.user_id.in_(student_ids)).all()
    
    # Process data
    leaderboard_data = []
    
    for student in students:
        student_subs = [s for s in submissions if s.user_id == student.id]
        
        # Maps to store best attempt for each assignment
        # key: assignment_id, value: {score: int, xp: int, submitted_at: datetime}
        best_attempts = {}
        
        has_streak = False
        last_7_days = datetime.utcnow() - timedelta(days=7)
        
        for sub in student_subs:
            try:
                result_json = json.loads(sub.grading_result)
                score = int(result_json.get("grade", 0))
            except:
                score = 0
                
            # Bonus Calculations
            bonus_xp = 0
            
            # Clean Code Bonus
            if score > 95:
                bonus_xp += 5
            
            # Early Bird Bonus
            # We need to access the assignment. Since lazy loading might be slow in loop, 
            # ideally we should have eager loaded or fetched assignments.
            # For this scale, accessing sub.assignment is acceptable, but let's be safe.
            assignment = sub.assignment
            if assignment and assignment.created_at:
                # If submitted within 24 hours of creation
                if sub.submitted_at <= assignment.created_at + timedelta(hours=24):
                    bonus_xp += 10
            
            total_attempt_xp = score + bonus_xp
            
            # Streak Check
            if sub.submitted_at >= last_7_days:
                has_streak = True
            
            # Update best attempt
            aid = sub.assignment_id
            if aid is not None:
                if aid not in best_attempts:
                    best_attempts[aid] = {"score": score, "xp": total_attempt_xp}
                else:
                    # Keep the one with highest score, or highest XP if scores tie? 
                    # Usually highest grade matters most.
                    if score > best_attempts[aid]["score"]:
                         best_attempts[aid] = {"score": score, "xp": total_attempt_xp}
                    elif score == best_attempts[aid]["score"]:
                         if total_attempt_xp > best_attempts[aid]["xp"]:
                             best_attempts[aid]["xp"] = total_attempt_xp

        # Aggregation
        total_xp = sum(item["xp"] for item in best_attempts.values())
        completed_tasks = sum(1 for item in best_attempts.values() if item["score"] >= 70)
        
        avg_score = 0
        if best_attempts:
            avg_score = sum(item["score"] for item in best_attempts.values()) / len(best_attempts)
            
        leaderboard_data.append({
            "username": student.student_number,
            "full_name": student.full_name,
            "avatar_url": student.avatar_url,
            "total_xp": total_xp,
            "average_score": round(avg_score),
            "completed_tasks": completed_tasks,
            "streak": has_streak,
            "badges": [] # Placeholder for now as per requirements
        })
    
    # Sort by Total XP Descending
    leaderboard_data.sort(key=lambda x: x["total_xp"], reverse=True)
    
    # Assign Ranks
    result = []
    for idx, entry in enumerate(leaderboard_data):
        result.append(LeaderboardEntry(
            rank=idx + 1,
            **entry
        ))
        
    return result
