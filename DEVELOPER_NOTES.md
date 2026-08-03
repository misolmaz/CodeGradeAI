# CodeGrade AI - Technical Constitution & Architecture Guide

This document serves as the primary technical reference for CodeGrade AI. It defines the architectural standards, security protocols, and operational logic that every contributor must adhere to.

---

## 1. Core Architecture & Database Strategy

### 1.1 Database Engine
- **Production:** PostgreSQL (`psycopg2`) is the mandatory standard.
- **Development:** SQLite is permitted for local testing but discouraged for integration tests due to constraint differences.
- **Schema Management:** Alembic is the single source of truth. Do **not** use `Base.metadata.create_all()` on existing PostgreSQL databases — it cannot alter legacy tables and will fail when new FK columns (e.g. `submissions.submission_id`) are missing.
- **Startup:** Run `alembic upgrade head` before starting the server. Schema is no longer auto-created in `main.py`.

### 1.2 Multi-Tenant Isolation
- **Pattern:** Organization-based isolation (Row-Level logic).
- **Enforcement:**
  - Every operational entity (`User`, `Assignment`, `Submission`) MUST belong to an `organization_id`.
  - **Super Admin** is the only role permitted to have `organization_id = NULL`.
  - All database queries must explicitly filter by `organization_id` to prevent data leaks between tenants.

### 1.3 Schema Constraints
Data integrity is enforced at the database level via Composite Unique Keys:
- **Email Uniqueness:** `UNIQUE (organization_id, email)`
  - *Rationale:* A user email can exist in multple organizations but must be unique within a single organization.
- **Student ID Uniqueness:** `UNIQUE (organization_id, student_number)`
  - *Rationale:* Student IDs are only unique within the context of their institution.

---

## 2. Security & Authentication Protocol

### 2.1 Login Mechanism
- **Identifiers:** Users can authenticate via `Student Number` OR `Email`.
- **Token Structure (JWT):**
  - Payload MUST include:
    - `user_id`: Primary Key (Critical for exact user resolution).
    - `org_id`: The context organization ID.
    - `role`: Current user role.

### 2.2 API Header Standards
All client-server communication must follow these header strictures:
- **Authorization:** `Bearer <JWT_TOKEN>` (Required for all protected endpoints).
- **Content-Type:** `application/json` (Standard for data payloads).
- **X-Tenant-ID:** (Optional) Can be used for explicit context switching, though `org_id` in JWT is the primary source of truth.

---

## 3. RBAC (Role-Based Access Control) Matrix

System access is strictly divided into three tiers:

| Feature / Action | **Super Admin** | **Teacher** | **Student** |
| :--- | :---: | :---: | :---: |
| **Tenant Management** | ✅ Create/Edit/Delete | ❌ | ❌ |
| **User Management** | ✅ Global | ✅ Own Org Only | ❌ |
| **Assignment Creation** | ✅ Global | ✅ Own Org Only | ❌ |
| **Code Submission** | ❌ | ❌ | ✅ Own Assignments |
| **View Analytics** | ✅ Global Dashboard | ✅ Class Performance | ✅ Personal Stats |
| **Org Switching** | ✅ Unrestricted | ⚠️ Multi-org accounts only | ⚠️ Multi-org accounts only |

---

## 4. Frontend Architecture & UI Guidelines

### 4.1 Z-Index Stratagem (Layer Management)
To prevent visual collisions, strict Z-Index layers are defined:
- **Base Layer:** `z-0` (Standard content).
- **Navigation/Sidebar:** `z-40`.
- **Header & Dropdowns:** `z-50` (Must float above content).
- **Modals & Overlays:** `z-[60]` to `z-[100]`.
- **Critical Popovers (Dropdown Menus):** `z-[9999]` (Absolute top priority).

### 4.2 UI Components
- **Organizasyon Seçici (Switcher):** 
  - *Rule:* If a user belongs to only **one** organization and is NOT a Super Admin, the switcher must be **HIDDEN**.
  - *Behavior:* Auto-select the single organization context.

### 4.3 Profile Management
- `/profile` stores logic must respect the current `organization_id` context.
- Updates (Avatar, Password) affect the specific user record identified by `user_id` in the JWT.

---

## 5. Data Operations & Upsert Logic

### 5.1 Excel Bulk Import (Smart Upsert)
The backend implements a fault-tolerant "Smart Upsert" mechanism instead of failing on duplicates:

1. **Lookup Phase:**
   - Attempt to find target user by `(organization_id, student_number)`.
   - Fallback lookup by `(organization_id, email)`.
2. **Evaluation Phase:**
   - Compare incoming data vs. existing record.
3. **Action Phase:**
   - **MATCH (Identical):** `SKIP` (No DB write, performance optimization).
   - **CONFLICT (Different):** `UPDATE` (Merge new details into existing record).
   - **MISSING:** `INSERT` (Create new record).

---

