from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, Submission, Assignment, UserBadge
import json
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel
from ..schemas import Badge
from ..badges import BADGE_DEFINITIONS

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

    badges: List[Badge]

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
    
    # Fetch all badges
    earned_badges = db.query(UserBadge).filter(UserBadge.user_id.in_(student_ids)).all()
    user_badges_map = {}
    for b in earned_badges:
        if b.user_id not in user_badges_map:
            user_badges_map[b.user_id] = []
        
        if b.badge_name in BADGE_DEFINITIONS:
            def_ = BADGE_DEFINITIONS[b.badge_name]
            user_badges_map[b.user_id].append(Badge(
                name=b.badge_name,
                icon=def_["icon"],
                description=def_["description"]
            ))
    
    # Process data
    leaderboard_data = []
    
    for student in students:
        student_subs = [s for s in submissions if s.user_id == student.id]
        
        # Maps to store best attempt for each assignment
        # key: assignment_id, value: {score: int, xp: int, submitted_at: datetime}
        best_attempts = {}
        
        has_streak = False
        
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
            assignment = sub.assignment
            if assignment and assignment.created_at:
                if sub.submitted_at <= assignment.created_at + timedelta(hours=24):
                    bonus_xp += 10
            
            total_attempt_xp = score + bonus_xp
            
            # Update best attempt logic (INSIDE LOOP)
            aid = sub.assignment_id
            if aid is not None:
                if aid not in best_attempts:
                    best_attempts[aid] = {"score": score, "xp": total_attempt_xp}
                else:
                    if score > best_attempts[aid]["score"]:
                         best_attempts[aid] = {"score": score, "xp": total_attempt_xp}
                    elif score == best_attempts[aid]["score"]:
                         if total_attempt_xp > best_attempts[aid]["xp"]:
                             best_attempts[aid]["xp"] = total_attempt_xp

        # Calculate Streak (OUTSIDE LOOP)
        submission_dates = sorted({s.submitted_at.date() for s in student_subs})
        current_streak = 0
        if submission_dates:
            today = datetime.utcnow().date()
            last_sub_date = submission_dates[-1]
            if (today - last_sub_date).days <= 1:
                current_streak = 1
                for i in range(len(submission_dates) - 1, 0, -1):
                    if (submission_dates[i] - submission_dates[i-1]).days == 1:
                        current_streak += 1
                    else:
                        break
        
        has_streak = current_streak >= 3

        # Aggregation
        total_xp = sum(item["xp"] for item in best_attempts.values())
        completed_tasks = sum(1 for item in best_attempts.values() if item["score"] >= 1)
        
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
            "badges": user_badges_map.get(student.id, [])
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
