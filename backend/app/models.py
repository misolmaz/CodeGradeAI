from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True) # Teacher's Workspace Name
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True) # Subscription Status (Active/Passive)

    users = relationship("User", back_populates="organization")
    assignments = relationship("Assignment", back_populates="organization")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    student_number = Column(String, unique=True, index=True) # Username
    full_name = Column(String)
    password_hash = Column(String)
    role = Column(String) # 'student', 'teacher', 'superadmin'
    class_code = Column(String, nullable=True) 
    is_first_login = Column(Boolean, default=True)
    avatar_url = Column(String, nullable=True)

    organization = relationship("Organization", back_populates="users")
    submissions = relationship("Submission", back_populates="owner")
    badges = relationship("UserBadge", back_populates="user")

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    title = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    description = Column(Text)
    due_date = Column(String)
    language = Column(String)
    student_level = Column(String)
    status = Column(String, default="active")
    target_type = Column(String, default="all")
    target_class = Column(String, nullable=True)
    target_students = Column(JSON, nullable=True)

    organization = relationship("Organization", back_populates="assignments")
    submissions = relationship("Submission", back_populates="assignment")

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=True)
    code_content = Column(Text)
    grading_result = Column(JSON)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="submissions")
    assignment = relationship("Assignment", back_populates="assignment")

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    title = Column(String)
    content = Column(Text)
    type = Column(String, default="info")
    date = Column(String)

class UserBadge(Base):
    __tablename__ = "user_badges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    badge_name = Column(String, index=True)
    earned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="badges")
