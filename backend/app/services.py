import os
import json
import asyncio
import re
import hashlib
import time
from google import genai
from google.genai import types as genai_types
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func
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
from .models import (
    User,
    Assignment,
    StudySession,
    Submission,
    Evaluation,
    InteractionEvent,
)
from .auth import get_password_hash

load_dotenv()
import io
from .study_config import SUBMISSION_SOURCE_AI_ERROR
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
PROMPT_VERSION = "cgai_prompt_v0.3"
RUBRIC_VERSION = "cgai_rubric_v0.3"
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
    model_config = ConfigDict(protected_namespaces=())
    feedback_strategy: str
    scaffolding_level: ScaffoldingLevel
    student_level: str
    prompt_version: str
    rubric_version: str
    model_name: str


_PASS_MARKERS = ("(PASSED)", "(PASS)", "(GEÇTİ)", "(BAŞARILI)", "✅")
_FAIL_MARKERS = ("(FAILED)", "(FAIL)", "(KALDI)", "(BAŞARISIZ)", "(HATA)", "❌")


def _normalize_ai_json(data: Any) -> Any:
    """Modelin küçük şema sapmalarını onarır (YAYIN 016 testi, 13.10.2026).

    gemini-3.8-flash bazı yanıtlarda unitTests öğelerini yalnızca testName ile döndürdü
    ("... (FAILED)"), passed/message alanlarını atladı; bu yüzden tüm değerlendirme
    reddediliyor ve öğrenci "tekrar deneyin" alıyordu. Yalnızca ikincil alanlar onarılır;
    rubrik, Sokratik geri bildirim ve meta veri zorunlu kalır (eksikse yine reddedilir).
    """
    if not isinstance(data, dict):
        return data
    tests = data.get("unitTests")
    if isinstance(tests, list):
        fixed = []
        for t in tests:
            if isinstance(t, str):
                t = {"testName": t}
            if not isinstance(t, dict):
                continue
            name = str(t.get("testName") or "Test")
            msg = t.get("message")
            if not isinstance(t.get("passed"), bool):
                upper = f"{name} {msg or ''}".upper()
                if any(m.upper() in upper for m in _FAIL_MARKERS):
                    t["passed"] = False
                elif any(m.upper() in upper for m in _PASS_MARKERS):
                    t["passed"] = True
                else:
                    t["passed"] = False
            if not isinstance(msg, str):
                t["message"] = ""
            t["testName"] = name
            fixed.append(t)
        data["unitTests"] = fixed
    elif tests is None:
        data["unitTests"] = []
    if not isinstance(data.get("suggestions"), list):
        data["suggestions"] = []
    findings = data.get("errorFindings")
    if isinstance(findings, list):
        for f in findings:
            if isinstance(f, dict):
                for k in ("location_hint", "misconception", "explanation"):
                    if not isinstance(f.get(k), str):
                        f[k] = ""
    for k in ("feedback", "codeQuality"):
        if not isinstance(data.get(k), str):
            data[k] = ""
    return data


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


def _calculate_grade_from_rubric(scores: StrictRubricScores) -> int:
    """Deterministic grade from rubric sub-scores: (sum / 25) * 100."""
    total = (
        scores.correctness
        + scores.algorithmic_thinking
        + scores.syntax_and_language_use
        + scores.code_readability
        + scores.debugging_awareness
    )
    return round((total / 25) * 100)


