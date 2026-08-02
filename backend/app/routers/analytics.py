"""EduInsight öğretmen analitiği (Faz 5).

Öğretmenin sınıfın genel durumunu tek ekrandan izleyebilmesi için
submissions + evaluations + assignments verilerini birleştirip özetler.
Yeni bir tablo eklemez; mevcut kayıtları okuma-hesaplama katmanıdır.
"""

import json
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Assignment, Submission, User
from .users import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

# Bir denemenin "başarılı" sayıldığı puan eşiği. Sokratik etkiyi ölçen
# "kaçıncı denemede başarılı oldu" metriği bu eşiğe göre hesaplanır.
SUCCESS_THRESHOLD = 70

# Hata taksonomisinin (schemas.ErrorType) öğretmene gösterilecek Türkçe karşılıkları.
ERROR_TYPE_LABELS: Dict[str, str] = {
    "syntax_error": "Sözdizimi Hatası",
    "runtime_error": "Çalışma Zamanı Hatası",
    "logic_error": "Mantık Hatası",
    "conceptual_error": "Kavramsal Hata",
    "boundary_case_error": "Sınır Durumu Hatası",
    "data_type_error": "Veri Tipi Hatası",
    "loop_error": "Döngü Hatası",
    "conditional_error": "Koşul Hatası",
    "function_structure_error": "Fonksiyon Yapısı Hatası",
    "input_output_format_error": "Girdi/Çıktı Format Hatası",
    "code_readability_issue": "Okunabilirlik Sorunu",
    "incomplete_solution": "Eksik Çözüm",
    "major_error_not_detected": "Belirgin Hata Yok",
}

# AI "anlamlı hata bulamadım" dediğinde bu türü döndürür; kavram yanılgısı
# dağılımında gürültü yaratmaması için listeden çıkarılır.
NEUTRAL_ERROR_TYPE = "major_error_not_detected"

SCORE_BUCKETS = [
    ("0-39", 0, 39),
    ("40-54", 40, 54),
    ("55-69", 55, 69),
    ("70-84", 70, 84),
    ("85-100", 85, 100),
]


# --- Response şemaları ---

class KpiSummary(BaseModel):
    class_average: float
    total_submissions: int
    graded_submissions: int
    active_assignments: int
    total_assignments: int
    total_students: int
    participating_students: int
    socratic_support_rate: float
    success_rate: float
    average_attempts: float
    first_attempt_success_rate: float
    average_improvement: float


class ScoreBucket(BaseModel):
    label: str
    count: int
    share: float


class MisconceptionItem(BaseModel):
    error_type: str
    label: str
    count: int
    student_count: int
    share: float
    severity_counts: Dict[str, int]
    sample_misconceptions: List[str]


class StudentProgressItem(BaseModel):
    user_id: int
    student_number: str | None = None
    full_name: str | None = None
    class_code: str | None = None
    avatar_url: str | None = None
    submission_count: int
    assignment_count: int
    average_score: float
    best_score: int
    first_score: int | None = None
    latest_score: int | None = None
    improvement: float
    attempts_to_success: float | None = None
    solved_assignments: int
    top_error_type: str | None = None
    top_error_label: str | None = None
    last_submitted_at: datetime | None = None


class AssignmentPerformanceItem(BaseModel):
    assignment_id: int
    title: str
    status: str | None = None
    submission_count: int
    student_count: int
    average_score: float
    success_rate: float


class TeacherSummary(BaseModel):
    generated_at: datetime
    class_code: str | None = None
    class_options: List[str]
    kpi: KpiSummary
    score_distribution: List[ScoreBucket]
    misconceptions: List[MisconceptionItem]
    students: List[StudentProgressItem]
    assignments: List[AssignmentPerformanceItem]


# --- Yardımcılar ---

