# DEVELOPER_NOTES.md - Project Constitution & Technical Reference

Bu dosya, projenin teknik mimarisini, veritabanı kurallarını ve kritik iş mantıklarını tanımlar. Her geliştirme bu kurallara uygun yapılmalıdır.

---

## 1. Veritabanı & Mimari
- **Motor (Engine):** Kesinlikle **PostgreSQL** (`psycopg2`) kullanılacaktır. SQLite sadece lokal geliştirme (legacy) içindir.
- **Mimari:** **Multi-Tenant** (Organization-based isolation).
- **Zorunluluk:** Super Admin hariç, tüm kullanıcılar ve veriler mutlak suretle bir `organization_id`'ye bağlı olmalıdır. Sorgular her zaman `organization_id` filtresi içermelidir.

### Unique Constraints (Kısıtlamalar)
Veri bütünlüğü için aşağıdaki Composite Unique kuralları esastır:
1. **Email:** `UNIQUE (organization_id, email)` -> Bir e-posta, farklı kurumlarda tekrar edebilir ama aynı kurumda benzersizdir.
2. **Öğrenci No:** `UNIQUE (organization_id, student_number)` -> Bir numara, farklı kurumlarda tekrar edebilir.

---

## 2. Authentication (Kimlik Doğrulama)
- **Giriş Yöntemi:** Kullanıcılar `Student Number` (Öğrenci/Sicil No) VEYA `Email` adresi ile giriş yapabilir.
- **Token:** JWT Payload'u mutlaka `user_id` (Primary Key) ve `org_id` içermelidir. `get_current_user` fonksiyonu, `student_number` yerine `user_id` ile kesin eşleşme yapmalıdır.

---

## 3. Data Handling (Veri İşleme)

### Excel / Toplu Yükleme (Upsert Mantığı)
Excel yüklemelerinde "Hata verip durma" YOKTUR. "Akıllı Upsert" (Merge) vardır:
1. **Ara:** `(organization_id, student_number)` VEYA `(organization_id, email)` ile mevcut kullanıcıyı bul.
2. **Karşılaştır:** Gelen veri ile mevcut veri aynı mı?
   - **Evet (Aynı):** İşlemi atla (SKIP). (Performans optimizasyonu).
   - **Hayır (Farklı):** Mevcut kaydı güncelle (UPDATE).
3. **Bulunamazsa:** Yeni kayıt oluştur (INSERT).

---

## 4. Kullanıcı Arayüzü (UI/UX)
- **Organizasyon Seçici:** Kullanıcının sadece 1 (bir) organizasyonu varsa, header/sidebar'daki "Organizasyon Seç" menüsü **GİZLENMELİDİR**.
- **Profil:** Kullanıcılar kendi profillerini (Avatar, Şifre) düzenleyebilir. Bu işlem, bağlı oldukları organizasyon bağlamında gerçekleşir.
