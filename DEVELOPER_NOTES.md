# CodeGrade AI - Technical Constitution & Architecture Guide

This document serves as the primary technical reference for CodeGrade AI. It defines the architectural standards, security protocols, and operational logic that every contributor must adhere to.

---

## 1. Core Architecture & Database Strategy

### 1.1 Database Engine
- **Production:** PostgreSQL (`psycopg2`) is the mandatory standard.
- **Development:** SQLite is permitted for local testing but discouraged for integration tests due to constraint differences.

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
