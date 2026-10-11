"""YAYIN 016 hazırlık değişikliklerinin testleri.

Çalıştırma (backend klasöründe):  python -m pytest tests -q
Gerçek AI çağrısı yapılmaz; services.grade_submission taklit edilir. Geçici SQLite kullanılır.
"""
import os
import tempfile

_DB_DIR = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_DIR}/test.db"
os.environ.setdefault("SECRET_KEY", "test-secret-key-0123456789abcdef")
os.environ["GRADE_ONLY_CLASS_CODES"] = "1A"
os.environ["GAMIFICATION_ENABLED"] = "false"
os.environ["MAX_ATTEMPTS_PER_ASSIGNMENT"] = "2"
os.environ["SUCCESS_GRADE_THRESHOLD"] = "90"

from datetime import datetime, timedelta  # noqa: E402

import pytest  # noqa: E402

from sqlalchemy import event  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app import models  # noqa: E402


@event.listens_for(engine, "connect")
def _sqlite_fk_on(dbapi_conn, _):
    # Üretimdeki PostgreSQL gibi yabancı anahtarları denetle (SQLite varsayılanı kapalı).
    dbapi_conn.execute("PRAGMA foreign_keys=ON")


Base.metadata.create_all(bind=engine)

from fastapi.testclient import TestClient  # noqa: E402

from app import services  # noqa: E402
from app.auth import get_password_hash  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Assignment, Evaluation, InteractionEvent, Organization, Submission, User  # noqa: E402
from app.schemas import (  # noqa: E402
    GradingResult,
    PedagogicalMetadata,
    RubricScores,
    SocraticFeedback,
)

client = TestClient(app)

NEXT_GRADE = {"value": 55}


def _full_result(grade: int) -> GradingResult:
    return GradingResult(
        grade=grade,
        feedback="Döngü koşulunu kontrol et.",
        codeQuality="Orta",
        suggestions=["Değişken adlarını anlamlı seç."],
        unitTests=[],
        rubricScores=RubricScores(
            correctness=3, algorithmic_thinking=3, syntax_and_language_use=3,
            code_readability=3, debugging_awareness=3,
        ),
        errorFindings=[],
        socraticFeedback=SocraticFeedback(
            awareness_question="Döngün kaç kez çalışıyor?",
            guiding_question="Sınır değerinde ne olur?",
            progressive_hint="Koşuldaki eşitliği düşün.",
            next_action="Koşulu düzelt ve tekrar dene.",
            direct_solution_given=False,
        ),
        pedagogicalMetadata=PedagogicalMetadata(
            feedback_strategy="socratic_scaffolding", scaffolding_level="awareness",
            student_level="beginner", prompt_version="cgai_prompt_v0.2",
            rubric_version="cgai_rubric_v0.2", model_name="test-model",
        ),
    )


@pytest.fixture(autouse=True)
def fake_ai(monkeypatch):
    async def _fake(request):
        g = NEXT_GRADE["value"]
        if g is None:
            return services._fallback_grading_result("Hata: servis yanıt vermedi.")
        return _full_result(g)

    monkeypatch.setattr(services, "grade_submission", _fake)
    NEXT_GRADE["value"] = 55
    yield


def _setup():
    db = SessionLocal()
    org = Organization(name=f"Org-{datetime.utcnow().timestamp()}", is_active=True)
    db.add(org)
    db.commit()
    db.refresh(org)
    uid = str(int(datetime.utcnow().timestamp() * 1e6))[-8:]
    users = {}
    for key, code, first in [("ctrl", "1A", False), ("exp", "1B", False), ("fresh", "1B", True)]:
        u = User(
            student_number=f"{key}{uid}", full_name=key, role="student", class_code=code,
            password_hash=get_password_hash("pw123456"), is_first_login=first, organization_id=org.id,
        )
        db.add(u)
        users[key] = u
    teacher = User(
        student_number=f"t{uid}", full_name="Öğretmen", role="teacher", class_code=None,
        password_hash=get_password_hash("pw123456"), is_first_login=False, organization_id=org.id,
    )
    db.add(teacher)
    users["teacher"] = teacher
    a = Assignment(
        organization_id=org.id, title="Ödev 1", description="Toplama", language="C#",
        student_level="beginner", due_date=(datetime.utcnow() + timedelta(days=3)).isoformat(),
        target_type="all",
    )
    db.add(a)
    db.commit()
    ids = {k: (v.id, v.student_number) for k, v in users.items()}
    aid = a.id
    db.close()
    return ids, aid


