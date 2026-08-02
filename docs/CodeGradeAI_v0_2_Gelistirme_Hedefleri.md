# CodeGradeAI v0.2 Geliştirme Hedefleri

**Doküman amacı:**  
Bu doküman, YAYIN_006 kapsamında CodeGradeAI uygulamasının mevcut MVP düzeyinden, akademik olarak savunulabilir bir “rubrik tabanlı, hata taksonomili ve Sokratik/kademeli geri bildirim üreten öğretim teknolojisi artefaktı” düzeyine çıkarılması için gerekli geliştirme hedeflerini tanımlar.

**İlgili yayın:**  
YAYIN_006 – *Programlama Eğitiminde Yapay Zekâ Destekli Sokratik Geri Bildirim Sistemi Tasarımı: CodeGradeAI Üzerine Tasarım Bilimi ve Uzman Değerlendirmesi*

**Akademik amaç:**  
Bu geliştirme hattının amacı yeni ve kapsamlı bir ürün inşa etmek değildir. Amaç, mevcut çalışan MVP’nin YAYIN_006’da ileri sürülecek pedagojik tasarım iddialarını kod, ekran, veri şeması ve örnek çıktı düzeyinde kanıtlanabilir hale getirmektir.

---

## 1. Mevcut Durum Özeti

CodeGradeAI mevcut MVP düzeyinde aşağıdaki temel özelliklere sahiptir:

- React/Vite tabanlı frontend.
- FastAPI tabanlı backend.
- Öğrenci, öğretmen ve süper admin rolleri.
- Öğretmenin ödev oluşturması, düzenlemesi ve silmesi.
- Öğrencinin ödeve kod göndermesi.
- `/api/grade` uç noktası üzerinden AI destekli kod değerlendirme.
- Gemini API ile değerlendirme üretimi.
- Mevcut `GradingResult` alanları:
  - `grade`
  - `feedback`
  - `codeQuality`
  - `suggestions`
  - `unitTests`
- Teslimlerde öğrenci kodu, AI değerlendirme JSON’u ve teslim zamanı saklanmaktadır.

Mevcut MVP’nin güçlü tarafı çalışan bir AI destekli kod değerlendirme akışına sahip olmasıdır. Ancak YAYIN_006’da kullanılacak “Sokratik geri bildirim”, “kademeli iskeleleme”, “hata farkındalığı” ve “rubrik tabanlı pedagojik değerlendirme” iddialarını desteklemek için bazı alanlar eksiktir.

---

## 2. Geliştirme Hedefi

Kod görevinin önerilen adı:

> **CodeGradeAI v0.2 — Rubrik Tabanlı Hata Taksonomisi ve Sokratik Geri Bildirim Modülü**

Ana geliştirme hedefi:

```text
Mevcut AI değerlendirme sonucuna;
1. açık hata sınıflandırması,
2. rubrik alt puanları,
3. Sokratik soru,
4. kademeli ipucu,
5. doğrudan çözüm vermeme kontrolü,
6. prompt/model versiyon logu,
7. araştırma amaçlı dışa aktarılabilir yapılandırılmış kayıt
eklenecek.
```

Bu geliştirme YAYIN_006 için “tasarım bilimi artefaktı” kanıtını güçlendirir. Ayrıca YAYIN_016’da yürütülecek olası etkililik çalışması için öğrenme analitiği ve müdahale takibi altyapısı sağlar.

---

## 3. Kapsam Dışı Bırakılanlar

Bu geliştirme hattında aşağıdaki hedefler öncelikli değildir:

- Tam otomatik gerçek kod çalıştırma / güvenli sandbox test runner.
- Gelişmiş IDE entegrasyonu.
- Çok modelli LLM karşılaştırması.
- Öğrenci başarısı analizi.
- Ön test-son test veri toplama.
- Deney-kontrol uygulaması.
- Tam öğrenme analitiği paneli.
- Gelişmiş dashboard görselleştirmeleri.

Bu konular YAYIN_006’nın kapsamını aşar ve gerekirse YAYIN_016 veya sonraki çalışmalar için ele alınmalıdır.