def _grading_payload(submission: Submission) -> Dict[str, Any]:
    """Teslimin AI değerlendirme sözlüğünü döndürür.

    Faz 3 öncesi kayıtlar JSON string olarak saklanmış olabilir; Sokratik akış
    üzerinden gelen kayıtlarda ise gerçek sonuç evaluations tablosundadır.
    """
    raw = submission.grading_result
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            raw = None

    if not isinstance(raw, dict) or not raw:
        evaluation = submission.evaluation
        if evaluation is not None and isinstance(evaluation.grading_result_json, dict):
            raw = evaluation.grading_result_json

    return raw if isinstance(raw, dict) else {}


def _extract_grade(payload: Dict[str, Any], submission: Submission) -> int:
    value = payload.get("grade")
    if value is None and submission.evaluation is not None:
        value = submission.evaluation.grade
    try:
        grade = int(value)
    except (TypeError, ValueError):
        return 0
    return max(0, min(100, grade))


def _error_findings(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    findings = payload.get("errorFindings") or payload.get("error_findings")
    if not isinstance(findings, list):
        return []
    return [item for item in findings if isinstance(item, dict)]


def _percent(part: float, whole: float) -> float:
    if not whole:
        return 0.0
    return round((part / whole) * 100, 1)


def _mean(values: List[float]) -> float:
    if not values:
        return 0.0
    return round(sum(values) / len(values), 1)


@router.get("/teacher-summary", response_model=TeacherSummary)
async def get_teacher_summary(
    class_code: Optional[str] = Query(None, description="Yalnızca bu sınıfın öğrencilerini kapsa"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Öğretmenin kendi organizasyonu için sınıf geneli analitik özeti."""
    if current_user.role not in ("teacher", "superadmin"):
        raise HTTPException(status_code=403, detail="Bu panele erişim yetkiniz yok")

    org_id = current_user.organization_id

    all_students = (
        db.query(User)
        .filter(User.role == "student", User.organization_id == org_id)
        .all()
    )
    class_options = sorted({s.class_code for s in all_students if s.class_code})

    students = [s for s in all_students if not class_code or s.class_code == class_code]
    student_ids = [s.id for s in students]

    assignments = db.query(Assignment).filter(Assignment.organization_id == org_id).all()
    assignment_map = {a.id: a for a in assignments}

    submissions: List[Submission] = []
    if student_ids:
        submissions = (
            db.query(Submission)
            .options(joinedload(Submission.evaluation))
            .filter(Submission.user_id.in_(student_ids))
            .order_by(Submission.submitted_at.asc(), Submission.id.asc())
            .all()
        )

    # Teslimleri tek geçişte normalize et: puan, hata bulguları, Sokratik bayrak.
    records: List[Dict[str, Any]] = []
    for sub in submissions:
        payload = _grading_payload(sub)
        socratic = payload.get("socraticFeedback")
        socratic = socratic if isinstance(socratic, dict) else None
        records.append({
            "id": sub.id,
            "user_id": sub.user_id,
            "assignment_id": sub.assignment_id,
            "submitted_at": sub.submitted_at,
            "graded": bool(payload),
            "grade": _extract_grade(payload, sub),
            "findings": _error_findings(payload),
            "has_socratic": socratic is not None,
            "direct_solution_given": bool(socratic.get("direct_solution_given")) if socratic else False,
        })

    graded_records = [r for r in records if r["graded"]]

    # --- Deneme grupları: (öğrenci, ödev) çifti başına kronolojik denemeler ---
    attempts_by_pair: Dict[Any, List[Dict[str, Any]]] = defaultdict(list)
    for rec in graded_records:
        pair_key = (rec["user_id"], rec["assignment_id"] if rec["assignment_id"] is not None else f"solo-{rec['id']}")
        attempts_by_pair[pair_key].append(rec)

    # Sınıf ortalaması, öğrencinin her ödevdeki en iyi denemesi üzerinden hesaplanır
    # (liderlik tablosuyla aynı mantık) — böylece çok deneyen öğrenci cezalandırılmaz.
    best_scores = [max(r["grade"] for r in attempts) for attempts in attempts_by_pair.values()]
    class_average = _mean(best_scores)
    success_rate = _percent(sum(1 for s in best_scores if s >= SUCCESS_THRESHOLD), len(best_scores))

    attempt_counts = [len(attempts) for attempts in attempts_by_pair.values()]
    average_attempts = _mean(attempt_counts)

    first_attempt_successes = sum(
        1 for attempts in attempts_by_pair.values() if attempts[0]["grade"] >= SUCCESS_THRESHOLD
    )
    first_attempt_success_rate = _percent(first_attempt_successes, len(attempts_by_pair))

    # Sokratik etki: ilk denemeden en iyi denemeye puan kazancı (yalnızca tekrar denenen ödevler).
    improvements = [
        max(r["grade"] for r in attempts) - attempts[0]["grade"]
        for attempts in attempts_by_pair.values()
        if len(attempts) > 1
    ]
    average_improvement = _mean(improvements)

    # Sokratik destek oranı: doğrudan çözüm vermeden iskeleleme ile yönlendirilen
    # değerlendirmelerin payı — pedagojik sözleşmeye uyumun göstergesi.
    socratic_supported = sum(
        1 for r in graded_records if r["has_socratic"] and not r["direct_solution_given"]
    )
    socratic_support_rate = _percent(socratic_supported, len(graded_records))

    active_assignments = sum(1 for a in assignments if (a.status or "active") == "active")

    kpi = KpiSummary(
        class_average=class_average,
        total_submissions=len(records),
        graded_submissions=len(graded_records),
        active_assignments=active_assignments,
        total_assignments=len(assignments),
        total_students=len(students),
        participating_students=len({r["user_id"] for r in records}),
        socratic_support_rate=socratic_support_rate,
        success_rate=success_rate,
        average_attempts=average_attempts,
        first_attempt_success_rate=first_attempt_success_rate,
        average_improvement=average_improvement,
    )

    # --- Puan dağılımı ---
    score_distribution: List[ScoreBucket] = []
    for label, low, high in SCORE_BUCKETS:
        count = sum(1 for s in best_scores if low <= s <= high)
        score_distribution.append(
            ScoreBucket(label=label, count=count, share=_percent(count, len(best_scores)))
        )

    # --- Kavram yanılgısı / hata dağılımı ---
    error_counts: Dict[str, int] = defaultdict(int)
    error_students: Dict[str, set] = defaultdict(set)
    error_severities: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    error_samples: Dict[str, List[str]] = defaultdict(list)

    for rec in graded_records:
        for finding in rec["findings"]:
            error_type = str(finding.get("error_type") or "").strip()
            if not error_type or error_type == NEUTRAL_ERROR_TYPE:
                continue
            error_counts[error_type] += 1
            error_students[error_type].add(rec["user_id"])

            severity = str(finding.get("severity") or "unknown").strip() or "unknown"
            error_severities[error_type][severity] += 1

            misconception = finding.get("misconception")
            if isinstance(misconception, str):
                text = misconception.strip()
                if (
                    text
                    and text.lower() not in {"yok", "belirtilmedi", "none", "-"}
                    and text not in error_samples[error_type]
                    and len(error_samples[error_type]) < 3
                ):
                    error_samples[error_type].append(text)

    total_findings = sum(error_counts.values())
    misconceptions = [
        MisconceptionItem(
            error_type=error_type,
            label=ERROR_TYPE_LABELS.get(error_type, error_type.replace("_", " ").title()),
            count=count,
            student_count=len(error_students[error_type]),
            share=_percent(count, total_findings),
            severity_counts=dict(error_severities[error_type]),
            sample_misconceptions=error_samples[error_type],
        )
        for error_type, count in sorted(error_counts.items(), key=lambda kv: kv[1], reverse=True)
    ]

    # --- Öğrenci gelişim tablosu ---
    records_by_student: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for rec in records:
        records_by_student[rec["user_id"]].append(rec)

    pairs_by_student: Dict[int, List[List[Dict[str, Any]]]] = defaultdict(list)
    for (user_id, _), attempts in attempts_by_pair.items():
        pairs_by_student[user_id].append(attempts)

    student_rows: List[StudentProgressItem] = []
    for student in students:
        own_records = records_by_student.get(student.id, [])
        own_graded = [r for r in own_records if r["graded"]]
        own_pairs = pairs_by_student.get(student.id, [])

        pair_best = [max(r["grade"] for r in attempts) for attempts in own_pairs]

        # Sokratik etki takibi: başarıya ulaşılan ödevlerde kaçıncı denemede eşiğin aşıldığı.
        success_positions = []
        for attempts in own_pairs:
            for index, attempt in enumerate(attempts, start=1):
                if attempt["grade"] >= SUCCESS_THRESHOLD:
                    success_positions.append(index)
                    break

        student_improvements = [
            max(r["grade"] for r in attempts) - attempts[0]["grade"]
            for attempts in own_pairs
            if len(attempts) > 1
        ]

        own_error_counts: Dict[str, int] = defaultdict(int)
        for rec in own_graded:
            for finding in rec["findings"]:
                error_type = str(finding.get("error_type") or "").strip()
                if error_type and error_type != NEUTRAL_ERROR_TYPE:
                    own_error_counts[error_type] += 1
        top_error = max(own_error_counts.items(), key=lambda kv: kv[1])[0] if own_error_counts else None

        last_submitted = max(
            (r["submitted_at"] for r in own_records if r["submitted_at"] is not None),
            default=None,
        )

        student_rows.append(StudentProgressItem(
            user_id=student.id,
            student_number=student.student_number,
            full_name=student.full_name,
            class_code=student.class_code,
            avatar_url=student.avatar_url,
            submission_count=len(own_records),
            assignment_count=len(own_pairs),
            average_score=_mean(pair_best),
            best_score=max(pair_best) if pair_best else 0,
            first_score=own_graded[0]["grade"] if own_graded else None,
            latest_score=own_graded[-1]["grade"] if own_graded else None,
            improvement=_mean(student_improvements),
            attempts_to_success=_mean(success_positions) if success_positions else None,
            solved_assignments=len(success_positions),
            top_error_type=top_error,
            top_error_label=ERROR_TYPE_LABELS.get(top_error, top_error) if top_error else None,
            last_submitted_at=last_submitted,
        ))

    # Teslim yapmayan öğrenciler listenin sonunda kalsın; geri kalanı ortalamaya göre sırala.
    student_rows.sort(key=lambda s: (s.submission_count == 0, -s.average_score, s.full_name or ""))

    # --- Ödev bazlı performans ---
    records_by_assignment: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for rec in graded_records:
        if rec["assignment_id"] is not None:
            records_by_assignment[rec["assignment_id"]].append(rec)

    assignment_rows: List[AssignmentPerformanceItem] = []
    for assignment_id, recs in records_by_assignment.items():
        assignment = assignment_map.get(assignment_id)
        per_student_best: Dict[int, int] = {}
        for rec in recs:
            per_student_best[rec["user_id"]] = max(per_student_best.get(rec["user_id"], 0), rec["grade"])
        best_values = list(per_student_best.values())

        assignment_rows.append(AssignmentPerformanceItem(
            assignment_id=assignment_id,
            title=assignment.title if assignment else f"Ödev #{assignment_id}",
            status=assignment.status if assignment else None,
            submission_count=len(recs),
            student_count=len(per_student_best),
            average_score=_mean(best_values),
            success_rate=_percent(sum(1 for v in best_values if v >= SUCCESS_THRESHOLD), len(best_values)),
        ))

    assignment_rows.sort(key=lambda a: a.average_score)

    return TeacherSummary(
        generated_at=datetime.utcnow(),
        class_code=class_code,
        class_options=class_options,
        kpi=kpi,
        score_distribution=score_distribution,
        misconceptions=misconceptions,
        students=student_rows,
        assignments=assignment_rows,
    )
