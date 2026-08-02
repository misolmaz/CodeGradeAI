import json
from pydantic import BaseModel, Field, field_validator
from typing import Any, Dict, List, Literal, Optional, Union
from datetime import datetime

# --- v0.2 Pedagogical Taxonomies (Faz 1) ---

ErrorType = Literal[
    "syntax_error",
    "runtime_error",
    "logic_error",
    "conceptual_error",
    "boundary_case_error",
    "data_type_error",
    "loop_error",
    "conditional_error",
    "function_structure_error",
    "input_output_format_error",
    "code_readability_issue",
    "incomplete_solution",
    "major_error_not_detected",
]

ErrorSeverity = Literal["low", "medium", "high", "blocking"]

ScaffoldingLevel = Literal["awareness", "guided_hint", "strategic_hint", "near_solution"]



class Badge(BaseModel):
    name: str
    icon: str
    description: str

class UnitTestResult(BaseModel):
    testName: str = Field(..., description="Test senaryosunun adı")
    passed: bool = Field(..., description="Testin geçip geçmediği")
    message: str = Field(..., description="Test sonucu veya hata mesajı")

class RubricScores(BaseModel):
    correctness: int = Field(..., ge=1, le=5, description="Doğruluk alt puanı (1-5)")
    algorithmic_thinking: int = Field(..., ge=1, le=5, description="Algoritmik düşünme alt puanı (1-5)")
    syntax_and_language_use: int = Field(..., ge=1, le=5, description="Sözdizimi ve dil kullanımı alt puanı (1-5)")
    code_readability: int = Field(..., ge=1, le=5, description="Kod okunabilirliği alt puanı (1-5)")
    debugging_awareness: int = Field(..., ge=1, le=5, description="Hata ayıklama farkındalığı alt puanı (1-5)")

class ErrorFinding(BaseModel):
    error_type: ErrorType = Field(..., description="Hata taksonomisi türü")
    severity: ErrorSeverity = Field(..., description="Hata şiddeti")
    location_hint: Optional[str] = Field(None, description="Hatanın kod içindeki konum ipucu")
    explanation: str = Field(..., description="Hata açıklaması")
    misconception: Optional[str] = Field(None, description="Olası kavram yanılgısı")

class SocraticFeedback(BaseModel):
    awareness_question: str = Field(..., description="Farkındalık sorusu")
    guiding_question: str = Field(..., description="Yönlendirici soru")
    progressive_hint: str = Field(..., description="Kademeli ipucu")
    next_action: str = Field(..., description="Bir sonraki deneme için önerilen adım")
    direct_solution_given: bool = Field(..., description="Doğrudan çözüm verilip verilmediği")

class PedagogicalMetadata(BaseModel):
    feedback_strategy: str = Field(..., description="Geri bildirim stratejisi")
    scaffolding_level: ScaffoldingLevel = Field(..., description="İskeleleme seviyesi")
    student_level: str = Field(..., description="Öğrenci seviyesi")
    prompt_version: str = Field(..., description="Prompt versiyonu")
    rubric_version: str = Field(..., description="Rubrik versiyonu")
    model_name: Optional[str] = Field(None, description="Kullanılan model adı")

class GradingResult(BaseModel):
    grade: int = Field(..., description="0-100 arası not")
    feedback: str = Field(..., description="Genel geri bildirim metni")
    codeQuality: str = Field(..., description="Kod kalitesi değerlendirmesi")
    suggestions: List[str] = Field(..., description="Geliştirme önerileri listesi")
    unitTests: List[UnitTestResult] = Field(..., description="Birim testi sonuçları")
    rubricScores: Optional[RubricScores] = Field(None, description="Rubrik alt puanları (v0.2)")
    errorFindings: Optional[List[ErrorFinding]] = Field(None, description="Tespit edilen hatalar (v0.2)")
    socraticFeedback: Optional[SocraticFeedback] = Field(None, description="Sokratik geri bildirim (v0.2)")
    pedagogicalMetadata: Optional[PedagogicalMetadata] = Field(None, description="Pedagojik meta veri (v0.2)")

class SubmissionRequest(BaseModel):
    assignmentDescription: str = Field(..., description="Ödevin ne istediği")
    assignmentLanguage: str = Field(..., description="Kodlama dili (örn: Python, Java)")
    studentCode: str = Field(..., description="Öğrencinin yazdığı kod")
    studentLevel: Literal["beginner", "intermediate", "advanced"] = Field("beginner", description="Öğrenci seviyesi")
    assignmentId: Optional[int] = Field(None, description="Ödev ID — kalıcı kayıt için (Faz 3)")
    researchConsent: Optional[bool] = Field(False, description="YAYIN_016 araştırma onam bayrağı")

class PasswordChange(BaseModel):
    oldPassword: str
    newPassword: str

class UserUpdate(BaseModel):
    avatarUrl: str | None = None
    full_name: str | None = None
    email: str | None = None


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
    created_at: datetime | None = None
    teacher_name: str | None = None
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
    # Faz 3 (JSONB) sonrası hem eski JSON string payload'larını hem de
    # doğrudan JSON nesnesi gönderen istemcileri kabul eder; her ikisi de dict'e normalize edilir.
    grading_result: Union[str, Dict[str, Any]]

    @field_validator("grading_result", mode="before")
    @classmethod
    def _normalize_grading_result(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return {}
        return v

class SubmissionOut(BaseModel):
    id: int
    user_id: int
    student_name: str | None = None
    assignment_id: int | None = None
    code_content: str
    # JSONB kolonundan dict olarak gelir; eski (Faz 2 öncesi) kayıtlar string
    # olarak saklanmış olabileceğinden geriye dönük uyumluluk için otomatik parse edilir.
    grading_result: Optional[Dict[str, Any]] = None
    submitted_at: datetime
    new_badges: List[Badge] = []

    @field_validator("grading_result", mode="before")
    @classmethod
    def _parse_grading_result(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return None
        return v

    class Config:
        from_attributes = True

class TenantCreate(BaseModel):
    org_name: str
    teacher_username: str
    teacher_email: str
    teacher_password: str
    teacher_fullname: str
