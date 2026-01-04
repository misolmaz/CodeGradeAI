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
        raise HTTPException(status_code=403, detail="Sadece öğretmenler duyuru yapabilir")
    
    db_announcement = Announcement(**announcement.dict())
    db.add(db_announcement)
    db.commit()
    db.refresh(db_announcement)
    return db_announcement

@router.get("/", response_model=List[AnnouncementOut])
async def get_announcements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Announcement).all()

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