def _map_strict_to_grading_result(strict: StrictGradingResult) -> GradingResult:
    """Map Gemini strict output to API GradingResult (Faz 0 backward-compatible shape)."""
    calculated_grade = _calculate_grade_from_rubric(strict.rubricScores)
    return GradingResult(
        grade=calculated_grade,
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
# YAYIN 016 (T3): varsayılan kararlı sürüm. gemini-3-flash-preview Aralık 2025 önizlemesiydi;
# gemini-3.8-flash için Google'ın otomatik sürüm yönlendirmesi yok (sürüm dondurmaya uygun).
MODEL_NAME = (os.getenv("GEMINI_MODEL_NAME") or "gemini-3.8-flash").strip()
try:
    LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.4"))
except ValueError:
    LLM_TEMPERATURE = 0.4
# Gemini 3.x düşünme düzeyi (low/medium/high; 3.6'da minimal de var). Varsayılan "low":
# 13.10.2026 yük testinde varsayılan (medium) düzeyde yanıtlar 13-68 sn sürdü.
LLM_THINKING_LEVEL = (os.getenv("LLM_THINKING_LEVEL") or "low").strip().upper()
try:
    LLM_MAX_OUTPUT_TOKENS = int(os.getenv("LLM_MAX_OUTPUT_TOKENS", "16384"))
except ValueError:
    LLM_MAX_OUTPUT_TOKENS = 16384
try:
    # Bozuk/eksik JSON gelirse aynı istek en fazla bu kadar kez yeniden denenir.
    LLM_RETRIES = max(0, int(os.getenv("LLM_RETRIES", "1")))
except ValueError:
    LLM_RETRIES = 1

print(f"CodeGradeAI: değerlendirme modeli = {MODEL_NAME} | sıcaklık = {LLM_TEMPERATURE} | düşünme = {LLM_THINKING_LEVEL} | yeniden deneme = {LLM_RETRIES}")

if not API_KEY:
    print("WARNING: API Key (GEMINI_API_KEY or GOOGLE_API_KEY) is not set in environment variables.")

_CLIENT = None


def _get_client():
    """google-genai istemcisi (google-generativeai 0.7.2'nin desteği 30.11.2025'te bitti;
    yeni modellere yanıt şemasını güvenilir iletmiyordu: 13.10.2026 yük testinde 6/10 hata)."""
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = genai.Client(api_key=API_KEY)
    return _CLIENT


def _generation_config() -> "genai_types.GenerateContentConfig":
    kwargs = dict(
        temperature=LLM_TEMPERATURE,
        top_p=1,
        max_output_tokens=LLM_MAX_OUTPUT_TOKENS,
        response_mime_type="application/json",
        response_schema=StrictGradingResult,
    )
    if LLM_THINKING_LEVEL and LLM_THINKING_LEVEL != "DEFAULT":
        kwargs["thinking_config"] = genai_types.ThinkingConfig(thinking_level=LLM_THINKING_LEVEL)
    return genai_types.GenerateContentConfig(**kwargs)


async def _call_model(prompt: str) -> Tuple[str, Dict[str, Any]]:
    """Modeli çağırır; (yanıt metni, token kullanımı) döndürür. Testlerde taklit edilir."""
    response = await _get_client().aio.models.generate_content(
        model=MODEL_NAME, contents=prompt, config=_generation_config()
    )
    usage: Dict[str, Any] = {}
    um = getattr(response, "usage_metadata", None)
    if um is not None:
        for key in ("prompt_token_count", "candidates_token_count", "thoughts_token_count", "total_token_count"):
            val = getattr(um, key, None)
            if val is not None:
                usage[key] = val
    try:
        fr = response.candidates[0].finish_reason
        usage["finish_reason"] = str(getattr(fr, "name", fr))
    except Exception:
        pass
    return (response.text or "").strip(), usage


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

NO DIRECT CODE IN HINTS: progressive_hint ve next_action alanlarında KESİNLİKLE kod, fonksiyon adı (örn: range()) veya matematiksel operatör (örn: %, ==) kullanma. Sadece kavramsal ve mantıksal yönlendirme yap.

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

DEBUGGING AWARENESS: debugging_awareness (hata ayıklama farkındalığı) kriterini, ödev tanımının kapsamı içinde kalarak 1 ile 5 arasında puanla. Ödev tanımı girdi denetimini veya hata yakalamayı kapsam dışı bırakıyorsa bunların yokluğu için puan düşürme; bu durumda öğrencinin verilen aralıktaki sınır değerleri (ör. 0, en büyük değer) doğru işleyip işlemediğine, doğru tür ve bölme seçimine, kontrol eşitliği veya test notu gibi doğrulama izlerine bak. Kapsam kısıtı yoksa sınır değerleri düşünme, istenmeyen girişleri kontrol etme ve kodu çökmeye karşı koruma çabasını değerlendir.

---

## ÖDEV KAPSAMI (ZORUNLU)

Ödev tanımı bu haftanın kapsamını belirler ve rubrikten önce gelir.
1. Ödev tanımında kapsam dışı veya "beklenmiyor" denilen yapıları (ör. koşul, döngü, dizi, metot, TryParse, try-catch, girdi denetimi) eksik sayma, puan düşürme ve geri bildirimde, ipuçlarında ya da önerilerde önerme.
2. Ödev tanımında belirtilen geçerli girdi varsayımlarını kabul et; aralık dışı veya biçimsiz girdi için hata bulgusu üretme.
3. Ondalık ayıracının kültüre göre nokta veya virgül görünmesini (ör. 60,33 ve 60.33) hata sayma.
4. Ödev tanımında belirtilen dil sürümüne uy (ör. C# 5); daha yeni dil özelliklerini önerme.

---

## GENEL PUAN (grade) — SUNUCU TARAFINDAN HESAPLANIR

grade alanı JSON şemasında zorunludur ancak nihai puan sunucuda rubricScores üzerinden hesaplanır.
Formül: (5 kriterin toplamı / 25) × 100. Örnek: tüm kriterler 5 ise 100; toplam 15 ise 60 puan.
Sen yalnızca rubricScores değerlerini nesnel ve tutarlı doldur. grade alanına 0 yazabilirsin; sunucu rubrikten hesaplayacaktır.
Subjektif genel puan tahmini yapma; puanlama otoritesi rubrik alt puanlarıdır.

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
- grade (int, 0-100; sunucu rubrikten hesaplar — 0 yazabilirsin)
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


def sanitize_json(raw_text: str) -> str:
    """
    Gemini yanıtı response_mime_type=application/json istenmiş olsa da bazen
    ```json ... ``` markdown code fence'i içinde veya öncesinde/sonrasında
    ekstra metinle, ya da nesne/dizi kapanışından hemen önce fazladan bir
    virgülle (trailing comma) dönebilir. json.loads'tan önce bu artıkları
    güvenle temizler; hiçbir durumda exception fırlatmaz (temizlenemeyen
    girdi olduğu gibi döner, çağıran taraf json.loads hatasını zaten yakalar).
    """
    if not raw_text:
        return raw_text

    cleaned = raw_text.strip()

    # ```json ... ``` veya ``` ... ``` code fence'lerini kaldır.
    fence_match = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned, re.DOTALL | re.IGNORECASE)
    if fence_match:
        cleaned = fence_match.group(1).strip()

    # Modelin JSON'dan önce/sonra eklediği açıklama metinlerine karşı ek güvenlik:
    # ilk '{' ile son '}' arasındaki bölümü al.
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        cleaned = cleaned[first_brace:last_brace + 1]

    # Trailing comma toleransı: `..., }` veya `..., ]` standart JSON'da geçersizdir
    # ama bazı model yanıtlarında görülebilir — ayrıştırmadan önce güvenle kaldırılır.
    cleaned = re.sub(r",(\s*[}\]])", r"\1", cleaned)

    return cleaned.strip()


def _fallback_grading_result(feedback: str, suggestions: Optional[List[str]] = None) -> GradingResult:
    """
    AI yanıtı (token limiti, bozuk/eksik JSON, şema hatası, API hatası vb. nedenlerle)
    hiçbir şekilde işlenemediğinde frontend'in 500/parse hatasıyla çökmemesi için
    döndürülen güvenli varsayılan sonuç. v0.2 alanları (rubricScores, errorFindings,
    socraticFeedback, pedagogicalMetadata) kasıtlı olarak None/null bırakılır —
    GradingResult şemasında bu alanlar Optional olduğundan frontend bunları güvenle
    gizler/atlar.
    """
    return GradingResult(
        grade=0,
        feedback=feedback,
        codeQuality="Bilinmiyor",
        suggestions=suggestions or ["Lütfen kodunuzu tekrar gönderin."],
        unitTests=[],
        rubricScores=None,
        errorFindings=None,
        socraticFeedback=None,
        pedagogicalMetadata=None,
    )


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

async def grade_submission(request: SubmissionRequest, usage: Optional[Dict[str, Any]] = None) -> GradingResult:
    """usage verilirse token kullanımı ve deneme sayısı içine yazılır (maliyet ve rapor için)."""
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

    # Combined prompt with system instruction
    system_text = get_system_instruction(request.studentLevel)
    final_prompt = f"{system_text}\n\n---\n\n{user_prompt}"

    # Yanıtı modelden al; bozuk JSON veya şema dışı yanıtta LLM_RETRIES kez yeniden dene.
    last_problem = ""
    for attempt in range(1 + LLM_RETRIES):
        try:
            text, call_usage = await _call_model(final_prompt)
        except Exception as e:
            # Ağ/API seviyesindeki hatalar (kota, zaman aşımı vb.) yeniden denenmez; 500 fırlatılmaz.
            print(f"Error calling Gemini: {e}")
            return _fallback_grading_result(
                "Yapay zeka servisiyle iletişimde bir sorun oluştu, lütfen daha sonra tekrar deneyin."
            )
        if usage is not None:
            for k, v in call_usage.items():
                if isinstance(v, (int, float)):
                    usage[k] = usage.get(k, 0) + v
                else:
                    usage[k] = v
            usage["attempts"] = attempt + 1

        cleaned_text = sanitize_json(text)
        try:
            result_json = json.loads(cleaned_text)
        except json.JSONDecodeError as parse_error:
            last_problem = "Yapay zeka yanıtı eksik ya da bozuk oluşturuldu, lütfen kodunuzu tekrar gönderin."
            print(f"WARNING: AI JSON ayrıştırma hatası (deneme {attempt + 1}, {call_usage.get('finish_reason')}): {parse_error}")
            continue
        try:
            strict_result = StrictGradingResult(**_normalize_ai_json(result_json))
        except Exception as validation_error:
            last_problem = "Yapay zeka yanıtı beklenen formatta oluşturulamadı, lütfen kodunuzu tekrar gönderin."
            print(f"WARNING: AI yanıtı şema doğrulamasından geçemedi (deneme {attempt + 1}): {validation_error}")
            continue

        result = _map_strict_to_grading_result(strict_result)
        return _enrich_pedagogical_metadata(result, request.studentLevel)

    return _fallback_grading_result(last_problem or "Değerlendirme yapılamadı, lütfen tekrar deneyin.")


# --- Faz 3: Sokratik Akış PostgreSQL Kalıcılığı ---

ACTIVE_SESSION_STATUSES = {
    "SESSION_CREATED",
    "INITIAL_ANALYSIS",
    "AWARENESS_SHOWN",
    "AWAITING_STUDENT_RESPONSE",
    "GUIDING_HINT_SHOWN",
    "STRATEGIC_HINT_SHOWN",
    "NEAR_SOLUTION_SHOWN",
    "ERROR_RESOLVED",
    "FULL_REPORT_UNLOCKED",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _code_hash(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _line_count(code: str) -> int:
    return len(code.splitlines()) if code else 0


def _next_event_sequence(db: Session, session_id) -> int:
    last_seq = (
        db.query(func.max(InteractionEvent.event_sequence))
        .filter(InteractionEvent.session_id == session_id)
        .scalar()
    )
    return (last_seq or 0) + 1


def _log_interaction_event(
    db: Session,
    session: StudySession,
    event_type: str,
    *,
    submission_id=None,
    evaluation_id=None,
    from_status: Optional[str] = None,
    to_status: Optional[str] = None,
    from_scaffolding_level: Optional[str] = None,
    to_scaffolding_level: Optional[str] = None,
    actor_type: str = "system",
    actor_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> InteractionEvent:
    event = InteractionEvent(
        session_id=session.session_id,
        event_type=event_type,
        event_sequence=_next_event_sequence(db, session.session_id),
        submission_id=submission_id,
        evaluation_id=evaluation_id,
        from_status=from_status,
        to_status=to_status,
        from_scaffolding_level=from_scaffolding_level,
        to_scaffolding_level=to_scaffolding_level,
        actor_type=actor_type,
        actor_id=actor_id,
        metadata_json=metadata or {},
        occurred_at=_utcnow(),
    )
    db.add(event)
    return event


def _get_or_create_study_session(
    db: Session,
    student: User,
    assignment_id: int,
    student_level: str,
    consent: bool,
) -> Tuple[Optional[StudySession], Optional[Assignment]]:
    assignment = (
        db.query(Assignment)
        .filter(
            Assignment.id == assignment_id,
            Assignment.organization_id == student.organization_id,
        )
        .first()
    )
    if not assignment:
        return None, None

    session = (
        db.query(StudySession)
        .filter(
            StudySession.student_id == student.id,
            StudySession.assignment_id == assignment_id,
            StudySession.session_status.in_(ACTIVE_SESSION_STATUSES),
        )
        .first()
    )

    now = _utcnow()
    if session:
        session.last_activity_at = now
        session.updated_at = now
        return session, assignment

    session = StudySession(
        student_id=student.id,
        assignment_id=assignment_id,
        organization_id=student.organization_id,
        session_status="SESSION_CREATED",
        student_level=student_level,
        consent_recorded=consent,
        started_at=now,
        last_activity_at=now,
        attempt_count=0,
    )
    db.add(session)
    db.flush()

    _log_interaction_event(
        db,
        session,
        "session_started",
        actor_type="student",
        actor_id=student.id,
        to_status="SESSION_CREATED",
        metadata={
            "assignment_id": assignment_id,
            "student_level": student_level,
            "research_consent": consent,
        },
    )
    return session, assignment


def prepare_submission_for_grading(
    db: Session,
    student: User,
    request: SubmissionRequest,
    feedback_mode: Optional[str] = None,
) -> Tuple[Optional[StudySession], Optional[Submission]]:
    """Teslim kaydı ve submission_created olayını AI çağrısından önce oluşturur."""
    if not request.assignmentId:
        return None, None

    session, assignment = _get_or_create_study_session(
        db,
        student,
        request.assignmentId,
        request.studentLevel,
        bool(request.researchConsent),
    )
    if not session or not assignment:
        return None, None

    attempt_no = session.attempt_count + 1
    previous_status = session.session_status
    now = _utcnow()

    submission = Submission(
        user_id=student.id,
        assignment_id=assignment.id,
        session_id=session.session_id,
        code_content=request.studentCode,
        attempt_no=attempt_no,
        code_hash=_code_hash(request.studentCode),
        code_language=request.assignmentLanguage,
        submission_source="initial" if attempt_no == 1 else "revision",
        is_final=False,
        submitted_at=now,
    )
    db.add(submission)

    session.attempt_count = attempt_no
    session.session_status = "INITIAL_ANALYSIS"
    session.last_activity_at = now
    session.updated_at = now

    db.flush()

    _log_interaction_event(
        db,
        session,
        "submission_created",
        submission_id=submission.submission_id,
        from_status=previous_status,
        to_status="INITIAL_ANALYSIS",
        actor_type="student",
        actor_id=student.id,
        metadata={
            "submission_id": str(submission.submission_id),
            "attempt_no": attempt_no,
            "code_hash": submission.code_hash,
            "line_count": _line_count(request.studentCode),
            "feedback_mode": feedback_mode,
            "class_code": student.class_code,
        },
    )
    db.commit()
    db.refresh(session)
    db.refresh(submission)
    return session, submission


def _determine_parse_status(result: GradingResult) -> str:
    if result.pedagogicalMetadata and result.rubricScores and result.errorFindings:
        return "success"
    if result.grade == 0 and "hata" in result.feedback.lower():
        return "failed"
    return "partial"


def finalize_grading_persistence(
    db: Session,
    session: StudySession,
    submission: Submission,
    result: GradingResult,
    latency_ms: int,
    student: User,
    usage: Optional[Dict[str, Any]] = None,
) -> Optional[Evaluation]:
    """AI değerlendirmesini evaluations tablosuna yazar ve analysis_completed olayını loglar."""
    grading_json = result.model_dump(mode="json")
    meta = result.pedagogicalMetadata
    socratic = result.socraticFeedback
    error_types = [e.error_type for e in (result.errorFindings or [])]
    parse_status = _determine_parse_status(result)

    previous_status = session.session_status
    scaffolding_level = meta.scaffolding_level if meta else "awareness"
    now = _utcnow()

    evaluation = Evaluation(
        submission_id=submission.submission_id,
        session_id=session.session_id,
        grading_result_json=grading_json,
        grade=result.grade,
        scaffolding_level=scaffolding_level,
        feedback_strategy=meta.feedback_strategy if meta else FEEDBACK_STRATEGY,
        prompt_version=meta.prompt_version if meta else PROMPT_VERSION,
        rubric_version=meta.rubric_version if meta else RUBRIC_VERSION,
        model_name=meta.model_name if meta else MODEL_NAME,
        direct_solution_given=socratic.direct_solution_given if socratic else False,
        error_types_json=error_types,
        rubric_scores_json=result.rubricScores.model_dump(mode="json") if result.rubricScores else None,
        socratic_feedback_json=socratic.model_dump(mode="json") if socratic else None,
        parse_status=parse_status,
        latency_ms=latency_ms,
        evaluated_at=now,
    )
    db.add(evaluation)

    session.session_status = "AWARENESS_SHOWN"
    session.current_scaffolding_level = scaffolding_level
    session.max_scaffolding_level_reached = scaffolding_level
    session.last_activity_at = now
    session.updated_at = now

    submission.grading_result = grading_json

    db.flush()

    event_type = (
        "initial_analysis_completed" if submission.attempt_no == 1 else "analysis_completed"
    )
    _log_interaction_event(
        db,
        session,
        event_type,
        submission_id=submission.submission_id,
        evaluation_id=evaluation.evaluation_id,
        from_status=previous_status,
        to_status="AWARENESS_SHOWN",
        to_scaffolding_level=scaffolding_level,
        actor_type="ai",
        metadata={
            "evaluation_id": str(evaluation.evaluation_id),
            "attempt_no": submission.attempt_no,
            "grade": result.grade,
            "error_count": len(result.errorFindings or []),
            "latency_ms": latency_ms,
            "parse_status": parse_status,
            "temperature": LLM_TEMPERATURE,
            "model_name": MODEL_NAME,
            "thinking_level": LLM_THINKING_LEVEL,
            "usage": usage or {},
        },
    )

    if socratic and socratic.direct_solution_given:
        _log_interaction_event(
            db,
            session,
            "direct_solution_violation_detected",
            submission_id=submission.submission_id,
            evaluation_id=evaluation.evaluation_id,
            actor_type="system",
            metadata={
                "evaluation_id": str(evaluation.evaluation_id),
                "scaffolding_level": scaffolding_level,
                "prompt_version": evaluation.prompt_version,
            },
        )

    db.commit()
    db.refresh(evaluation)
    return evaluation


def _is_ai_failure(result: GradingResult) -> bool:
    """_fallback_grading_result çıktısı: AI çağrısı/ayrıştırma başarısız."""
    return result.pedagogicalMetadata is None and result.socraticFeedback is None and result.grade == 0


async def grade_submission_with_persistence(
    db: Session,
    request: SubmissionRequest,
    student: Optional[User] = None,
    feedback_mode: Optional[str] = None,
) -> Tuple[GradingResult, Optional[Submission]]:
    """AI değerlendirmesi yapar; bağlam varsa PostgreSQL'e kalıcı kaydeder.

    Dönüş: (tam değerlendirme, oluşturulan teslim veya None). Öğrenciye gösterilecek
    süzme çağıran tarafta yapılır; burada her zaman tam sonuç saklanır.
    """
    session: Optional[StudySession] = None
    submission: Optional[Submission] = None

    if student and request.assignmentId:
        session, submission = prepare_submission_for_grading(
            db, student, request, feedback_mode=feedback_mode
        )

    start = time.perf_counter()
    usage: Dict[str, Any] = {}
    result = await grade_submission(request, usage=usage)
    latency_ms = int((time.perf_counter() - start) * 1000)

    if session and submission and student:
        finalize_grading_persistence(db, session, submission, result, latency_ms, student, usage=usage)
        if _is_ai_failure(result):
            submission.submission_source = SUBMISSION_SOURCE_AI_ERROR
            _log_interaction_event(
                db,
                session,
                "analysis_failed",
                submission_id=submission.submission_id,
                actor_type="system",
                metadata={"attempt_no": submission.attempt_no, "latency_ms": latency_ms},
            )
            db.commit()
            db.refresh(submission)

    return result, submission