---

## 4. Faz 0 — Güvenli Hazırlık ve Mevcut Davranışı Koruma

### Amaç

Mevcut çalışan MVP bozulmadan yeni şema ve alanlara geçmek.

### Yapılacaklar

1. Mevcut `GradingResult` alanları korunacak:
   - `grade`
   - `feedback`
   - `codeQuality`
   - `suggestions`
   - `unitTests`

2. Yeni alanlar opsiyonel eklenecek.

3. Eski değerlendirme kayıtlarının frontend’de açılması garanti altına alınacak.

4. `grading_result` JSON yapısı versiyonlu hale getirilecek.

5. Eski kayıtlarda yeni alanlar yoksa frontend hata vermeyecek.

### Kabul Kriterleri

- Eski teslim kayıtları sonuç ekranında açılmaya devam eder.
- Yeni AI yanıtı eski alanları da içerir.
- API geriye uyumlu çalışır.
- Frontend build/test süreci bozulmaz.
- Veritabanındaki eski kayıtlar migrasyon sonrasında erişilebilir kalır.

---

## 5. Faz 1 — Yeni Değerlendirme Şemasının Tanımlanması

### Amaç

AI çıktısını akademik olarak savunulabilir bir forma sokmak.

Mevcut sistemde AI çıktısı `grade`, `feedback`, `codeQuality`, `suggestions` ve `unitTests` düzeyinde kalmaktadır. YAYIN_006 için bu yapı genişletilmelidir.

### Önerilen Yeni `GradingResult` Şeması

Backend `schemas.py` içinde mevcut `GradingResult` aşağıdaki alanlarla genişletilmelidir:

```python
class RubricScores(BaseModel):
    correctness: int
    algorithmic_thinking: int
    syntax_and_language_use: int
    code_readability: int
    debugging_awareness: int


class ErrorFinding(BaseModel):
    error_type: str
    severity: str
    location_hint: Optional[str] = None
    explanation: str
    misconception: Optional[str] = None


class SocraticFeedback(BaseModel):
    awareness_question: str
    guiding_question: str
    progressive_hint: str
    next_action: str
    direct_solution_given: bool


class PedagogicalMetadata(BaseModel):
    feedback_strategy: str
    scaffolding_level: str
    student_level: str
    prompt_version: str
    rubric_version: str
    model_name: Optional[str] = None


class GradingResult(BaseModel):
    grade: int
    feedback: str
    codeQuality: str
    suggestions: List[str]
    unitTests: List[UnitTestResult]

    rubricScores: Optional[RubricScores] = None
    errorFindings: Optional[List[ErrorFinding]] = None
    socraticFeedback: Optional[SocraticFeedback] = None
    pedagogicalMetadata: Optional[PedagogicalMetadata] = None
```

### Hata Taksonomisi

İlk sürüm için sabit hata türleri yeterlidir:

```text
syntax_error
runtime_error
logic_error
conceptual_error
boundary_case_error
data_type_error
loop_error
conditional_error
function_structure_error
input_output_format_error
code_readability_issue
incomplete_solution
```

### Hata Şiddeti

```text
low
medium
high
blocking
```

### İskeleleme Seviyesi

```text
awareness
guided_hint
strategic_hint
near_solution
```

Not: `near_solution` aşamasında bile tam çözüm kodu verilmemelidir.

### Kabul Kriterleri

- Backend yeni şemayı doğrular.
- `errorFindings` en az bir hata kaydı veya açık bir “major_error_not_detected” durumu döndürür.
- `rubricScores` 1-5 arası alt puanlar içerir.
- `socraticFeedback.direct_solution_given` alanı mutlaka döner.
- Eski frontend alanları bozulmaz.
- Yeni alanlar yoksa frontend kontrollü biçimde boş gösterir.

---

## 6. Faz 2 — Prompt ve AI Çıktı Sözleşmesinin Güncellenmesi

### Amaç

Başlıktaki “Sokratik geri bildirim” iddiasını kod düzeyinde kanıtlanabilir hale getirmek.

