# YAYIN 016: uygulama öncesi veritabanı sıfırlama (yalnızca superadmin kalır).
# Önce deneme (hiçbir şey silmez):  python scripts/sifirla.py
# Gerçek silme (önce mutlaka yedek):  python scripts/sifirla.py SIFIRLA
# Backend yeniden başlayınca "System Admin Workspace" organizasyonu otomatik yeniden oluşur.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # /app
from sqlalchemy import text
from app.database import engine

TABLOLAR = ["interaction_events", "evaluations", "submissions", "study_sessions",
            "user_badges", "announcements", "assignments"]
ONAY = len(sys.argv) > 1 and sys.argv[1] == "SIFIRLA"

with engine.begin() as c:
    print("Veritabanı:", engine.url.get_backend_name())
    for t in TABLOLAR:
        print(f"  {t}: {c.execute(text(f'SELECT COUNT(*) FROM {t}')).scalar()} kayıt silinecek")
    print("  users (superadmin hariç):",
          c.execute(text("SELECT COUNT(*) FROM users WHERE role <> 'superadmin'")).scalar(), "kayıt silinecek")
    print("  organizations:", c.execute(text("SELECT COUNT(*) FROM organizations")).scalar(), "kayıt silinecek")
    print("  kalacak:", c.execute(text("SELECT student_number, role FROM users WHERE role = 'superadmin'")).fetchall())
    if not ONAY:
        print("\nDENEME: hiçbir şey silinmedi. Silmek için: python scripts/sifirla.py SIFIRLA")
        sys.exit(0)
    for t in TABLOLAR:
        c.execute(text(f"DELETE FROM {t}"))
    c.execute(text("DELETE FROM users WHERE role <> 'superadmin'"))
    c.execute(text("UPDATE users SET organization_id = NULL WHERE role = 'superadmin'"))
    c.execute(text("DELETE FROM organizations"))
    print("\nSİLİNDİ. Kalan kullanıcılar:", c.execute(text("SELECT student_number, role FROM users")).fetchall())
