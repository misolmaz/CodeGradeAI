from app.database import SessionLocal
from app.models import User, Organization
from app.auth import get_password_hash

def create_new_tenant(org_name, teacher_username, teacher_password, teacher_fullname):
    db = SessionLocal()
    try:
        # 1. Create Organization
        existing_org = db.query(Organization).filter(Organization.name == org_name).first()
        if existing_org:
            print(f"Hata: '{org_name}' adında bir organizasyon zaten var.")
            # Org varsa onu kullanalım mı? Şimdilik yeni tenant mantığı için hayır diyelim veya duralım.
            # Test için belki mevcut org'a öğretmen eklemek isterler.
            # Ancak "Farklı bir öğretmen tanımlamak için" ve "multi tenant testleri için" dendiği için
            # yeni bir organizasyon olması daha mantıklı.
            return

        new_org = Organization(name=org_name)
        db.add(new_org)
        db.commit()
        db.refresh(new_org)
        print(f"✅ Organizasyon oluşturuldu: {org_name} (ID: {new_org.id})")

        # 2. Create Teacher
        existing_user = db.query(User).filter(User.student_number == teacher_username).first()
        if existing_user:
            print(f"❌ Hata: '{teacher_username}' kullanıcı adı zaten kullanılıyor.")
            return

        hashed_pwd = get_password_hash(teacher_password)
        new_teacher = User(
            student_number=teacher_username,
            full_name=teacher_fullname,
            password_hash=hashed_pwd,
            role="teacher",
            class_code="ADMIN",
            is_first_login=False,
            organization_id=new_org.id
        )
        db.add(new_teacher)
        db.commit()
        print(f"✅ Öğretmen oluşturuldu: {teacher_fullname} ({teacher_username})")
        print(f"➡️  Bu kullanıcı ile giriş yaptığınızda sadece '{org_name}' verilerini göreceksiniz.")

    except Exception as e:
        print(f"Bir hata oluştu: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("--- 🏢 Yeni Organizasyon (Okul) ve Öğretmen Oluşturma ---")
    org = input("Organizasyon Adı (örn: Fen Lisesi): ")
    username = input("Öğretmen Kullanıcı Adı (örn: fen_ogretmen): ")
    pwd = input("Şifre: ")
    fullname = input("Öğretmen Ad Soyad: ")
    
    if org and username and pwd and fullname:
        create_new_tenant(org, username, pwd, fullname)
    else:
        print("❌ Tüm alanlar zorunludur.")