Mevcut MVP, pedagojik ve seviye uyarlamalı geri bildirim üretmektedir. Ancak açık bir Sokratik/kademeli çok aşamalı mekanizma içermemektedir. Bu nedenle prompt açık biçimde yeniden yapılandırılmalıdır.

### Güncellenecek Alan

Backend `services.py` içinde `get_system_instruction(student_level)` veya eşdeğer prompt üretim fonksiyonu güncellenecektir.

### Yeni Prompt İlkeleri

Prompt aşağıdaki kuralları açık biçimde içermelidir:

```text
1. Öğrenciye doğrudan tam çözüm kodu verme.
2. Önce hatayı fark ettirecek bir soru sor.
3. Sonra yönlendirici bir soru üret.
4. Gerekirse kademeli ipucu ver.
5. Öğrencinin bir sonraki denemede neyi değiştirmesi gerektiğini açıkla.
6. Hata türlerini önceden tanımlı taksonomiden seç.
7. Rubrik alt puanlarını 1-5 arası ver.
8. Genel puanı 0-100 arası ver.
9. Eğer tam çözüm verdiysen `direct_solution_given=true` yap.
10. Yanıtı yalnızca JSON olarak üret.
```

### Merkezi Versiyon Sabitleri

Kod içinde merkezi olarak şu sabitler tanımlanmalıdır:

```text
prompt_version = cgai_prompt_v0.2
rubric_version = cgai_rubric_v0.2
feedback_strategy = socratic_scaffolding
```

Model adı yapılandırma dosyasından veya servis katmanından alınmalıdır.

### Beklenen JSON Örneği

```json
{
  "grade": 72,
  "feedback": "Çözümün genel akışı doğruya yakın; ancak döngü koşulu tüm olası durumları kapsamıyor.",
  "codeQuality": "Orta düzeyde okunabilir, ancak değişken adları ve koşul kontrolü geliştirilmeli.",
  "suggestions": [
    "Döngünün hangi durumda duracağını küçük bir örnekle takip et.",
    "Sınır değerlerde kodun nasıl davrandığını kontrol et."
  ],
  "unitTests": [
    {
      "test": "Pozitif normal giriş",
      "passed": true,
      "message": "Temel durumda beklenen çıktıya ulaşıyor."
    },
    {
      "test": "Sınır değer",
      "passed": false,
      "message": "Döngü sınır koşulunda beklenen sonucu üretmiyor."
    }
  ],
  "rubricScores": {
    "correctness": 3,
    "algorithmic_thinking": 3,
    "syntax_and_language_use": 4,
    "code_readability": 3,
    "debugging_awareness": 2
  },
  "errorFindings": [
    {
      "error_type": "boundary_case_error",
      "severity": "medium",
      "location_hint": "Döngü koşulu",
      "explanation": "Kod temel durumda çalışsa da sınır değerleri yeterince ele almıyor.",
      "misconception": "Öğrenci döngünün tüm giriş aralıklarında aynı şekilde davranacağını varsaymış olabilir."
    }
  ],
  "socraticFeedback": {
    "awareness_question": "Döngünün hangi değerde durmasını bekliyorsun?",
    "guiding_question": "Sınır değeri elle denediğinde değişkenlerin nasıl değiştiğini görebiliyor musun?",
    "progressive_hint": "Koşul ifadesini küçük bir giriş değeriyle adım adım takip et.",
    "next_action": "Kodunu bir sınır değerle yeniden çalıştırıp döngü koşulunu güncelle.",
    "direct_solution_given": false
  },
  "pedagogicalMetadata": {
    "feedback_strategy": "socratic_scaffolding",
    "scaffolding_level": "guided_hint",
    "student_level": "beginner",
    "prompt_version": "cgai_prompt_v0.2",
    "rubric_version": "cgai_rubric_v0.2",
    "model_name": "configured_model_name"
  }
}
```

### Kabul Kriterleri

