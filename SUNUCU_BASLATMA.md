# CodeGradeAI — Yerel Sunucu Başlatma Rehberi

Bu proje **iki ayrı terminal** gerektirir: backend (FastAPI) ve frontend (Vite/React).

Veritabanı: `backend/.env` içindeki **PostgreSQL** (sunucu). Yerel SQLite kullanılmaz.

---

## Ön koşullar (ilk kurulum, bir kez)

### Backend

```powershell
cd C:\Workspaces\CodeGradeAI\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install uvicorn fastapi pydantic sqlalchemy python-dotenv python-jose passlib bcrypt google-generativeai python-multipart openpyxl pandas psycopg2-binary
```

### Frontend

```powershell
cd C:\Workspaces\CodeGradeAI\frontend
npm install
```

### Ortam dosyası (`backend/.env`)

Aşağıdaki değişkenler tanımlı olmalı:

```env
PORT=8000
GEMINI_API_KEY=...
GEMINI_MODEL_NAME=gemini-2.5-flash
DATABASE_URL=postgresql://...
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Frontend ortam dosyası (`frontend/.env.local`, isteğe bağlı)

```env
VITE_BACKEND_URL=http://localhost:8000
```

Tanımlı değilse frontend varsayılan olarak `http://localhost:8000` kullanır.

---

## Her çalıştırmada — Terminal 1 (Backend)

```powershell
cd C:\Workspaces\CodeGradeAI\backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Başarı kontrolü:**
- Terminal: `Application startup complete`
- Tarayıcı: http://localhost:8000 → `{"message":"CodeGradeAI Backend is running",...}`
- API dokümantasyonu: http://localhost:8000/docs

**Veritabanı bağlantısı kontrolü (isteğe bağlı):**

```powershell
python -c "from app.database import SQLALCHEMY_DATABASE_URL; print(SQLALCHEMY_DATABASE_URL)"
```

Çıktı `postgresql://` ile başlamalıdır (`sqlite:///` olmamalı).

---

## Her çalıştırmada — Terminal 2 (Frontend)

```powershell
cd C:\Workspaces\CodeGradeAI\frontend
npm run dev
```

**Başarı kontrolü:**
- Terminal: `Local: http://localhost:3000/`
- Tarayıcı: http://localhost:3000

> **Not:** `npm run dev` komutunu proje kök dizininden (`CodeGradeAI/`) değil, `frontend/` klasöründen çalıştırın.

---

## Port özeti

| Servis   | Adres                      |
|----------|----------------------------|
| Frontend | http://localhost:3000      |
| Backend  | http://localhost:8000      |
| API Docs | http://localhost:8000/docs |

---

## Test kullanıcıları

Sunucu PostgreSQL veritabanındaki hesaplar için: `test raporları/test_kullanicilari.md`

Örnek öğretmen hesabı:
- Kullanıcı: `test.user`
- Şifre: `123456`

Yerel superadmin (veritabanında varsa):
- Kullanıcı: `admin` veya `ADMIN001`
- Şifre: `admin123`

---

## Sık hatalar

| Hata | Çözüm |
|------|-------|
| `uvicorn` tanınmıyor | `python -m uvicorn app.main:app ...` kullanın |
| `package.json` bulunamadı | `cd frontend` yapın, kök dizinde `npm run dev` çalışmaz |
| Giriş başarısız (eski SQLite) | `backend/.env` içinde `DATABASE_URL` PostgreSQL olmalı; backend'i yeniden başlatın |
| `ModuleNotFoundError: psycopg2` | `pip install psycopg2-binary` |
| CORS hatası | `ALLOWED_ORIGINS` içinde `http://localhost:3000` olmalı |
| `Activate.ps1` çalışmıyor | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |

---

## Durdurma

Her iki terminalde `Ctrl + C` ile sunucuları durdurun.
