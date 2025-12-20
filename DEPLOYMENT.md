# CodeGradeAI Deployment Guide (Hostinger VPS)

Bu kılavuz, CodeGradeAI projesini Hostinger VPS üzerinde yayınlamanız için hazırlanmıştır.

## 1. Hazırlık
Projenizi GitHub'a yüklemeden önce:
- `backend/.env` dosyanızın (API anahtarınızın olduğu yer) `.gitignore` içinde olduğundan emin olun.
- Hostinger VPS'inizde **Docker** ve **Docker Compose** kurulu olmalıdır. (coolify için gerek yok)

## 2. GitHub'a Gönderme
```bash
git init
git add .
git commit -m "Deployment preparation"
git remote add origin https://github.com/kullaniciadin/codegradeai.git
git push -u origin main
```

## 3. VPS Üzerinde Yayına Alma
1. VPS'e SSH ile bağlanın.
2. Projeyi çekin:
   ```bash
   git clone https://github.com/kullaniciadin/codegradeai.git
   cd codegradeai
   ```
3. `docker-compose.yml` dosyasındaki `ALLOWED_ORIGINS` ve `VITE_BACKEND_URL` alanlarını VPS IP'niz veya domainizle güncelleyin.
4. Çevresel değişkeni ayarlayın:
   ```bash
   export GEMINI_API_KEY=your_actual_key_here
   ```
5. Uygulamayı başlatın:
   ```bash
   docker-compose up -d --build
   ```

### 💡 Veri Kaybını Önleme (Persistence)
Önceki sürümlerde veritabanı dosya yolu bağımlı olduğu için resetlemelerde veri siliniyordu. Yeni sürümde **Docker Named Volumes** (`db_data`) yapısına geçtik.

**Coolify Kullanıyorsanız:**
- Coolify üzerinde "Storage" veya "Volumes" sekmesinde `/app/data` klasörünün kalıcı bir volume olarak tanımlandığından emin olun.
- `DATABASE_URL=sqlite:////app/data/sql_app.db` çevresel değişkeninin tanımlı olduğundan emin olun.

## Önemli Notlar
- SQL dosyası (`sql_app.db`) Docker volume olarak bağlandığı için VPS üzerinde kalıcıdır.
- Frontend 80 portundan, Backend 8000 portundan hizmet verecektir.