- AI yanıtı yeni alanları döndürmeye çalışır.
- JSON parse hatasında güvenli fallback çalışır.
- Prompt içinde “tam çözüm kodu verme” ilkesi açık yer alır.
- `prompt_version` ve `rubric_version` merkezi sabitlerden gelir.
- `feedback_strategy` varsayılan olarak `socratic_scaffolding` olur.
- `direct_solution_given` alanı kontrol edilebilir biçimde döner.

---

## 7. Faz 3 — Veritabanı ve Araştırma Logları

### Amaç

YAYIN_006 için uzman değerlendirmesine, YAYIN_016 için öğrenme analitiğine kanıt üretmek.

Mevcut teslim kayıtlarında öğrenci kodu, AI değerlendirme JSON’u ve teslim zamanı saklanmaktadır. Ancak model/prompt versiyon logu, rubrik puanları, hata türleri ve Sokratik geri bildirim alanları ayrı olarak sorgulanabilir biçimde tutulmamaktadır.

### Minimum Veri Modeli Değişikliği

Mevcut `submissions` tablosuna aşağıdaki nullable alanlar eklenebilir:

```python
attempt_no = Column(Integer, default=1)
prompt_version = Column(String, nullable=True)
rubric_version = Column(String, nullable=True)
model_name = Column(String, nullable=True)
feedback_strategy = Column(String, nullable=True)
scaffolding_level = Column(String, nullable=True)
error_types = Column(Text, nullable=True)       # JSON string
rubric_scores = Column(Text, nullable=True)     # JSON string
research_session_id = Column(String, nullable=True)
```

### Daha Temiz Alternatif: `feedback_events` Tablosu

YAYIN_016 açısından daha doğru çözüm ayrı bir tablo oluşturmaktır:

```text
feedback_events
```

Önerilen alanlar:

```text
id
submission_id
user_id
assignment_id
created_at
model_name
prompt_version
rubric_version
feedback_strategy
scaffolding_level
error_types_json
rubric_scores_json
socratic_feedback_json
direct_solution_given
raw_ai_response_json
parse_status
latency_ms
```

### Öneri

- YAYIN_006 için hızlı ilerlemek gerekiyorsa `submissions` tablosuna nullable alanlar eklemek yeterlidir.
- YAYIN_016 için veri bütünlüğü ve analiz kolaylığı açısından `feedback_events` tablosu daha uygundur.

### Araştırma Açısından Saklanması Gereken Alanlar

```text
assignment_id
user_id
submission_id
student_level
programming_language
grade
rubric_scores
error_types
socratic_feedback
direct_solution_given
prompt_version
rubric_version
model_name
submitted_at
```

### Gizlilik Notu

Export sırasında öğrenci adı, öğrenci numarası, e-posta ve doğrudan tanımlayıcı bilgiler çıkarılmalıdır. Araştırma verisi anonim veya takma kimlikli olmalıdır.

### Kabul Kriterleri

- Yeni teslimlerde prompt/rubrik/model bilgisi saklanır.
- Hata türleri JSON olarak saklanır.
- Rubrik puanları JSON olarak saklanır.
- `direct_solution_given=true` çıktıları tespit edilebilir.
- Eski kayıtlar migrasyon sonrası bozulmaz.
- Araştırma dışa aktarımı doğrudan kişisel veri içermez.

---

## 8. Faz 4 — Frontend Sonuç Ekranı

### Amaç

Uzmanların, öğrencilerin ve öğretim elemanlarının yeni pedagojik bileşenleri görebilmesi.

Mevcut sonuç ekranında puan, kod kalitesi, genel geri bildirim, birim testleri ve öneriler ayrı bloklarda gösterilmektedir. Buna yeni pedagojik bloklar eklenmelidir.

### Yeni UI Blokları

Sonuç modalına aşağıdaki bloklar eklenmelidir:

```text
1. Rubrik Alt Puanları
2. Tespit Edilen Hata Türleri
3. Sokratik Geri Bildirim
4. Sonraki Deneme İçin Önerilen Adım
5. Sistem Bilgisi: prompt/rubrik/model versiyonu
```

### Öğrenciye Gösterilecek Alanlar

