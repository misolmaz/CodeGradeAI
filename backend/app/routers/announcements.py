from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import Announcement, User
from ..schemas import AnnouncementCreate, AnnouncementOut
from .users import get_current_user

router = APIRouter(prefix="/announcements", tags=["Announcements"])

@router.post("/", response_model=AnnouncementOut)
async def create_announcement(
    announcement: AnnouncementCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["teacher", "superadmin"]:
        raise HTTPException(status_code=403, detail="Sadece öğretmenler ve yöneticiler duyuru yapabilir")
    
    # If superadmin has no org, it's global (org_id=None). If teacher, uses their org_id.
    org_id = current_user.organization_id
    
    db_announcement = Announcement(**announcement.dict(), organization_id=org_id)
    db.add(db_announcement)
    db.commit()
    db.refresh(db_announcement)
    return db_announcement

@router.get("/", response_model=List[AnnouncementOut])
async def get_announcements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
):
    print(f"DEBUG: Current user role: {current_user.role}")
    
    if current_user.role == "superadmin":
        # Superadmin sees everything (or maybe just global + their own if they had one, but pure SA sees all?)
        # Let's say SuperAdmin sees ALL for management, but for 'viewing' context usually they see what they created.
        # Actually, let's keep it simple: SuperAdmin sees ALL.
        # WAIT, user request: "Süper Admin panelinden 'Global Duyuru' yapabilme..."
        # So SA should see Global ones and filtered ones? Let's show ALL to SA.
        return db.query(Announcement).all()
        
    # Teacher/Student sees Global (None) AND their Org's announcements
    return db.query(Announcement).filter(
        (Announcement.organization_id == current_user.organization_id) | 
        (Announcement.organization_id == None)
    ).all()

@router.delete("/{announcement_id}")
async def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["teacher", "superadmin"]:
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    db_announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not db_announcement:
        raise HTTPException(status_code=404, detail="Duyuru bulunamadı")
    
    db.delete(db_announcement)
    db.commit()
    return {"message": "Duyuru silindi"}

