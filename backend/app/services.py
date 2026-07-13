import os
import json
import google.generativeai as genai
from typing import Dict, Any, List
from pydantic import BaseModel
from .schemas import (
    GradingResult,
    SubmissionRequest,
    UnitTestResult,
    RubricScores,
    ErrorFinding,
    SocraticFeedback,
    PedagogicalMetadata,
    ErrorType,
    ErrorSeverity,
    ScaffoldingLevel,
)
from dotenv import load_dotenv
import pandas as pd
from sqlalchemy.orm import Session
from .models import User
from .auth import get_password_hash

load_dotenv()
import io
# ... (Gemini Init remains) ...

def process_excel_upload(file_contents: bytes, db: Session, admin_user: User = None):
    try:
        # Read Excel file from bytes stream to avoid FutureWarning
        df = pd.read_excel(io.BytesIO(file_contents))
        
        # Expected columns: OgrenciNo, Ad, Soyad, Sinif
        # Normalize column names just in case
        df.columns = [c.strip() for c in df.columns]
        
        results = {"added": 0, "skipped": 0, "updated": 0, "errors": []}
        
        for index, row in df.iterrows():
            try:
                student_no = str(row['OgrenciNo']).strip()
                full_name = f"{row.get('Ad', '')} {row.get('Soyad', '')}".strip()
                class_code = str(row.get('Sinif', ''))
                
                # Email handling (Try 'Email', 'E-posta', 'Eposta')
                raw_email = row.get('Email', row.get('E-posta', row.get('Eposta', '')))
                email = str(raw_email).strip() if raw_email and str(raw_email).lower() != 'nan' else None
                
                # Default email to student_no@edustack.local if missing, to ensure uniqueness and constraints
                if not email:
                    email = f"{student_no}@edustack.local"

                # Check if user exists within the uploader's organization
                org_id = admin_user.organization_id if admin_user else None
                
                # 1. Lookup by Student Number (Primary logic)
                target_user = db.query(User).filter(
                    User.student_number == student_no,
                    User.organization_id == org_id
                ).first()
                
                # 2. Lookup by Email (Secondary logic, if email provided)
                if not target_user and email:
                     target_user = db.query(User).filter(
                        User.email == email,
                        User.organization_id == org_id
                    ).first()

                if target_user:
                    # UPDATE or SKIP
                    changes = False
                    
                    if target_user.full_name != full_name:
                        target_user.full_name = full_name
                        changes = True
                        
                    if target_user.class_code != class_code:
                        target_user.class_code = class_code
                        changes = True
                        
                    if email and target_user.email != email:
                         target_user.email = email
                         changes = True
                    
                    # Ensure student number matches (if we found by email)
                    if target_user.student_number != student_no:
                        target_user.student_number = student_no
                        changes = True

                    if changes:
                        results["updated"] += 1
                    else:
                        results["skipped"] += 1
                else:
                    # INSERT new user
                    hashed_pwd = get_password_hash(student_no)
                    
                    new_user = User(
                        student_number=student_no,
                        full_name=full_name,
                        email=email,
                        password_hash=hashed_pwd,
                        role="student",
                        class_code=class_code,
                        is_first_login=True,
                        organization_id=org_id
                    )
                    db.add(new_user)
                    results["added"] += 1
                
            except Exception as e:
                results["errors"].append(f"Row {index}: {str(e)}")
        
        db.commit()
        return results

    except Exception as e:
        raise Exception(f"Excel işleme hatası: {str(e)}")

# ... (Existing Gemini functions) ...

# --- v0.2 Pedagogical Prompt Constants (Faz 2) ---
PROMPT_VERSION = "cgai_prompt_v0.2"
RUBRIC_VERSION = "cgai_rubric_v0.2"
FEEDBACK_STRATEGY = "socratic_scaffolding"