```text
- Farkındalık sorusu
- Yönlendirici soru
- Kademeli ipucu
- Bir sonraki adım
- Rubrik alt puanları
- Hata türü açıklaması
```

### Öğrenciye Gösterilmemesi Gereken Alanlar

```text
- raw_ai_response_json
- parse_status
- latency_ms
- teknik prompt içeriği
```

Prompt/rubrik/model versiyonları öğrenci ekranında doğrudan gösterilmeyebilir. Gerekirse “sistem bilgisi” altında küçük ve pasif bir bilgi olarak tutulabilir.

### Öğretmene Gösterilecek Alanlar

```text
- Öğrenci ekranında görünen tüm pedagojik alanlar
- Hata türü dağılımı
- Rubrik alt puanları
- direct_solution_given uyarısı
- Model/prompt/rubrik versiyonu
```

### `direct_solution_given` Uyarısı

Eğer `direct_solution_given=true` ise öğretmen ekranında şu tür bir uyarı gösterilebilir:

```text
Bu değerlendirme çıktısında doğrudan çözüm verme riski tespit edilmiştir. Geri bildirimin pedagojik uygunluğu öğretim elemanı tarafından kontrol edilmelidir.
```

### Kabul Kriterleri

- Eski kayıt açıldığında yeni alanlar yoksa ekran kırılmaz.
- Yeni kayıt açıldığında rubrik ve Sokratik geri bildirim blokları görünür.
- `direct_solution_given=true` ise öğretmen ekranında uyarı görünür.
- Mobil ve masaüstü görünümde modal taşmaz.
- Öğrenci ekranı karmaşık teknik ayrıntılarla yüklenmez.

---

## 9. Faz 5 — Öğretmen/Araştırmacı İçin Dışa Aktarım

### Amaç

YAYIN_006 uzman değerlendirmesinde kullanılacak örnek çıktıların ve YAYIN_016 loglarının dışa alınabilmesi.

### Minimum Export Özelliği

Öğretmen paneline veya admin paneline şu işlem eklenebilir:

```text
Ödev bazlı JSON/CSV dışa aktar
```

### CSV Alanları

```text
submission_id
assignment_id
student_pseudonym
student_level
language
grade
correctness
algorithmic_thinking
syntax_and_language_use
code_readability
debugging_awareness
error_types
scaffolding_level
direct_solution_given
submitted_at
prompt_version
rubric_version
model_name
```

### Örnek Olay Export’u

YAYIN_006 için ayrıca örnek olay dışa aktarımı yararlıdır:

```text
assignment_description
sample_student_code
grading_result_json
socratic_feedback
rubric_scores
error_findings
```

Bu çıktı uzman değerlendirmesinde kullanılabilir.

### Gizlilik Kuralları

Export aşağıdaki alanları içermemelidir:

```text
student_name
student_number
email
password
organization-specific direct identifier
```

`student_pseudonym` deterministik ama anonim üretilmelidir.

Örnek:

```text
student_pseudonym = hash(organization_id + user_id + research_salt)
```

### Kabul Kriterleri

- Export kişisel veri içermez.
- Öğrenci adı, numarası ve e-posta dışa aktarılmaz.
- `student_pseudonym` deterministik ama anonim üretilir.
- Belirli bir ödev için tüm teslimler CSV veya JSON olarak alınabilir.
- Export dosyası YAYIN_006 uzman değerlendirmesi için örnek çıktı seti üretmeye uygundur.

---

## 10. Faz 6 — Sistem Dokümantasyonu ve Test Kanıtları

### Amaç

Makalede “sistem tasarımı” bölümünü kanıtlanabilir hale getirmek.

### Üretilecek Teknik Dokümanlar

Kod deposuna aşağıdaki dosyalar eklenmelidir:

```text
docs/codegradeai_v0_2_design.md
docs/rubric_v0_2.md
docs/error_taxonomy_v0_2.md
docs/socratic_feedback_schema_v0_2.md
docs/research_export_fields.md
```

### Her Dokümanın İçeriği

#### `docs/codegradeai_v0_2_design.md`

