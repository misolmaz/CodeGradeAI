from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
from .models import UserBadge, Submission, Assignment

BADGE_DEFINITIONS = {
    "First Step": {
        "icon": "Trophy",
        "description": "İlk ödevini başarıyla (skor > 0) tamamladın!"
    },
    "Fast & Furious": {
        "icon": "Zap",
        "description": "Bir ödevi ilk 12 saat içinde yüksek puanla (>= 80) tamamladın!"
    },
    "Clean Code Architect": {
        "icon": "Sparkles",
        "description": "3 farklı ödevden 95 ve üzeri puan aldın!"
    },
    "Bug Hunter": {
        "icon": "Shield",
        "description": "5 farklı ödevi başarıyla tamamladın!"
    },
    "On Fire": {
        "icon": "Flame",
        "description": "5 gün arka arkaya kod gönderdin!"
    }
}

def get_score(submission: Submission) -> int:
    try:
        data = json.loads(submission.grading_result)
        return int(data.get("grade", 0))
    except:
        return 0

def check_badges(user_id: int, db: Session, current_submission_id: int = None):
    # Fetch all submissions for user
    submissions = db.query(Submission).filter(Submission.user_id == user_id).all()
    
    # Fetch existing badges
    existing_badges = db.query(UserBadge).filter(UserBadge.user_id == user_id).all()
    existing_names = {b.badge_name for b in existing_badges}
    
    new_badges = []

    # Logic for "First Step"
    if "First Step" not in existing_names:
        # Check if any submission has score >= 60
        if any(get_score(s) >= 1 for s in submissions):
            new_badges.append("First Step")

    # Logic for "Fast & Furious"
    if "Fast & Furious" not in existing_names:
        # Check specific condition: submitted within 12h of assignment creation & score >= 80
        # We need assignment details.
        for sub in submissions:
            score = get_score(sub)
            if score >= 80 and sub.assignment:
                # Check time diff
                # created_at and submitted_at are datetime objects
                if sub.assignment.created_at:
                    time_diff = sub.submitted_at - sub.assignment.created_at
                    if time_diff <= timedelta(hours=12):
                        new_badges.append("Fast & Furious")
                        break

    # Logic for "Clean Code Architect"
    if "Clean Code Architect" not in existing_names:
        # 3 unique assignments with score >= 95
        high_score_assignments = {s.assignment_id for s in submissions if get_score(s) >= 95}
        if len(high_score_assignments) >= 3:
            new_badges.append("Clean Code Architect")

    # Logic for "Bug Hunter"
    if "Bug Hunter" not in existing_names:
        # 5 unique assignments passed (>= 50? let's say 60 based on First Step)
        passed_assignments = {s.assignment_id for s in submissions if get_score(s) >= 60}
        if len(passed_assignments) >= 5:
            new_badges.append("Bug Hunter")

    # Logic for "On Fire"
    if "On Fire" not in existing_names:
        # 5 consecutive days with submissions
        # Get unique dates of submissions
        dates = sorted({s.submitted_at.date() for s in submissions})
        streak = 0
        if len(dates) >= 5:
            for i in range(len(dates) - 1):
                if (dates[i+1] - dates[i]).days == 1:
                    streak += 1
                    if streak >= 4: # 4 gaps means 5 days
                        new_badges.append("On Fire")
                        break
                else:
                    streak = 0
            # Check edge case: if only 5 days exactly
            if streak >= 4:
                 if "On Fire" not in new_badges: # Double check
                     new_badges.append("On Fire")

    # Save new badges
    result = []
    for badge_name in new_badges:
        if badge_name not in existing_names: # concurrency safety check
            db_badge = UserBadge(user_id=user_id, badge_name=badge_name)
            db.add(db_badge)
            existing_names.add(badge_name) # Prevent duplicate add in loop
            
            # Prepare result object
            result.append({
                "name": badge_name,
                "icon": BADGE_DEFINITIONS[badge_name]["icon"],
                "description": BADGE_DEFINITIONS[badge_name]["description"]
            })
    
    if result:
        db.commit()

    return result
