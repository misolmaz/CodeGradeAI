from pydantic import BaseModel, Field
from typing import List, Literal
from datetime import datetime


class UnitTestResult(BaseModel):
    testName: str = Field(..., description="Test senaryosunun adı")
    passed: bool = Field(..., description="Testin geçip geçmediği")
    message: str = Field(..., description="Test sonucu veya hata mesajı")

class GradingResult(BaseModel):
    grade: int = Field(..., description="0-100 arası not")
    feedback: str = Field(..., description="Genel geri bildirim metni")
    codeQuality: str = Field(..., description="Kod kalitesi değerlendirmesi")
    suggestions: List[str] = Field(..., description="Geliştirme önerileri listesi")
    unitTests: List[UnitTestResult] = Field(..., description="Birim testi sonuçları")

class SubmissionRequest(BaseModel):
    assignmentDescription: str = Field(..., description="Ödevin ne istediği")
    assignmentLanguage: str = Field(..., description="Kodlama dili (örn: Python, Java)")
    studentCode: str = Field(..., description="Öğrencinin yazdığı kod")
    studentLevel: Literal["beginner", "intermediate", "advanced"] = Field("beginner", description="Öğrenci seviyesi")

class PasswordChange(BaseModel):
    oldPassword: str
    newPassword: str

class UserUpdate(BaseModel):
    avatarUrl: str | None = None
    full_name: str | None = None


class AssignmentBase(BaseModel):
    title: str
    description: str
    due_date: str
    language: str
    student_level: str
    status: str = "active"
    target_type: str = "all"
    target_class: str | None = None
    target_students: str | None = None

class AssignmentCreate(AssignmentBase):
    pass

class AssignmentOut(AssignmentBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class AnnouncementBase(BaseModel):
    title: str
    content: str
    type: str = "info"
    date: str

class AnnouncementCreate(AnnouncementBase):
    pass

class AnnouncementOut(AnnouncementBase):
    id: int
    class Config:
        from_attributes = True

class SubmissionCreate(BaseModel):
    assignment_id: int | None = None
    code_content: str
    grading_result: str # JSON string

class SubmissionOut(BaseModel):
    id: int
    user_id: int
    student_name: str | None = None
    assignment_id: int | None = None
    code_content: str
    grading_result: str
    submitted_at: datetime

    class Config:
        from_attributes = True