- Sistemin amacı.
- Kullanıcı rolleri.
- Öğrenci iş akışı.
- Öğretmen iş akışı.
- AI değerlendirme akışı.
- Pedagojik geri bildirim mimarisi.
- YAYIN_006 için araştırma kapsamı.
- YAYIN_016 için gelecekteki kullanım.

#### `docs/rubric_v0_2.md`

- Rubrik boyutları.
- 1-5 puan açıklamaları.
- Genel puana katkı mantığı.
- Programlama kazanımlarıyla ilişki.

#### `docs/error_taxonomy_v0_2.md`

- Hata türleri.
- Her hata türünün tanımı.
- Örnek öğrenci hatası.
- Uygun geri bildirim türü.

#### `docs/socratic_feedback_schema_v0_2.md`

- Sokratik geri bildirim alanları.
- Farkındalık sorusu.
- Yönlendirici soru.
- Kademeli ipucu.
- Sonraki adım.
- Tam çözüm vermeme ilkesi.

#### `docs/research_export_fields.md`

- Export alanları.
- Kişisel veri dışlama kuralları.
- Araştırma amaçlı kullanılabilecek alanlar.
- YAYIN_006 ve YAYIN_016 ayrımı.

### Sentetik Test Senaryoları

En az 5 sentetik görevle test yapılmalıdır:

```text
1. Syntax hatası
2. Mantık hatası
3. Döngü sınır hatası
4. Veri tipi hatası
5. Eksik çözüm
```

### Her Senaryoda Kontrol Edilecekler

```text
- Hata türü doğru alana yazılmış mı?
- Rubrik puanları var mı?
- Sokratik soru üretilmiş mi?
- Kademeli ipucu üretilmiş mi?
- Tam çözüm verilmemiş mi?
- Öğrenci ekranında anlaşılır görünüyor mu?
- Öğretmen ekranında analiz edilebilir mi?
- Prompt/rubrik/model versiyonu kaydedilmiş mi?
```

### Kabul Kriterleri

- 5 örnek görev için kayıt üretildi.
- Her kayıtta yeni JSON alanları dolu.
- En az 1 örnek çıktı makaleye ekran görüntüsü veya şema olarak alınabilir.
- README veya docs içinde sistemin v0.2 özellikleri açıklanmış.
- Geliştirme sonrası sistem tanımı YAYIN_006 yöntem bölümünde kullanılabilir hale gelmiş.

---

## 11. Önceliklendirme

| Öncelik | Faz | Gerekçe |
|---|---|---|
| P0 | Faz 1 — Backend şema genişletme | YAYIN_006’nın akademik iddiası için zorunlu |
| P0 | Faz 2 — Prompt güncelleme | Sokratik/kademeli geri bildirimin kodda karşılığı olur |
| P1 | Faz 4 — Frontend sonuç ekranı | Uzman değerlendirmesi için somut ekran ve çıktı gerekir |
| P1 | Faz 6 — Dokümantasyon ve test kanıtları | Makaleye sistem tasarımı kanıtı sağlar |
| P2 | Faz 3 — Veritabanı ve araştırma logları | YAYIN_016 için kritik, YAYIN_006 için destekleyici |
| P2 | Faz 5 — Araştırma export | Uzman değerlendirmesi ve ilerideki veri analizi için yararlı |

---

## 12. Minimum Uygulanabilir Paket

YAYIN_006 için en az uygulanması gereken paket:

```text
Faz 1 + Faz 2 + Faz 4 + Faz 6
```

Bu paketle sistem şu şekilde konumlandırılabilir:

> CodeGradeAI, programlama eğitiminde öğrencinin hatayı fark etmesini desteklemek üzere rubrik tabanlı değerlendirme, hata taksonomisi ve Sokratik/kademeli geri bildirim şemasıyla yapılandırılmış AI destekli bir öğretim teknolojisi artefaktıdır.

---

## 13. YAYIN_016’ya Hazır Paket

YAYIN_016’da öğrenci verisine dayalı etkililik veya öğrenme davranışı analizi yapılacaksa tüm fazlar uygulanmalıdır:

