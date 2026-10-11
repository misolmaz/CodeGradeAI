"""YAYIN 016 çalışma ayarları (ortam değişkenleriyle yönetilir; veritabanı değişikliği gerektirmez).

Ortam değişkenleri (backend/.env veya Coolify ortam ayarları):
  GRADE_ONLY_CLASS_CODES       Virgülle ayrılmış sınıf kodları. Bu sınıflardaki öğrenciler
                               yalnızca puanı görür (kontrol koşulu). Diğer tüm öğrenciler
                               Sokratik geri bildirim alır. Örn: "1A" (büyük/küçük harf duyarsız).
  GAMIFICATION_ENABLED         "false" ise liderlik tablosu ve rozetler kapanır. Varsayılan: true.
  MAX_ATTEMPTS_PER_ASSIGNMENT  Bir ödev için değerlendirilen en fazla teslim sayısı (iki grupta aynı).
                               Varsayılan: 2 (ilk teslim + 1 düzeltme; mevcut arayüz davranışı).
  SUCCESS_GRADE_THRESHOLD      Bu puan ve üzeri alındığında ödev için yeni teslim kabul edilmez.
                               Varsayılan: 90 (mevcut arayüz davranışı).

Değerler her çağrıda okunur; .env değişikliği yeniden başlatmayla devreye girer.
"""
import os
from typing import Any, Dict, Optional

FEEDBACK_MODE_SOCRATIC = "socratic"
FEEDBACK_MODE_GRADE_ONLY = "grade_only"

# Değerlendirme çağrısı başarısız olduğunda (AI hatası) oluşan teslimler bu kaynakla
# işaretlenir: logda kalır, deneme hakkından düşülmez, öğrenci listesinde görünmez.
SUBMISSION_SOURCE_AI_ERROR = "ai_error"
# Öğretmenin "sildiği" araştırma teslimleri fiziksel olarak silinmez (evaluations ve
# interaction_events kayıtları ona bağlıdır); bu kaynakla işaretlenip listeden ve
# deneme sayısından çıkarılır.
SUBMISSION_SOURCE_TEACHER_REMOVED = "teacher_removed"
# Listede gösterilmeyen ve deneme hakkından düşülmeyen teslim kaynakları.
EXCLUDED_SUBMISSION_SOURCES = (SUBMISSION_SOURCE_AI_ERROR, SUBMISSION_SOURCE_TEACHER_REMOVED)


def visible_submission_clause():
    """SQL koşulu: listede/analizde sayılan teslimler (AI hatası ve öğretmence kaldırılanlar hariç)."""
    from sqlalchemy import or_
    from .models import Submission

    return or_(
        Submission.submission_source.is_(None),
        Submission.submission_source.notin_(EXCLUDED_SUBMISSION_SOURCES),
    )


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on", "evet")


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    try:
        return int(raw) if raw is not None and raw.strip() else default
    except ValueError:
        return default


def grade_only_class_codes() -> set:
    raw = os.getenv("GRADE_ONLY_CLASS_CODES", "")
    return {c.strip().upper() for c in raw.split(",") if c.strip()}


def gamification_enabled() -> bool:
    return _env_bool("GAMIFICATION_ENABLED", True)


def max_attempts_per_assignment() -> int:
    return max(1, _env_int("MAX_ATTEMPTS_PER_ASSIGNMENT", 2))


def max_code_chars() -> int:
    """Teslim edilen kodun en fazla uzunluğu (MAX_CODE_CHARS, varsayılan 20000). API maliyetini ve
    aşırı uzun girdiyle modeli bozma girişimlerini sınırlar."""
    return max(1000, _env_int("MAX_CODE_CHARS", 20000))


def success_grade_threshold() -> int:
    return _env_int("SUCCESS_GRADE_THRESHOLD", 90)


def feedback_mode_for(user: Any) -> str:
    """Öğrencinin çalışma koşulu. Öğretmen/yönetici her zaman tam raporu görür."""
    if getattr(user, "role", None) != "student":
        return FEEDBACK_MODE_SOCRATIC
    class_code = (getattr(user, "class_code", None) or "").strip().upper()
    if class_code and class_code in grade_only_class_codes():
        return FEEDBACK_MODE_GRADE_ONLY
    return FEEDBACK_MODE_SOCRATIC


def public_config() -> Dict[str, Any]:
    """Arayüzün ihtiyaç duyduğu, koşul bilgisi içermeyen ayarlar."""
    return {
        "gamification_enabled": gamification_enabled(),
        "max_attempts": max_attempts_per_assignment(),
        "success_threshold": success_grade_threshold(),
    }


def student_view_of_grading_result(
    grading_result: Optional[Dict[str, Any]], mode: str
) -> Optional[Dict[str, Any]]:
    """Öğrenciye dönen değerlendirme. grade_only koşulunda yalnızca puan kalır.

    Süzme sunucu tarafında yapılır; tam değerlendirme veritabanında (submissions ve
    evaluations) değişmeden saklanır.
    """
    if not isinstance(grading_result, dict):
        return grading_result
    if mode != FEEDBACK_MODE_GRADE_ONLY:
        out = dict(grading_result)
        out["feedbackMode"] = FEEDBACK_MODE_SOCRATIC
        return out
    return {
        "grade": grading_result.get("grade", 0),
        "feedback": "",
        "codeQuality": "",
        "suggestions": [],
        "unitTests": [],
        "rubricScores": None,
        "errorFindings": None,
        "socraticFeedback": None,
        "pedagogicalMetadata": None,
        "feedbackMode": FEEDBACK_MODE_GRADE_ONLY,
    }
