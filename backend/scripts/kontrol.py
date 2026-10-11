# YAYIN 016: son teslim, olay ve değerlendirme kayıtlarını gösterir (salt okunur).
# Kullanım (backend konteyneri, /app):  python scripts/kontrol.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # /app
from sqlalchemy import text
from app.database import engine

with engine.connect() as c:
    print("== Son 10 teslim ==")
    for r in c.execute(text("""
        SELECT s.id, u.student_number, u.class_code, s.attempt_no, s.submission_source, s.submitted_at
        FROM submissions s JOIN users u ON u.id = s.user_id
        ORDER BY s.id DESC LIMIT 10""")):
        print(f"  teslim {r[0]} | ogr {r[1]} | sinif {r[2]} | deneme {r[3]} | kaynak {r[4]} | {r[5]}")

    print("\n== Son 25 olay (interaction_events) ==")
    for r in c.execute(text("""
        SELECT e.occurred_at, u.student_number, e.event_type, e.metadata_json
        FROM interaction_events e
        JOIN study_sessions ss ON ss.session_id = e.session_id
        JOIN users u ON u.id = ss.student_id
        ORDER BY e.occurred_at DESC LIMIT 25""")):
        print(f"  {r[0]} | ogr {r[1]} | {r[2]} | {str(r[3])[:110]}")

    print("\n== Değerlendirmeler ==")
    for r in c.execute(text("""
        SELECT ev.grade, ev.model_name, ev.prompt_version, ev.parse_status, ev.latency_ms
        FROM evaluations ev ORDER BY ev.evaluated_at DESC LIMIT 10""")):
        print(f"  puan {r[0]} | model {r[1]} | prompt {r[2]} | ayrıştırma {r[3]} | {r[4]} ms")

    print("\n== Aynı kod, farklı puan (kod özeti eşit olan teslimler) ==")
    rows = c.execute(text("""
        SELECT s.code_hash, u.student_number, u.class_code, s.attempt_no, ev.grade, ev.rubric_scores_json
        FROM submissions s
        JOIN users u ON u.id = s.user_id
        JOIN evaluations ev ON ev.submission_id = s.submission_id
        WHERE s.code_hash IN (
            SELECT code_hash FROM submissions WHERE code_hash IS NOT NULL
            GROUP BY code_hash HAVING COUNT(*) > 1)
        ORDER BY s.code_hash, s.id""")).fetchall()
    if not rows:
        print("  Birebir aynı kod iki kez gönderilmemiş (boşluk farkı bile özeti değiştirir).")
    for r in rows:
        print(f"  kod {r[0][:8]} | ogr {r[1]} ({r[2]}) | deneme {r[3]} | puan {r[4]} | rubrik {r[5]}")

    print("\n== Şifresini henüz değiştirmemiş öğrenciler (varsayılan şifre = öğrenci no) ==")
    rows = c.execute(text("""
        SELECT class_code, COUNT(*) FROM users
        WHERE role = 'student' AND is_first_login = :t GROUP BY class_code ORDER BY class_code"""),
        {"t": True}).fetchall()
    if not rows:
        print("  Yok.")
    for r in rows:
        print(f"  sınıf {r[0]}: {r[1]} öğrenci (bu hesaplara sınıf arkadaşı varsayılan şifreyle girebilir)")