## 6. Success Milestones & Changelog

- **2026-01-09:** Multi-tenant email isolation confirmed. Students can now belong to multiple organizations via composite unique keys (`_email_org_uc`).
- **2026-01-09:** Unified Login Logic implemented (Email + StudentID support).
- **2026-01-10:** Z-Index architecture standardized for complex dropdowns.

---

## 7. Faz 0 — Güvenli Hazırlık (v0.2 Geriye Uyumluluk)

**Tarih:** 2026-07-12  
**Kapsam:** Pydantic şemaları ve frontend tip hazırlığı; veritabanı modeli değiştirilmedi.

### 7.1 Şema Değişiklikleri

`GradingResult` şemasına Faz 1 için planlanan dört alan **opsiyonel** olarak eklendi:

| Alan | Tip | Durum |
| :--- | :--- | :--- |
| `rubricScores` | `RubricScores` | Opsiyonel |
| `errorFindings` | `List[ErrorFinding]` | Opsiyonel |
| `socraticFeedback` | `SocraticFeedback` | Opsiyonel |
| `pedagogicalMetadata` | `PedagogicalMetadata` | Opsiyonel |

Mevcut zorunlu MVP alanları (`grade`, `feedback`, `codeQuality`, `suggestions`, `unitTests`) korunmuştur.

**Değiştirilen dosyalar:**
- `backend/app/schemas.py` — Yeni alt modeller + opsiyonel alanlar
- `frontend/types.ts` — Paralel TypeScript arayüzleri
- `frontend/utils/parseGradingResult.ts` — Güvenli JSON parse/fallback yardımcısı (yeni)
- `frontend/App.tsx` — `parseGradingResult` entegrasyonu, koşullu UI blokları

### 7.2 Geriye Uyumluluk

- Eski `grading_result` JSON kayıtları yeni alanlar içermese de parse edilir ve UI'da gösterilir.
- Bozuk veya eksik JSON için `parseGradingResult` güvenli varsayılanlar döndürür; uygulama çökmez.
- `models.py` ve veritabanındaki mevcut `code_content` / `grading_result` verileri **değiştirilmedi**.
- API uç noktalarının davranışı değiştirilmedi; yeni alanlar yalnızca şema/tip düzeyinde tanımlandı.

### 7.3 Çalıştırılan Testler

| Test | Komut | Sonuç |
| :--- | :--- | :--- |
| Frontend build | `npm run build` | ✅ Başarılı (vite build, 24.56s) |
| Frontend TypeScript | `npx tsc --noEmit` | ⚠️ Mevcut `geminiService.ts` ImportMeta.env hatası (önceden var); yeni dosyalarda hata yok |
| Backend syntax | `python -m py_compile app/schemas.py` | ✅ Başarılı |
| Backend startup | `python -c "from app.main import app"` | ⚠️ Yerel ortamda `fastapi`/`pydantic` kurulu değil; şema sözdizimi doğrulandı |

---

## 8. Faz 1 — Backend Değerlendirme Şeması ve Hata Taksonomisi

**Tarih:** 2026-07-13  
**Kapsam:** Pydantic Literal kısıtlamaları ve TypeScript union tipleri; `models.py` ve `services.py` değiştirilmedi.

### 8.1 Uygulanan Kısıtlamalar