```text
Faz 1 + Faz 2 + Faz 3 + Faz 4 + Faz 5 + Faz 6
```

Özellikle Faz 3 ve Faz 5, YAYIN_016 için kritik öneme sahiptir.

---

## 14. Kodlama Görevi İçin Doğrudan Kullanılabilir Prompt

Aşağıdaki metin Codex/Cursor gibi kodlama aracına görev olarak verilebilir.

```text
CodeGradeAI mevcut MVP kod tabanını incele ve v0.2 geliştirmesini uygula.

Amaç:
YAYIN_006 akademik çalışması için CodeGradeAI’nin AI destekli kod değerlendirme çıktısını açık hata taksonomisi, rubrik alt puanları, Sokratik/kademeli geri bildirim alanları ve araştırma loglarıyla genişletmek.

Mevcut sistem:
- React/Vite frontend
- FastAPI backend
- /api/grade endpoint
- Gemini API ile AI değerlendirme
- Mevcut GradingResult alanları: grade, feedback, codeQuality, suggestions, unitTests
- Teslimler submissions tablosunda code_content, grading_result ve submitted_at ile saklanıyor.

Geliştirme ilkeleri:
1. Mevcut iş akışını bozma.
2. Eski grading_result kayıtları frontend’de açılmaya devam etmeli.
3. Yeni alanlar opsiyonel ve geriye uyumlu olmalı.
4. Öğrenciye tam çözüm kodu verilmemeli.
5. AI çıktısı JSON şemasına bağlı olmalı.
6. Prompt, rubrik ve model versiyonu kaydedilmeli.
7. Export kişisel veri içermemeli.

Fazlar:

FAZ 1 — Backend şema genişletme
- GradingResult şemasına rubricScores, errorFindings, socraticFeedback ve pedagogicalMetadata alanlarını ekle.
- Error taxonomy için sabit kategori listesi tanımla.
- Rubrik puanları 1-5 arası olsun.
- direct_solution_given boolean alanı zorunlu olsun.

FAZ 2 — Prompt güncelleme
- get_system_instruction fonksiyonunu Sokratik/kademeli geri bildirim üretecek şekilde güncelle.
- Prompt içinde doğrudan tam çözüm kodu verme yasağı açık yer alsın.
- Yanıt yalnızca JSON olsun.
- prompt_version = cgai_prompt_v0.2 ve rubric_version = cgai_rubric_v0.2 olarak merkezi sabitlerden gelsin.

FAZ 3 — Kayıt ve loglama
- Yeni teslimlerde prompt_version, rubric_version, model_name, feedback_strategy, scaffolding_level, error_types ve rubric_scores bilgilerini kaydet.
- Mümkünse feedback_events adlı ayrı bir tablo oluştur; değilse submissions tablosuna nullable alanlar ekle.
- Eski veriler bozulmasın.

FAZ 4 — Frontend sonuç modalı
- Rubrik alt puanları bloğu ekle.
- Hata türleri bloğu ekle.
- Sokratik geri bildirim bloğu ekle: awareness_question, guiding_question, progressive_hint, next_action.
- direct_solution_given true ise öğretmen ekranında uyarı göster.
- Eski kayıtlarda alanlar yoksa graceful fallback uygula.

FAZ 5 — Araştırma export
- Ödev bazlı CSV veya JSON export endpoint’i ekle.
- Export alanları: submission_id, assignment_id, student_pseudonym, student_level, language, grade, rubric scores, error_types, scaffolding_level, direct_solution_given, submitted_at, prompt_version, rubric_version, model_name.
- Öğrenci adı, öğrenci numarası, e-posta export edilmesin.

FAZ 6 — Test ve dokümantasyon
- 5 sentetik test senaryosu hazırla: syntax error, logic error, loop boundary error, data type error, incomplete solution.
- docs/codegradeai_v0_2_design.md, docs/rubric_v0_2.md, docs/error_taxonomy_v0_2.md, docs/socratic_feedback_schema_v0_2.md dosyalarını oluştur.
- Her önemli değişiklik için kısa kanıt notu ekle.

Kabul kriterleri:
- Backend çalışıyor.
- Frontend build alıyor.
- Eski teslim kayıtları açılabiliyor.
- Yeni teslimlerde rubricScores, errorFindings, socraticFeedback ve pedagogicalMetadata alanları geliyor.
- Yeni alanlar veritabanında veya feedback_events tablosunda saklanıyor.
- Export kişisel veri içermiyor.
- En az 5 sentetik örnek için yeni yapı doğrulanmış.
```