ERROR_TAXONOMY = [
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

ERROR_SEVERITIES = ["low", "medium", "high", "blocking"]

SCAFFOLDING_LEVELS = ["awareness", "guided_hint", "strategic_hint", "near_solution"]


# --- Strict Gemini response schema (no Optional / no defaults) ---
# google.generativeai rejects JSON schemas containing "default" keys.

class StrictUnitTestResult(BaseModel):
    testName: str
    passed: bool
    message: str


class StrictRubricScores(BaseModel):
    correctness: int
    algorithmic_thinking: int
    syntax_and_language_use: int
    code_readability: int
    debugging_awareness: int


class StrictErrorFinding(BaseModel):
    error_type: ErrorType
    severity: ErrorSeverity
    location_hint: str
    explanation: str
    misconception: str


class StrictSocraticFeedback(BaseModel):
    awareness_question: str
    guiding_question: str
    progressive_hint: str
    next_action: str
    direct_solution_given: bool


class StrictPedagogicalMetadata(BaseModel):
    feedback_strategy: str
    scaffolding_level: ScaffoldingLevel
    student_level: str
    prompt_version: str
    rubric_version: str
    model_name: str


class StrictGradingResult(BaseModel):
    grade: int
    feedback: str
    codeQuality: str
    suggestions: List[str]
    unitTests: List[StrictUnitTestResult]
    rubricScores: StrictRubricScores
    errorFindings: List[StrictErrorFinding]
    socraticFeedback: StrictSocraticFeedback
    pedagogicalMetadata: StrictPedagogicalMetadata


def _map_strict_to_grading_result(strict: StrictGradingResult) -> GradingResult:
    """Map Gemini strict output to API GradingResult (Faz 0 backward-compatible shape)."""
    return GradingResult(
        grade=strict.grade,
        feedback=strict.feedback,
        codeQuality=strict.codeQuality,
        suggestions=strict.suggestions,
        unitTests=[UnitTestResult(**item.model_dump()) for item in strict.unitTests],
        rubricScores=RubricScores(**strict.rubricScores.model_dump()),
        errorFindings=[
            ErrorFinding(
                error_type=item.error_type,
                severity=item.severity,
                location_hint=item.location_hint or None,
                explanation=item.explanation,
                misconception=item.misconception or None,
            )
            for item in strict.errorFindings
        ],
        socraticFeedback=SocraticFeedback(**strict.socraticFeedback.model_dump()),
        pedagogicalMetadata=PedagogicalMetadata(
            feedback_strategy=strict.pedagogicalMetadata.feedback_strategy,
            scaffolding_level=strict.pedagogicalMetadata.scaffolding_level,
            student_level=strict.pedagogicalMetadata.student_level,
            prompt_version=strict.pedagogicalMetadata.prompt_version,
            rubric_version=strict.pedagogicalMetadata.rubric_version,
            model_name=MODEL_NAME,
        ),
    )


# Initialize Gemini
# Check both GEMINI_API_KEY and GOOGLE_API_KEY for service compatibility
API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
# Default to the most universal stable model if not specified
MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-3-flash-preview")



if not API_KEY:
    print("WARNING: API Key (GEMINI_API_KEY or GOOGLE_API_KEY) is not set in environment variables.")
else:
    genai.configure(api_key=API_KEY)


def get_system_instruction(student_level: str) -> str:
    level_configs = {
        "beginner": {
            "focus": "Temel kavramlar, söz dizimi, hata ayıklama",
            "complexity": "Basit açıklamalar, minimal teknik terim",
            "grading": "Çalışır kod ve temel gereksinimler öncelikli",
            "scaffolding_default": "guided_hint",
            "socratic_style": (
                "Çok basit dil kullan. Her teknik terimi kısaca açıkla. "
                "Küçük başarıları öv. İpuçları küçük adımlarla ver."
            ),
        },
        "intermediate": {
            "focus": "Kod organizasyonu, temiz kod, orta düzey optimizasyon",
            "complexity": "Orta düzey terimler, best practices",
            "grading": "Kalite, okunabilirlik, temel optimizasyon",
            "scaffolding_default": "strategic_hint",
            "socratic_style": (
                "DRY/KISS prensiplerine atıf yap. Performans ve okunabilirlik dengesini sorgula. "
                "Öğrenciyi kendi kodunu incelemeye yönlendir."
            ),
        },
        "advanced": {
            "focus": "Algoritmik optimizasyon, güvenlik, tasarım desenleri",
            "complexity": "İleri terimler, profesyonel standartlar",
            "grading": "Performans, ölçeklenebilirlik, bakım kolaylığı",
            "scaffolding_default": "strategic_hint",
            "socratic_style": (
                "Big-O, hata yönetimi ve test edilebilirlik üzerine sorular sor. "
                "Profesyonel standartları hatırlat; yine de tam çözüm kodu verme."
            ),
        },
    }

    config = level_configs.get(student_level, level_configs["intermediate"])
    taxonomy_list = ", ".join(ERROR_TAXONOMY)
    severity_list = ", ".join(ERROR_SEVERITIES)
    scaffolding_list = ", ".join(SCAFFOLDING_LEVELS)

    return f"""
Sen tecrübeli, sabırlı ve öğrenci seviyesine uyum sağlayan bir Bilgisayar Bilimleri Profesörüsün.
Görevin: öğrencinin kodunu değerlendirmek ve Sokratik/kademeli geri bildirim üretmek.

**ÖĞRENCİ SEVİYESİ: {student_level.upper()}**
- ODAK: {config["focus"]}
- TEKNİK DERİNLİK: {config["complexity"]}
- PUANLAMA ÖNCELİĞİ: {config["grading"]}
- SOKRATİK STİL: {config["socratic_style"]}

---

## KRİTİK YASAK (MUTLAKA UYULMALI)

1. Öğrenciye doğrudan tam çalışan çözüm kodunu (cevap anahtarını) ASLA verme.
2. Düzeltilmiş tam kod bloğu, kopyala-yapıştır çözüm veya adım adım "şu kodu yaz" tarzı cevap anahtarı üretme.
3. near_solution seviyesinde bile yalnızca ipucu ve soru ver; tam kodu yazma.
4. Yanıtın herhangi bir yerinde tam çözüm kodu verdiysen socraticFeedback.direct_solution_given = true yap; aksi halde false.

---

## SOKRATİK GERİ BİLDİRİM AKIŞI (ZORUNLU)

socraticFeedback objesini şu sırayla doldur:
1. awareness_question — Öğrencinin hatayı/kavramı fark etmesini sağlayan soru.
2. guiding_question — Doğru yöne düşünmeyi tetikleyen yönlendirici soru.
3. progressive_hint — Kademeli, küçük adımlı ipucu (tam kod değil).
4. next_action — Öğrencinin bir sonraki denemede somut olarak neyi değiştirmesi gerektiği.
5. direct_solution_given — boolean; tam çözüm verilmediyse false.

Varsayılan iskeleleme seviyesi: {config["scaffolding_default"]}
İzin verilen scaffolding_level değerleri: {scaffolding_list}

---

## HATA TAKSONOMİSİ (ZORUNLU)

errorFindings dizisinde her kayıt için error_type YALNIZCA şu listeden seçilmeli:
{taxonomy_list}

severity YALNIZCA şu değerlerden biri olmalı: {severity_list}

Kurallar:
- En az bir gerçek hata varsa uygun error_type seç.
- Anlamlı bir hata tespit edilemiyorsa tek kayıt döndür: error_type = "major_error_not_detected"
- Her kayıtta explanation zorunlu.

CRITICAL JSON RULE: errorFindings dizisi içindeki HER BİR hata objesi istisnasız olarak location_hint ve misconception alanlarını içermek ZORUNDADIR. Eğer bir hata için belirgin bir kavram yanılgısı veya satır bilgisi yoksa, bu anahtarları objeden SİLME; değer olarak 'Belirtilmedi' veya 'Yok' yaz.

---

## RUBRİK ALT PUANLARI (ZORUNLU)

rubricScores objesinde 5 kriterin her biri 1 ile 5 arasında tam sayı olmalı:
- correctness (doğruluk)
- algorithmic_thinking (algoritmik düşünme)
- syntax_and_language_use (sözdizimi ve dil kullanımı)
- code_readability (kod okunabilirliği)
- debugging_awareness (hata ayıklama farkındalığı)

---

## GENEL PUANLAMA (0-100)

96-100: Mükemmel — gereksinimler tam, hata yok, seviyeye uygun en iyi pratikler.
85-95: Çok iyi — küçük stil/optimizasyon fırsatları, ana mantık sağlam.
70-84: İyi/Geçer — çalışıyor ama best-practice veya okunabilirlik eksikleri var.
50-69: Zayıf — çalışıyor ama mantıksal/verimlilik sorunları belirgin.
0-49: Başarısız — çalışmıyor veya ana gereksinimler karşılanmıyor.

Sırf öneri sunmak için puan kırma. Kod kusursuzsa 100 ver.

---

## PEDAGOJİK META VERİ (ZORUNLU)

pedagogicalMetadata objesini şu sabitlerle doldur:
- feedback_strategy: "{FEEDBACK_STRATEGY}"
- prompt_version: "{PROMPT_VERSION}"
- rubric_version: "{RUBRIC_VERSION}"
- student_level: "{student_level}"
- scaffolding_level: uygun seviyeyi seç ({scaffolding_list})
- model_name: kesinlikle "{MODEL_NAME}" yaz (başka model adı kullanma)

---

## JSON ÇIKTI SÖZLEŞMESİ (ZORUNLU)

Yanıt YALNIZCA geçerli JSON olmalı. Şu alanların TAMAMINI doldur:

Zorunlu MVP alanları:
- grade (int, 0-100)
- feedback (string, Türkçe)
- codeQuality (string, Türkçe)
- suggestions (string dizisi, Türkçe)
- unitTests (dizi; her öğe: testName, passed, message)

Zorunlu v0.2 alanları (bu değerlendirmede mutlaka doldur):
- rubricScores (5 alt puan, 1-5)
- errorFindings (en az 1 kayıt)
- socraticFeedback (5 alt alan)
- pedagogicalMetadata (yukarıdaki sabitlerle)

Tüm metin alanları Türkçe olmalı. Sandwich metodu kullan: olumlu → gelişim → teşvik.
"""


def _enrich_pedagogical_metadata(result: GradingResult, student_level: str) -> GradingResult:
    """Ensure pedagogicalMetadata uses central v0.2 constants after LLM response."""
    if result.pedagogicalMetadata is None:
        result.pedagogicalMetadata = PedagogicalMetadata(
            feedback_strategy=FEEDBACK_STRATEGY,
            scaffolding_level="guided_hint",
            student_level=student_level,
            prompt_version=PROMPT_VERSION,
            rubric_version=RUBRIC_VERSION,
            model_name=MODEL_NAME,
        )
    else:
        meta = result.pedagogicalMetadata
        meta.feedback_strategy = FEEDBACK_STRATEGY
        meta.prompt_version = PROMPT_VERSION
        meta.rubric_version = RUBRIC_VERSION
        meta.student_level = student_level
        meta.model_name = MODEL_NAME
    return result

async def grade_submission(request: SubmissionRequest) -> GradingResult:
    if not API_KEY:
         return GradingResult(
            grade=0,
            feedback="API Key yapılandırılmamış. Lütfen sunucu ayarlarını kontrol edin.",
            codeQuality="Bilinmiyor",
            suggestions=["Server .env dosyasını kontrol et"],
            unitTests=[]
        )

    user_prompt = f"""
**Ödev Tanımı:**
{request.assignmentDescription}

**Hedef Dil:**
{request.assignmentLanguage}

**Öğrenci Kodu:**
{request.studentCode}

**Öğrenci Seviyesi:** {request.studentLevel}

Görev: Kodu zihinsel olarak çalıştır, analiz et ve TAM JSON sözleşmesine uygun değerlendirme üret.
Mutlaka doldur: grade, feedback, codeQuality, suggestions, unitTests, rubricScores, errorFindings, socraticFeedback, pedagogicalMetadata.
pedagogicalMetadata içinde prompt_version="{PROMPT_VERSION}", rubric_version="{RUBRIC_VERSION}", feedback_strategy="{FEEDBACK_STRATEGY}", model_name="{MODEL_NAME}" kullan.
"""

    generation_config = {
        "temperature": 0.4,
        "top_p": 1,
        "top_k": 32,
        "max_output_tokens": 8192,
        "response_mime_type": "application/json",
        "response_schema": StrictGradingResult,
    }
    
    # Combined prompt with system instruction
    system_text = get_system_instruction(request.studentLevel)
    final_prompt = f"{system_text}\n\n---\n\n{user_prompt}"

    model = genai.GenerativeModel(
        model_name=MODEL_NAME,
        generation_config=generation_config
    )

    try:
        response = model.generate_content(final_prompt)
        text = response.text.strip()
        print(f"DEBUG: AI Response: {text}")
        
        # Parse JSON response via strict schema, then map to API GradingResult
        result_json = json.loads(text)
        strict_result = StrictGradingResult(**result_json)
        result = _map_strict_to_grading_result(strict_result)
        return _enrich_pedagogical_metadata(result, request.studentLevel)
        
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        return GradingResult(
            grade=0,
            feedback=f"Yapay zeka yanıtı işlenirken bir hata oluştu: {str(e)}",
            codeQuality="Hata",
            suggestions=["Lütfen tekrar gönderin"],
            unitTests=[]
        )