def _login(student_number):
    r = client.post("/token", data={"username": student_number, "password": "pw123456"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _grade(headers, aid):
    return client.post("/api/grade", headers=headers, json={
        "assignmentDescription": "Toplama", "assignmentLanguage": "C#",
        "studentCode": "int a=1;", "studentLevel": "beginner", "assignmentId": aid,
    })


def test_grade_requires_auth():
    r = client.post("/api/grade", json={
        "assignmentDescription": "x", "assignmentLanguage": "C#", "studentCode": "x",
    })
    assert r.status_code == 401


def test_public_config():
    r = client.get("/api/config")
    assert r.status_code == 200
    assert r.json() == {"gamification_enabled": False, "max_attempts": 2, "success_threshold": 90}


def test_experiment_gets_socratic_and_research_log_is_written():
    ids, aid = _setup()
    h = _login(ids["exp"][1])
    r = _grade(h, aid)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["feedbackMode"] == "socratic"
    assert body["socraticFeedback"]["awareness_question"]
    assert body["submissionId"] and body["attemptNo"] == 1

    db = SessionLocal()
    sub = db.query(Submission).filter(Submission.id == body["submissionId"]).one()
    assert sub.session_id is not None and sub.attempt_no == 1
    assert db.query(Evaluation).filter(Evaluation.submission_id == sub.submission_id).count() == 1
    ev = db.query(InteractionEvent).filter(
        InteractionEvent.session_id == sub.session_id,
        InteractionEvent.event_type == "submission_created",
    ).one()
    assert ev.metadata_json["feedback_mode"] == "socratic"
    assert ev.metadata_json["class_code"] == "1B"
    db.close()


def test_control_sees_only_grade_but_full_result_is_stored():
    ids, aid = _setup()
    h = _login(ids["ctrl"][1])
    r = _grade(h, aid)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["feedbackMode"] == "grade_only"
    assert body["grade"] == 55
    assert body["feedback"] == "" and body["suggestions"] == [] and body["unitTests"] == []
    assert body["socraticFeedback"] is None and body["errorFindings"] is None
    assert body["rubricScores"] is None and body["pedagogicalMetadata"] is None

    # Liste uç noktası da süzülmüş döner
    lst = client.get("/submissions/", headers=h).json()
    gr = lst[0]["grading_result"]
    assert gr["feedbackMode"] == "grade_only" and gr["feedback"] == "" and gr["socraticFeedback"] is None

    # Veritabanında tam sonuç durur
    db = SessionLocal()
    sub = db.query(Submission).filter(Submission.id == body["submissionId"]).one()
    assert sub.grading_result["socraticFeedback"]["awareness_question"]
    ev = db.query(InteractionEvent).filter(
        InteractionEvent.session_id == sub.session_id,
        InteractionEvent.event_type == "submission_created",
    ).one()
    assert ev.metadata_json["feedback_mode"] == "grade_only"
    db.close()

    # Öğretmen tam raporu görür
    ht = _login(ids["teacher"][1])
    tl = client.get("/submissions/", headers=ht).json()
    mine = [s for s in tl if s["id"] == body["submissionId"]][0]
    assert mine["grading_result"]["socraticFeedback"]["awareness_question"]


def test_attempt_limit_applies_to_both_groups():
    ids, aid = _setup()
    for key in ("ctrl", "exp"):
        h = _login(ids[key][1])
        assert _grade(h, aid).status_code == 200
        r2 = _grade(h, aid)
        assert r2.status_code == 200 and r2.json()["attemptNo"] == 2
        r3 = _grade(h, aid)
        assert r3.status_code == 409


def test_success_threshold_blocks_further_attempts():
    ids, aid = _setup()
    h = _login(ids["exp"][1])
    NEXT_GRADE["value"] = 95
    assert _grade(h, aid).status_code == 200
    NEXT_GRADE["value"] = 50
    assert _grade(h, aid).status_code == 409


def test_ai_failure_does_not_consume_attempt():
    ids, aid = _setup()
    h = _login(ids["exp"][1])
    NEXT_GRADE["value"] = None
    r = _grade(h, aid)
    assert r.status_code == 503
    assert client.get("/submissions/", headers=h).json() == []
    NEXT_GRADE["value"] = 60
    assert _grade(h, aid).status_code == 200
    assert _grade(h, aid).status_code == 200  # hata denemesi sayılmadığı için 2. hak hâlâ var
    assert _grade(h, aid).status_code == 409

    db = SessionLocal()
    uid = ids["exp"][0]
    assert db.query(Submission).filter(Submission.user_id == uid, Submission.submission_source == "ai_error").count() == 1
    db.close()


def test_first_login_must_change_password():
    ids, aid = _setup()
    h = _login(ids["fresh"][1])
    assert client.get("/users/me", headers=h).json()["is_first_login"] is True
    assert _grade(h, aid).status_code == 403

    bad = client.post("/users/change-password", headers=h,
                      json={"oldPassword": "pw123456", "newPassword": ids["fresh"][1]})
    assert bad.status_code == 400
    ok = client.post("/users/change-password", headers=h,
                     json={"oldPassword": "pw123456", "newPassword": "YeniParola42"})
    assert ok.status_code == 200
    assert client.get("/users/me", headers=h).json()["is_first_login"] is False
    assert _grade(h, aid).status_code == 200


def test_legacy_client_submission_endpoint_is_closed():
    ids, aid = _setup()
    h = _login(ids["exp"][1])
    r = client.post("/submissions/", headers=h, json={
        "assignment_id": aid, "code_content": "x", "grading_result": {"grade": 100},
    })
    assert r.status_code == 410


def test_student_cannot_delete_submission():
    ids, aid = _setup()
    h = _login(ids["exp"][1])
    sid = _grade(h, aid).json()["submissionId"]
    assert client.delete(f"/submissions/{sid}", headers=h).status_code == 403


def test_leaderboard_hidden_for_students_when_gamification_off():
    ids, aid = _setup()
    h = _login(ids["exp"][1])
    assert client.get("/leaderboard/", headers=h).json() == []


def test_expired_deadline_rejected():
    ids, aid = _setup()
    db = SessionLocal()
    a = db.query(Assignment).get(aid)
    a.due_date = (datetime.utcnow() - timedelta(hours=1)).isoformat()
    db.commit()
    db.close()
    h = _login(ids["exp"][1])
    assert _grade(h, aid).status_code == 400


def test_teacher_removal_keeps_research_data_and_restores_attempt():
    ids, aid = _setup()
    h = _login(ids["exp"][1])
    sid1 = _grade(h, aid).json()["submissionId"]
    assert _grade(h, aid).status_code == 200
    assert _grade(h, aid).status_code == 409

    ht = _login(ids["teacher"][1])
    r = client.delete(f"/submissions/{sid1}", headers=ht)
    assert r.status_code == 200, r.text

    # Öğrenci listesinde görünmez, hak geri gelir
    assert [s["id"] for s in client.get("/submissions/", headers=h).json()].count(sid1) == 0
    assert _grade(h, aid).status_code == 200

    db = SessionLocal()
    sub = db.query(Submission).filter(Submission.id == sid1).one()
    assert sub.submission_source == "teacher_removed"
    assert db.query(Evaluation).filter(Evaluation.submission_id == sub.submission_id).count() == 1
    assert db.query(InteractionEvent).filter(
        InteractionEvent.session_id == sub.session_id,
        InteractionEvent.event_type == "submission_removed_by_teacher",
    ).count() == 1
    db.close()


def _events(sub_id, event_type):
    db = SessionLocal()
    sub = db.query(Submission).filter(Submission.id == sub_id).one()
    rows = db.query(InteractionEvent).filter(
        InteractionEvent.session_id == sub.session_id, InteractionEvent.event_type == event_type
    ).all()
    out = [dict(r.metadata_json) for r in rows]
    db.close()
    return out


def test_fidelity_log_scaffold_levels_for_experiment():
    ids, aid = _setup()
    h = _login(ids["exp"][1])
    sid = _grade(h, aid).json()["submissionId"]

    r = client.post("/api/interaction", headers=h, json={"submissionId": sid, "event": "result_viewed", "uiLevel": 0})
    assert r.status_code == 204
    for a, b in [(0, 1), (1, 2), (2, 3)]:
        r = client.post("/api/interaction", headers=h, json={
            "submissionId": sid, "event": "scaffold_advanced", "fromLevel": a, "toLevel": b})
        assert r.status_code == 204, r.text

    assert _events(sid, "result_viewed")[0]["ui_level"] == 0
    assert [e["to_level"] for e in _events(sid, "scaffold_advanced")] == [1, 2, 3]
    unlocked = _events(sid, "full_report_unlocked")
    assert len(unlocked) == 1 and unlocked[0]["unlock_reason"] == "student_request"

    db = SessionLocal()
    sub = db.query(Submission).filter(Submission.id == sid).one()
    assert sub.study_session.full_report_unlocked_at is not None
    assert sub.study_session.session_status == "FULL_REPORT_UNLOCKED"
    db.close()

    # Oturum aktif kalır: ikinci teslim aynı oturumda 2. deneme olur
    assert _grade(h, aid).json()["attemptNo"] == 2


def test_fidelity_log_rules():
    ids, aid = _setup()
    hc = _login(ids["ctrl"][1])
    sid_c = _grade(hc, aid).json()["submissionId"]
    # Kontrol: görüntüleme loglanır, kademe yoktur
    assert client.post("/api/interaction", headers=hc, json={
        "submissionId": sid_c, "event": "result_viewed"}).status_code == 204
    assert _events(sid_c, "result_viewed")[0]["feedback_mode"] == "grade_only"
    assert client.post("/api/interaction", headers=hc, json={
        "submissionId": sid_c, "event": "scaffold_advanced", "fromLevel": 0, "toLevel": 1}).status_code == 400

    he = _login(ids["exp"][1])
    sid_e = _grade(he, aid).json()["submissionId"]
    # Başkasının teslimi
    assert client.post("/api/interaction", headers=hc, json={
        "submissionId": sid_e, "event": "result_viewed"}).status_code == 404
    # Atlamalı geçiş reddedilir
    assert client.post("/api/interaction", headers=he, json={
        "submissionId": sid_e, "event": "scaffold_advanced", "fromLevel": 0, "toLevel": 3}).status_code == 422
    # Öğretmen etkileşimi loglanmaz
    ht = _login(ids["teacher"][1])
    assert client.post("/api/interaction", headers=ht, json={
        "submissionId": sid_e, "event": "result_viewed"}).status_code == 403