---

## 15. YAYIN_006 İçin Akademik Konumlandırma Notu

Bu geliştirme tamamlandıktan sonra YAYIN_006’da sistem şu şekilde tanımlanabilir:

> Bu çalışma, programlama eğitiminde öğrencilerin hatalarını fark etmelerini ve kendi çözümlerini iyileştirmelerini desteklemek üzere rubrik tabanlı değerlendirme, hata taksonomisi ve Sokratik/kademeli geri bildirim şemasıyla yapılandırılmış AI destekli bir öğretim teknolojisi artefaktının tasarımını ve uzman değerlendirmesini ele almaktadır.

Aşağıdaki iddialardan kaçınılmalıdır:

```text
- CodeGradeAI öğrenci başarısını artırmıştır.
- Sistem öğrenme çıktıları üzerinde etkilidir.
- Öğrenciler bu sistemle daha iyi öğrenmiştir.
- Sistem deneysel olarak kanıtlanmıştır.
```

Bunun yerine şu ifadeler tercih edilmelidir:

```text
- Sistem pedagojik tasarım ilkelerine göre yapılandırılmıştır.
- Sistem uzman değerlendirmesine sunulmuştur.
- Sistem, Sokratik/kademeli geri bildirim şemasıyla biçimlendirici değerlendirmeyi destekleyecek şekilde tasarlanmıştır.
- Sistem, programlama hatalarını görünür kılmaya ve öğrenciyi doğrudan çözüm yerine düşünmeye yönlendirmeye odaklanmaktadır.
```

---

## 16. YAYIN_015 ve YAYIN_016’dan Ayrışma

### YAYIN_015’ten Ayrışma

YAYIN_015 başarı testi, madde analizi, güvenirlik ve LLM destekli madde kalite değerlendirmesi üzerinedir. CodeGradeAI’nin geri bildirim mimarisi, hata taksonomisi veya öğretim teknolojisi tasarımı bu yayının ana konusu değildir.

### YAYIN_006’nın Kapsamı

YAYIN_006 yalnızca CodeGradeAI’nin pedagojik tasarımı, geri bildirim mimarisi, rubrik yapısı, hata sınıflandırması ve uzman değerlendirmesi üzerinedir.

### YAYIN_016’dan Ayrışma

YAYIN_016 güz döneminde öğrenci verisine dayalı etkililik çalışması olarak planlanmaktadır. YAYIN_006’da öğrenci başarısı, ön test-son test, deney-kontrol karşılaştırması veya öğrenme çıktısı analizi yapılmamalıdır.

### Güvenli Sınır Cümlesi

Makaleye şu sınır cümlesi eklenebilir:

> Bu çalışma CodeGradeAI’nin öğrenme başarısına etkisini test etmemekte; sistemin pedagojik tasarımını, Sokratik geri bildirim mimarisini ve uzman değerlendirmesine dayalı ön uygunluğunu incelemektedir.

---

## 17. Sonuç

Bu geliştirme hattı tamamlandığında CodeGradeAI yalnızca çalışan bir AI kod değerlendirme MVP’si olmaktan çıkar; programlama eğitiminde biçimlendirici değerlendirme, hata farkındalığı, pedagojik iskeleleme ve Sokratik geri bildirim ilkelerine göre yapılandırılmış bir öğretim teknolojisi artefaktı olarak konumlandırılabilir.

Bu durum YAYIN_006’nın “ürün tanıtımı” gibi görünme riskini azaltır ve çalışmayı BÖTE/eğitim teknolojileri/programlama eğitimi hattına daha güçlü biçimde yerleştirir.
