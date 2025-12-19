from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    student_number = Column(String, unique=True, index=True)
    full_name = Column(String)
    password_hash = Column(String)
    role = Column(String) # 'student' or 'teacher'
    class_code = Column(String, nullable=True) # e.g., '10-A'
    is_first_login = Column(Boolean, default=True)
    avatar_url = Column(String, nullable=True)

    submissions = relationship("Submission", back_populates="owner")

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text)
    due_date = Column(String) # For simplicity, storing as string or use DateTime
    language = Column(String)
    student_level = Column(String) # beginner, intermediate, advanced
    status = Column(String, default="active") # active, expired
    target_type = Column(String, default="all") # all, class, specific
    target_class = Column(String, nullable=True)
    target_students = Column(Text, nullable=True) # Stored as comma-separated or JSON list

    submissions = relationship("Submission", back_populates="assignment")

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=True)
    code_content = Column(Text)
    grading_result = Column(Text) # JSON string of GradingResult
    submitted_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="submissions")
    assignment = relationship("Assignment", back_populates="submissions")

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    content = Column(Text)
    type = Column(String, default="info") # info, warning
    date = Column(String) # Storage as string for direct display