| Alan / Model | Kısıtlama | Değerler |
| :--- | :--- | :--- |
| `RubricScores` (5 alt puan) | `Field(ge=1, le=5)` | 1–5 (Faz 0'dan devralındı, doğrulandı) |
| `ErrorFinding.error_type` | `ErrorType` Literal | 13 hata türü + `major_error_not_detected` |
| `ErrorFinding.severity` | `ErrorSeverity` Literal | `low`, `medium`, `high`, `blocking` |
| `PedagogicalMetadata.scaffolding_level` | `ScaffoldingLevel` Literal | `awareness`, `guided_hint`, `strategic_hint`, `near_solution` |
| `SocraticFeedback.direct_solution_given` | `bool` (zorunlu) | Değişiklik yok, doğrulandı |

### 8.2 Hata Taksonomisi (`ErrorType`)

```text
syntax_error, runtime_error, logic_error, conceptual_error,
boundary_case_error, data_type_error, loop_error, conditional_error,
function_structure_error, input_output_format_error, code_readability_issue,
incomplete_solution, major_error_not_detected
```

### 8.3 Değiştirilen Dosyalar

- `backend/app/schemas.py` — `ErrorType`, `ErrorSeverity`, `ScaffoldingLevel` Literal tanımları
- `frontend/types.ts` — Paralel union tipleri (`ErrorType`, `ErrorSeverity`, `ScaffoldingLevel`, `RubricScoreValue`)
- `frontend/utils/parseGradingResult.ts` — Taksonomi doğrulama filtreleri (eski/geçersiz kayıtlar atlanır)

### 8.4 Geriye Uyumluluk

- Kök `GradingResult` alanlarındaki `Optional` yapı korunmuştur.
- Katı kurallar yalnızca v0.2 alt alanları gönderildiğinde Pydantic tarafından uygulanır.
- Eski MVP kayıtları (yalnızca 5 temel alan) etkilenmez.
- `parseGradingResult` geçersiz taksonomi değerlerini sessizce filtreler; UI çökmez.

### 8.5 Çalıştırılan Testler

| Test | Komut | Sonuç |
| :--- | :--- | :--- |
| Frontend build | `npm run build` | ✅ Başarılı (vite build, 25.48s) |
| Frontend TypeScript | `npx tsc --noEmit` | ⚠️ Önceden var olan `geminiService.ts` ImportMeta.env hatası; yeni dosyalarda hata yok |
| Backend syntax | `python -m py_compile app/schemas.py` | ✅ Başarılı |

---

## 9. Faz 2 — Prompt ve AI Çıktı Sözleşmesinin Güncellenmesi

**Tarih:** 2026-07-13  
**Kapsam:** `backend/app/services.py` — Sokratik/kademeli geri bildirim promptu ve JSON sözleşmesi; `models.py` ve frontend değiştirilmedi.

### 9.1 Merkezi Sabitler

| Sabit | Değer |
| :--- | :--- |
| `PROMPT_VERSION` | `cgai_prompt_v0.2` |
| `RUBRIC_VERSION` | `cgai_rubric_v0.2` |
| `FEEDBACK_STRATEGY` | `socratic_scaffolding` |

### 9.2 Prompt Stratejisi

`get_system_instruction(student_level)` baştan yazıldı. Yeni prompt:

- **Tam çözüm yasağı:** Doğrudan çalışan kod/cevap anahtarı verilmesi açıkça yasaklandı.
- **Sokratik akış:** `awareness_question` → `guiding_question` → `progressive_hint` → `next_action` zorunlu.
- **Hata taksonomisi:** 13 sabit `error_type` + `major_error_not_detected`; `severity` 4 değerle sınırlı.
- **Rubrik:** 5 kriter, her biri 1–5 arası zorunlu.
- **Meta veri:** `pedagogicalMetadata` merkezi sabitlerle doldurulur; `_enrich_pedagogical_metadata` son kontrol yapar.
- **JSON sözleşmesi:** MVP + v0.2 alanlarının tamamı promptta zorunlu kılındı; `response_schema: GradingResult` korundu.

### 9.3 Değiştirilen Dosyalar

- `backend/app/services.py` — Prompt yeniden yazımı, sabitler, metadata zenginleştirme
- `backend/test_ai.py` — Opsiyonel canlı AI smoke testi (yeni)

### 9.4 Çalıştırılan Testler

| Test | Komut | Sonuç |
| :--- | :--- | :--- |
| Backend syntax | `python -m py_compile app/services.py` | ✅ Başarılı |
| AI smoke test | `python test_ai.py` | ⚠️ Yerel ortamda `pydantic` kurulu değil; betik oluşturuldu |

---

## 10. Faz 3 — PostgreSQL Sokratik Akış Tabloları ve Araştırma Logları

**Tarih:** 2026-07-14  
**Kapsam:** YAYIN_016 araştırması için oturum merkezli veri modeli, Alembic migrasyonları ve `/api/grade` kalıcılığı. Frontend değiştirilmedi.

**İlişkili doküman:** `docs/Socratic_Flow_State_Model.md`

### 10.1 Yeni Veritabanı Varlıkları

| Model | Tablo | Açıklama |
| :--- | :--- | :--- |
| `StudySession` | `study_sessions` | Öğrenci + ödev bağlamında Sokratik çalışma oturumu |
| `Submission` (genişletildi) | `submissions` | `submission_id` (UUID), `session_id`, `attempt_no`, `code_hash` |
| `Evaluation` | `evaluations` | Tam `GradingResult` → `grading_result_json` (JSONB) |
| `InteractionEvent` | `interaction_events` | Append-only olay günlüğü → `metadata_json` (JSONB) |

MVP `submissions.id` (integer PK) korunmuştur. Yeni akış `submission_id` (UUID) üzerinden FK kurar.

### 10.2 Alembic Kurulumu ve Migrasyon Zinciri

```text
234ff9a58f47  add_socratic_flow_tables      (study_sessions, evaluations, interaction_events, submissions genişletme)
96899b4211d0  add_socratic_flow_tables      (users composite unique constraint düzeltmesi)
db8700569b4c  fix_missing_socratic_tables   (şema doğrulama — boş migrasyon)
```

**Komutlar** (`.venv` aktif, `backend/` klasöründe):

```powershell
alembic revision --autogenerate -m "açıklama"
alembic upgrade head
alembic current
```

> **Önemli:** `python -m alembic` kullanmayın. `backend/alembic/` migrasyon klasörü kurulu paketi gölgeler. Doğrudan `alembic` veya `.venv\Scripts\alembic.exe` kullanın.

`alembic/env.py` tüm modelleri açıkça import eder (`StudySession`, `Submission`, `Evaluation`, `InteractionEvent` vb.) — autogenerate'in yeni tabloları görmesi için zorunludur.

### 10.3 `/api/grade` Kalıcılık Akışı

`POST /api/grade` artık opsiyonel olarak PostgreSQL'e yazar:

1. **Ön koşul:** `assignmentId` istek gövdesinde + `Authorization: Bearer <token>` header'ı
2. **AI öncesi:** `StudySession` (yoksa oluştur) + `Submission` + `submission_created` olayı
3. **AI sonrası:** `Evaluation` (`grading_result_json`) + `initial_analysis_completed` / `analysis_completed` olayı

Frontend henüz `assignmentId` ve token göndermiyor; mevcut akış bozulmadı. Faz 4'te `geminiService.ts` güncellendiğinde kalıcı kayıt otomatik devreye girer.

### 10.4 Değiştirilen Dosyalar

- `backend/app/models.py` — Dört Sokratik varlık + `Submission` genişletmesi
- `backend/app/services.py` — `grade_submission_with_persistence`, olay loglama
- `backend/app/main.py` — `create_all()` kaldırıldı; Alembic tek kaynak
- `backend/app/schemas.py` — `assignmentId`, `researchConsent` opsiyonel alanları
- `backend/app/routers/users.py` — `get_optional_current_user` (opsiyonel JWT)
- `backend/app/database.py` — `DATABASE_URL` zorunlu, PostgreSQL `pool_pre_ping`
- `backend/alembic/` — Alembic yapılandırması ve migrasyon dosyaları
- `backend/requirements.txt` — `psycopg2-binary==2.9.11`, `alembic==1.13.1`

### 10.5 Bilinen Sorun ve Çözüm

| Sorun | Kök Neden | Çözüm |
| :--- | :--- | :--- |
| `column "submission_id" referenced in foreign key constraint does not exist` | `create_all()` mevcut `submissions` tablosunu ALTER etmeden `evaluations` oluşturmaya çalışıyordu | `create_all()` kaldırıldı; `alembic upgrade head` ile şema güncellenir |

### 10.6 Çalıştırılan Testler

| Test | Komut | Sonuç |
| :--- | :--- | :--- |
| Alembic migrasyon | `alembic upgrade head` | ✅ Başarılı (`db8700569b4c` head) |
| DB kalıcılık | `prepare_submission_for_grading` + `finalize_grading_persistence` | ✅ `session_started` → `submission_created` → `initial_analysis_completed` |
| Sunucu başlatma | `python -c "from app.main import app"` | ✅ Başarılı (create_all kaldırıldıktan sonra) |

---

## 11. Faz 4 — Sokratik İskeleleme (Scaffolding)

**Tarih:** 2026-07-17  
**Kapsam:** AI Analiz Raporu modalının Sokratik "Aşamalı Gösterim" (Progressive Disclosure) mantığına geçirilmesi, iskeleleme "fading" (destek geri çekme) kuralları, ilgili UX routing düzeltmeleri ve backend JSON ayrıştırma güvenliği. Yalnızca `frontend/App.tsx` ve `backend/app/services.py` değiştirildi; veritabanı modeli değiştirilmedi.

### 11.1 Aşamalı Gösterim (Progressive Disclosure) — Faz 4.0

AI Analiz Raporu modalı artık tüm veriyi (puan, rubrik, hata listesi, Sokratik geri bildirim) tek seferde göstermez. `scaffoldingLevel` state'i (0–3) modalın ne kadarının açıldığını kontrol eder:

| Seviye | Gösterilen İçerik |
| :--- | :--- |
| 0 | Yalnızca `socraticFeedback.awareness_question` (Farkındalık Sorusu) |
| 1 | + `guiding_question` (Yönlendirici Soru) |
| 2 | + `progressive_hint` ve `next_action` (İpucu ve Sonraki Adım) |
| 3 | Tam Rapor: puan, rubrik alt puanları, birim testleri, hata listesi, gönderilen kod |

- Gizleme yalnızca **öğrenci görünümünde** ve `socraticFeedback` verisi mevcutsa (`isGated`) uygulanır. Öğretmen/süper admin görünümü ve Sokratik verisi olmayan eski kayıtlar her zaman doğrudan Seviye 3'ü (tam rapor) gösterir.
- Footer'da iki dinamik aksiyon butonu bulunur: **"Kodumu Düzenle"** (modalı kapatıp editörü Sokratik feedback göstermeden yeniden açar) ve **"Daha Fazla İpucu"** (Seviye 2'de "Tam Raporu Gör (Önerilmez)" uyarı metnine döner; Seviye 3'te "Kapat"a dönüşür).

### 11.2 Faz 4.1 — UX Routing Düzeltmeleri

İki yönlendirme hatası giderildi:

1. **Gönderim sonrası Ana Sayfa'ya atma hatası:** `handleSubmitCode` başarılı teslimden sonra `setCurrentView('home')` çağırıyordu. Kaldırıldı; öğrenci "Ödevler" görünümünde kalır ve POST yanıtından inşa edilen `Submission` nesnesiyle AI Analiz Raporu modalı otomatik açılır.
2. **"Kodumu Düzenle" Ana Sayfa'ya düşme hatası:** Rapor modalı Ana Sayfa'daki "Ödev Teslim Geçmişim" listesinden açıldığında `currentView` `'home'` kalıyordu; `currentView !== 'assignments'` olduğunda kod modalını temizleyen `useEffect`, yeniden açılan editör modalını anında kapatıyordu. `handleEditCode` artık editörü açmadan önce `setCurrentView('assignments')` çağırır.

### 11.3 Faz 4.2 / 4.2.2 — "Fading" (Destek Geri Çekme) Kuralları

Öğrenciyi gereksiz yere Sokratik adımlarla yormamak için `scaffoldingLevel`'in başlangıç değeri artık statik `0` değil, iki istisnaya bağlı dinamik bir kural setiyle hesaplanır (modal her açıldığında yeniden değerlendirilir):

- **Yüksek Puan istisnası:** İncelenen teslimin puanı **90 ve üzeri** ise (başlangıçta tam puan `=== 100` idi; AI'nın küçük detaylar için kırdığı puanlar yüzünden `>= 90`'a esnetildi) doğrudan Seviye 3 (Tam Rapor) ile başlar.
- **"1 Düzeltme Hakkı" istisnası:** Öğrencinin aynı ödeve (`assignmentId` + `studentId`) ait teslim sayısı **2 veya daha fazla** ise (yani ilk Sokratik ipucu hakkını kullanıp tekrar denemişse), puana bakılmaksızın doğrudan Seviye 3 ile başlar.
- Bu iki koşuldan biri doğruysa (`isSuccessful || isMaxRetriesReached`) footer'daki **"Kodumu Düzenle"** butonu tamamen gizlenir; öğrenciyi tekrar denemeye teşvik eden hiçbir aksiyon kalmaz, yalnızca **"Kapat"** butonu gösterilir (tek başına ortalanmış stille).
- Yalnızca ilk deneme + 90 altı puan durumunda mevcut Sokratik akış (Seviye 0'dan başlama) değişmeden çalışmaya devam eder.

### 11.4 Backend JSON Ayrıştırma Güvenliği

`backend/app/services.py` içindeki `grade_submission`, AI'dan dönen yanıtın bozuk/eksik JSON (örn. token limitine takılmış "Unterminated string...") olduğu durumlarda 500 hatası fırlatmayacak şekilde güçlendirildi:

- **`sanitize_json(raw_text)`:** ` ```json ... ``` ` / ` ``` ... ``` ` markdown code fence'lerini ve modelin JSON dışına eklediği gürültü metnini (ilk `{` – son `}` arası alınarak) temizler.
- **Katmanlı hata yakalama:** `json.loads` artık özel olarak `except json.JSONDecodeError` ile, şema doğrulaması (`StrictGradingResult(**result_json)`) ayrı bir `try/except` ile sarıldı; ikisi de ayrı `WARNING:` logları üretir.
- **`_fallback_grading_result(feedback)`:** Ayrıştırma/doğrulama/API hatalarının tümünde `grade=0` ve tüm v0.2 alanları (`rubricScores`, `errorFindings`, `socraticFeedback`, `pedagogicalMetadata`) `None`/`null` olan güvenli bir `GradingResult` döndürür; frontend bu alanları zaten opsiyonel kabul ettiğinden çökme yaşanmaz.

### 11.5 Değiştirilen Dosyalar

- `frontend/App.tsx` — `scaffoldingLevel` state + dinamik başlangıç kuralları, Sokratik "kapı" UI'ı, footer aksiyon butonları, `handleSubmitCode`/`handleEditCode` routing düzeltmeleri
- `backend/app/services.py` — `sanitize_json`, `_fallback_grading_result`, katmanlı `try/except` ile JSON ayrıştırma güvenliği

### 11.6 Çalıştırılan Testler

| Test | Komut / Yöntem | Sonuç |
| :--- | :--- | :--- |
| Frontend syntax | `npx tsc --noEmit` (App.tsx `@ts-nocheck` altında parse edildi) | ✅ Başarılı (App.tsx'te hata yok; önceden var olan `geminiService.ts` hatası hariç) |
| Frontend HMR | Vite dev sunucusu (`npm run dev`) canlı reload | ✅ Her değişiklikte hatasız `hmr update` |
| Backend syntax | `python -m py_compile app/services.py` | ✅ Başarılı |
| `sanitize_json` / fallback birim testi | Geçici script: fenced/unfenced JSON, kasıtlı bozuk (`Unterminated string`) girdi, fallback şema kontrolü | ✅ Tümü beklenen sonucu verdi |
| Uçtan uca (tarayıcı) | Öğrenci girişiyle gönderim → otomatik rapor açılışı, "Kodumu Düzenle" akışı, 1. vs 2. gönderim Sokratik atlama | ✅ Doğrulandı |

---

## 12. Faz 5 — EduInsight Öğretmen Analitik Paneli

**Tarih:** 2026-08-02
**Kapsam:** Öğretmenin sınıf genelini tek ekrandan izleyebileceği analitik özet endpoint'i ve paneli. Yeni bir veritabanı tablosu eklenmedi; mevcut `submissions` / `evaluations` / `assignments` kayıtları okunup hesaplanıyor.

### 12.1 Yeni Endpoint

`GET /analytics/teacher-summary?class_code=<opsiyonel>` — `backend/app/routers/analytics.py`

- Yetki: yalnızca `teacher` / `superadmin` (diğer router'larla aynı satır içi kontrol deseni).
- Kapsam: `current_user.organization_id` ile kiracı bazında izole; `class_code` verilirse yalnızca o sınıfın öğrencileri.
- `submissions.grading_result` (dict veya eski JSON string) ile `evaluations.grading_result_json` (Sokratik akış) her ikisi de okunup normalize ediliyor.

### 12.2 Sınıf Ortalaması Hesap Mantığı

- Liderlik tablosuyla (`/leaderboard/`) tutarlı olması için ortalama, öğrencinin **her ödevdeki en iyi denemesi** üzerinden hesaplanır — böylece aynı ödeve çok kez giren öğrenci ortalamayı aşağı çekmez.
- `SUCCESS_THRESHOLD = 70` puan eşiği: bir denemenin "başarılı" sayılması için kullanılır (`success_rate`, `first_attempt_success_rate`, `attempts_to_success`).
- **Sokratik etki metrikleri:**
  - `average_attempts`: bir (öğrenci, ödev) çiftinin ortalama deneme sayısı.
  - `first_attempt_success_rate`: hiç ipucu almadan ilk denemede eşiği geçenlerin oranı.
  - `average_improvement`: yalnızca tekrar denenen ödevlerde ilk denemeden en iyi denemeye puan kazancı.
  - Öğrenci bazında `attempts_to_success`: eşiğin ilk aşıldığı deneme sırası — "kaçıncı denemede başarılı oldu" takibi.

### 12.3 Kavram Yanılgıları / Hata Dağılımı Filtresi

- `errorFindings` dizisindeki her kayıt `error_type` bazında sayılır, öğrenci sayısı ve `severity` dağılımıyla birlikte raporlanır.
- `major_error_not_detected` türü listeden **hariç tutulur** — bu değer AI'ın "anlamlı hata bulamadım" durumudur, kavram yanılgısı istatistiğinde gürültü yaratır.
- `misconception` alanındaki dolgu değerleri (`"Yok"`, `"Belirtilmedi"`, `"-"`, boş string) örnek alıntılardan elenir; her hata türü için en fazla 3 benzersiz örnek gösterilir.

### 12.4 Sokratik Destek Oranı

- `socratic_support_rate`: değerlendirilen teslimler içinde `socraticFeedback` üretilmiş **ve** `direct_solution_given = false` olanların payı.
- Bu oran, AI'ın "tam çözüm verme" yasağına (bkz. §9.2) ne ölçüde uyduğunun öğretmene gösterilen canlı göstergesidir.

### 12.5 Frontend

- `frontend/components/EduInsight.tsx` — üç sekmeli panel (Genel Bakış, Kavram Yanılgıları, Öğrenci Gelişimi); mevcut tasarım dili (dark-800 kartlar, CSS tabanlı çubuk grafikler) korunmuş, yeni bağımlılık eklenmemiştir.
- `Layout.tsx` sol menüsüne öğretmen/süper admin için "EduInsight" girişi eklendi; `App.tsx`'te `analytics` view'ı olarak yönlendirildi.

### 12.6 Değiştirilen / Eklenen Dosyalar

- `backend/app/routers/analytics.py` — yeni router (yeni dosya)
- `backend/app/main.py` — `analytics.router` kaydı
- `frontend/components/EduInsight.tsx` — yeni panel bileşeni (yeni dosya)
- `frontend/components/Layout.tsx` — "EduInsight" navigasyon girişi
- `frontend/App.tsx` — `analytics` view routing
- `frontend/vite-env.d.ts` — Vite istemci tip tanımları (yeni dosya; bkz. §12.7)

### 12.7 TypeScript Tip Düzeltmesi (`import.meta.env`)

`tsc --noEmit` daha önce `services/geminiService.ts` içinde `Property 'env' does not exist on type 'ImportMeta'` uyarısı veriyordu (proje kökünde `vite-env.d.ts` yoktu). `frontend/vite-env.d.ts` eklenerek `/// <reference types="vite/client" />` tanımı sağlandı; `tsc --noEmit` artık hatasız/uyarısız tamamlanıyor.

### 12.8 Çalıştırılan Testler

| Test | Komut | Sonuç |
| :--- | :--- | :--- |
| Backend syntax/import | `python -c "from app.routers import analytics"` | ✅ Başarılı |
| Frontend TypeScript | `npx tsc --noEmit` | ✅ Hatasız (önceki `ImportMeta.env` uyarısı giderildi) |
| Uçtan uca (tarayıcı) | `test.user` (teacher) girişiyle `/analytics/teacher-summary` çağrısı, sınıf filtresi, üç sekme | ✅ Doğrulandı |

---

## 13. Faz 6 — Canlıya Alım ve Sürüm Paketleme

**Tarih:** 2026-08-03
**Kapsam:** Bekleyen refaktör değişikliklerinin commitlenmesi, sürüm dokümantasyonunun tamamlanması ve `origin/main` üzerinden Coolify otomatik dağıtımının tetiklenmesi.

### 13.1 Refaktör Özeti (`refactor: clean up legacy modules and update routing persistence`)

- **Backend:** Router'larda kiracı izolasyonu ve `AbortController` uyumlu istek iptali desenleri; `jwt_auth` güçlendirmesi; `badges.py` evaluation JSONB geri dönüşü; `schemas.py` grading_result normalizasyonu.
- **Frontend:** `persistence.ts` (localStorage CRUD) kaldırıldı — tüm uygulama verisi FastAPI backend + `AuthContext` oturum sınırına taşındı. `AuthContext` oturum doğrulama (`/users/me`), `sessionNonce` remount ve kiracı değiştirme akışı güçlendirildi. Dashboard bileşenlerinde paralel fetch (`Promise.allSettled`) ve abort temizliği standartlaştırıldı. `geminiService.ts` istek iptali (`AbortSignal`) desteği eklendi.

### 13.2 Sürüm Paketi

| Commit | Mesaj |
| :--- | :--- |
| Faz 5 | `feat: add EduInsight teacher analytics dashboard and fix ts vite env types` |
| Faz 6 | `refactor: clean up legacy modules and update routing persistence` |
| Faz 6 (dok.) | `docs: add Faz 6 deployment notes and project documentation` |

### 13.3 Dağıtım

- Dal: `feature/cgai-v0.2-socratic-feedback` → `main` merge edilerek `origin/main`'e push edildi.
- Coolify, `main` dalındaki push ile otomatik build/deploy tetikler.
- Canlı ortam öncesi: `alembic upgrade head` (PostgreSQL Sokratik akış tabloları) ve `ALLOWED_ORIGINS` / `DATABASE_URL` / `GEMINI_API_KEY` env değişkenlerinin doğrulanması gerekir.

### 13.4 Eklenen Dokümantasyon ve Test Artifaktları

- `SUNUCU_BASLATMA.md` — yerel backend/frontend başlatma rehberi
- `docs/` — MVP özellik matrisi, pedagojik iş akışı raporu, Sokratik Flow State Model, v0.2 geliştirme hedefleri
- `test raporları/` — Faz 0 kabul testi raporu ve ekran kayıtları
- `backend/test_ai.py` — opsiyonel AI smoke test betiği

---

## 14. Faz 7 — Kapanış Öncesi Kritik UX ve Pedagojik Mantık Düzeltmeleri

**Tarih:** 2026-08-03
**Kapsam:** v0.2.0-research sürümünün uzman değerlendirmesi öncesi manuel testlerde (Test 1–3) tespit edilen dört kritik hatanın giderilmesi. Yalnızca `frontend/App.tsx`, `frontend/utils/parseGradingResult.ts` ve `backend/app/services.py` değiştirildi; veritabanı modeli/migrasyon değişmedi.

### 14.1 Editör State Temizliği (Test 1)

Önceki kullanıcının/denemenin kod editöründe kalıntı bırakmaması için mevcut kapatma yollarına (`closeCodeModal`, view-değişim `useEffect`'i) ek olarak iki bağımsız güvenlik ağı eklendi:

- `isModalOpen === false` olduğunda `codeDraft` her koşulda sıfırlanır — modal hangi yoldan kapatılırsa kapatılsın (gelecekte eklenecek yeni bir kapama noktası dahil) kalıntı kalmaz.
- `token` düşerse (logout / oturum sonu) `codeDraft` ve `isModalOpen` anında temizlenir; bu, `AuthContext`'in `sessionNonce` ile tüm `AppContent`'i remount ettirmesinden (§13.2) bağımsız ikinci bir katmandır.

### 14.2 Yetkisiz Erişim Yönlendirmesi (Test 2)

Bu SPA `react-router` kullanmadığından (view state + query param tabanlı yönlendirme), rol bazlı korumalı bir view'a (örn. öğrencinin `analytics`'e) girilmeye çalışılması önceden `return null` ile boş ekrana düşüyordu. Düzeltme:

- `ROLE_RESTRICTED_VIEWS` haritası (`teacher_dashboard`, `assignment_detail`, `announcement_management`, `analytics`, `students`, `student_analysis_detail` → `teacher`/`superadmin`; `system_panel` → yalnızca `superadmin`).
- Tüm hook'lardan sonra ama **herhangi bir erken `return`'den önce** tanımlı bir `useEffect` (Rules of Hooks), yetkisiz bir view tespit ettiğinde otomatik olarak `home`'a yönlendirir ve "403 · Yetkisiz Erişim" toast'ı gösterir.
- Redirect effect'i devreye girene kadarki tek render karesi için de boş ekran kalmaması adına, ana render bloğunda `return null` yerine yeni `Unauthorized403` bileşeni gösterilir.

### 14.3 Dirençli JSON Parse Edici

AI'dan (veya eski/bozuk kayıtlardan) gelen JSON'ın markdown code fence (` ```json ... ``` `) veya trailing comma (`..., }` / `..., ]`) içermesi durumunda sistemin çökmemesi güçlendirildi:

- **Backend** (`backend/app/services.py` → `sanitize_json`): mevcut fence temizliğine trailing comma toleransı eklendi (`re.sub(r",(\s*[}\]])", r"\1", cleaned)`). `grade_submission` içindeki katmanlı `try/except` (§11.4) zaten hem `JSONDecodeError` hem şema doğrulama hatasını `_fallback_grading_result` ile karşılıyordu; bu değişiklik fallback'e düşme ihtimalini daha da azaltır.
- **Frontend** (`frontend/utils/parseGradingResult.ts`): yeni `sanitizeJsonString` yardımcı fonksiyonu (fence + trailing comma temizliği) eklendi. `JSON.parse` ilk denemede başarısız olursa temizlenmiş metinle ikinci kez denenir; o da başarısız olursa dış `try/catch` `null` döner — hiçbir girdi için istisna kullanıcıya sızmaz.

### 14.4 Pedagojik Deneme Gruplaması (Test 3)

Öğrenci ekranında aynı ödeve yapılan birden fazla deneme artık ayrı ayrı "ödevmiş gibi" listelenmiyor; `assignment_id` bazında gruplanıyor:

- **Ana Sayfa** ("Ödev Teslim Geçmişim"): `studentSubs` artık `assignment_id` başına yalnızca **en son deneme** ile temsil ediliyor (`latestSubmissionByAssignment` Map'i); birden fazla denemede başlığın yanına "N. Deneme" rozeti ekleniyor.
- **Ödevler görünümü** (öğrenci kartı): `studentSubmission` artık o ödeve ait denemelerin **en sonuncusu**; "TAMAMLANDI" rozetinin yanına deneme sayacı rozeti eklendi.
- **Teslim Detay Modalı:** birden fazla deneme varsa üstte kronolojik "1. Deneme (puan) / 2. Deneme (puan)…" sekmeleri render edilir (`attemptSiblings`, `submittedAt`'e göre artan sıralı). Her sekme yalnızca **kendi** `submission` kaydını (dolayısıyla kendi Sokratik geri bildirimini) gösterir — denemeler arası geri bildirim karışması engellenir. Yan panelde "X. Deneme / Y Toplam" bilgisi eklendi.
- Öğretmenin "Ödev Detayı" tablosu (`renderAssignmentDetailView`) bilinçli olarak **değiştirilmedi**: öğretmen her denemeyi ayrı satırda görüp not/silme işlemi yapabilmelidir.

### 14.5 Değiştirilen Dosyalar

- `frontend/App.tsx` — editör state güvenlik ağları, `ROLE_RESTRICTED_VIEWS` + yönlendirme `useEffect`'i + `Unauthorized403` bileşeni, ana sayfa/ödevler görünümü deneme gruplaması, teslim detay modalına deneme sekmeleri
- `frontend/utils/parseGradingResult.ts` — `sanitizeJsonString` + iki aşamalı (`JSON.parse` → sanitize → tekrar `JSON.parse`) dirençli ayrıştırma zinciri
- `backend/app/services.py` — `sanitize_json` içine trailing comma toleransı

### 14.6 Çalıştırılan Testler

| Test | Komut / Yöntem | Sonuç |
| :--- | :--- | :--- |
| Frontend TypeScript | `npx tsc --noEmit` | ✅ Hatasız |
| Backend syntax | `python -m py_compile app/services.py` | ✅ Başarılı |
| `sanitize_json` birim testi | Geçici script: markdown fence + trailing comma içeren bozuk JSON | ✅ Temizlenip başarıyla `json.loads` edildi |
| Linter | `ReadLints` (App.tsx, parseGradingResult.ts, services.py) | ✅ Hata yok |
