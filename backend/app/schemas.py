from pydantic import BaseModel, Field
from typing import List, Literal

class UnitTestResult(BaseModel):
    testName: str = Field(..., description="Test senaryosunun adı")
    passed: bool = Field(..., description="Testin geçip geçmediği")
    message: str = Field(..., description="Test sonucu veya hata mesajı")

class GradingResult(BaseModel):
    grade: int = Field(..., description="0-100 arası not", ge=0, le=100)
    feedback: str = Field(..., description="Genel geri bildirim metni")
    codeQuality: str = Field(..., description="Kod kalitesi değerlendirmesi")
    suggestions: List[str] = Field(..., description="Geliştirme önerileri listesi")
    unitTests: List[UnitTestResult] = Field(..., description="Birim testi sonuçları")

class SubmissionRequest(BaseModel):
    assignmentDescription: str = Field(..., description="Ödevin ne istediği")
    assignmentLanguage: str = Field(..., description="Kodlama dili (örn: Python, Java)")
    studentCode: str = Field(..., description="Öğrencinin yazdığı kod")
    studentLevel: Literal["beginner", "intermediate", "advanced"] = Field("beginner", description="Öğrenci seviyesi")
