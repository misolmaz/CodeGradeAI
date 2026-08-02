# CodeGradeAI MVP Sistem Tanımı ve Pedagojik İş Akışı Raporu

## 1. Kısa Yönetici Özeti
- CodeGradeAI mevcut MVP düzeyinde React/Vite tabanlı bir frontend ve FastAPI tabanlı bir backend ile çalışan, programlama ödevlerinin AI destekli değerlendirilmesine odaklanan bir sistemdir. Kanıt: `frontend/package.json:6-16`, `backend/app/main.py:73-85`, `backend/requirements.txt:14-20`.
- Sistem öğrenci, öğretmen ve süper admin rollerini destekler; roller veritabanında `users.role` alanında `student`, `teacher`, `superadmin` olarak tutulur. Kanıt: `backend/app/models.py:17-37`, `frontend/types.ts:1-5`.
- Öğretmenler öğrenci listesini Excel dosyasıyla yükleyebilir, öğrencileri listeleyebilir, öğrenci şifresini öğrenci numarasına sıfırlayabilir. Kanıt: `backend/app/routers/admin.py:17-73`, `frontend/components/TeacherDashboard.tsx:16-94`.
- Öğretmenler ödev oluşturma, düzenleme ve silme akışına sahiptir; ödevler başlık, açıklama, teslim tarihi, dil, öğrenci seviyesi ve hedef kitle alanlarını içerir. Kanıt: `backend/app/models.py:39-56`, `backend/app/routers/assignments.py:11-95`, `frontend/App.tsx:256-269`, `frontend/App.tsx:777-849`.
- Öğrenciler kendilerine görünen ödevleri görüntüler, kodu editöre yapıştırır/yazar, AI değerlendirmesine gönderir ve sonuçları puan, genel geri bildirim, kod kalitesi, öneriler ve birim test sonucu alanlarıyla görür. Kanıt: `frontend/App.tsx:561-570`, `frontend/App.tsx:867-930`, `frontend/App.tsx:1041-1128`.
- AI değerlendirme akışı backend `/api/grade` uç noktasına gider; Gemini API çağrısı yapılır ve `GradingResult` şemasına uygun JSON beklenir. Kanıt: `backend/app/main.py:107-116`, `backend/app/services.py:206-266`, `backend/app/schemas.py:17-29`, `frontend/services/geminiService.ts:5-23`.
- Rubrik mantığı ayrı bir veritabanı tablosu veya yapılandırılabilir ağırlık seti olarak değil, LLM sistem yönergesindeki 0-100 puan aralıkları ve seviye temelli odaklar olarak tanımlıdır. Kanıt: `backend/app/services.py:124-204`.
- Hata sınıflandırması için ayrı bir alan, tablo veya sabit taksonomi bulunmamaktadır; mevcut yapı hata bilgisini dolaylı olarak `feedback`, `codeQuality`, `suggestions` ve `unitTests` içinde taşır. Kanıt: `backend/app/schemas.py:12-22`, `backend/app/models.py:58-69`; ayrıca `rg` aramasında `classification`, `error_type`, `rubric` gibi alanlar bulunmadı.
- Veri tabanında organizasyonlar, kullanıcılar, ödevler, teslimler, duyurular ve rozetler tutulur. Teslimler öğrenci kodunu, AI değerlendirme JSON'unu ve teslim zamanını saklar. Kanıt: `backend/app/models.py:6-89`.
- Sokratik/kademeli geri bildirim mevcut kodda açık bir çok-aşamalı ipucu sistemi olarak uygulanmamıştır; mevcut AI yönergesi pedagojik, yapıcı ve seviye uyarlamalı geri bildirim üretmeye yöneliktir. Kanıt: `backend/app/services.py:148-188`, `backend/app/services.py:200-204`.

## 2. İncelenen Dosyalar ve Kanıt Kaynakları
| Alan | İncelenen Dosya/Klasör | Elde Edilen Bilgi | Güven Düzeyi |
|---|---|---|---|
| Backend uygulama iskeleti | `backend/app/main.py` | FastAPI uygulaması, router kayıtları, `/api/grade`, tablo oluşturma ve otomatik şema kontrolleri | Yüksek |
| Veri modeli | `backend/app/models.py` | `organizations`, `users`, `assignments`, `submissions`, `announcements`, `user_badges` tabloları ve alanları | Yüksek |
| API şemaları | `backend/app/schemas.py` | `GradingResult`, `UnitTestResult`, `SubmissionRequest`, ödev/teslim/duyuru/tenant şemaları | Yüksek |
| AI değerlendirme servisi | `backend/app/services.py` | Gemini API anahtarı/model seçimi, seviye uyarlamalı sistem yönergesi, puanlama rehberi, JSON çıktı şeması | Yüksek |
| Kimlik doğrulama | `backend/app/routers/auth.py`, `backend/app/routers/users.py`, `backend/app/jwt_auth.py`, `backend/app/auth.py` | JWT üretimi, çoklu organizasyon giriş belirsizliği, kurum değiştirme, profil ve şifre işlemleri | Yüksek |
| Öğretmen/admin işlemleri | `backend/app/routers/admin.py`, `frontend/components/TeacherDashboard.tsx` | Excel ile öğrenci yükleme, öğrenci listeleme, şifre sıfırlama, tenant yönetimi | Yüksek |
| Ödev API'leri | `backend/app/routers/assignments.py`, `frontend/App.tsx` | Ödev CRUD, hedef kitle alanları, frontend öğrenci filtreleme | Yüksek |
| Teslim API'leri | `backend/app/routers/submissions.py`, `frontend/App.tsx` | Deadline kontrolü, kod ve AI sonucunun kaydı, öğretmen/öğrenci erişim filtreleri, teslim silme | Yüksek |
| Duyuru API'leri | `backend/app/routers/announcements.py`, `frontend/App.tsx` | Öğretmen/süper admin duyuru oluşturma, global/organizasyon duyurusu okuma | Yüksek |
| Liderlik ve rozetler | `backend/app/routers/leaderboard.py`, `backend/app/badges.py`, `frontend/components/Leaderboard.tsx` | XP, sıralama, rozet kuralları, streak ve erken teslim bonusları | Yüksek |
| Frontend ana akış | `frontend/App.tsx`, `frontend/components/Layout.tsx`, `frontend/contexts/AuthContext.tsx` | Temel ekranlar, rol bazlı menü, veri çekme, ödev gönderme, sonuç modalı, localStorage oturum bilgileri | Yüksek |
| AI frontend istemcisi | `frontend/services/geminiService.ts` | Frontend'in `/api/grade` çağrısı, hata durumunda varsayılan `GradingResult` üretimi | Yüksek |
| Mock/local storage kalıntısı | `frontend/services/persistence.ts`, `frontend/constants.ts` | Eski/mock veri saklama katmanı var; ana `App.tsx` içinde `db` import edilmesine rağmen kullanım kanıtı bulunmadı | Orta |
| Dağıtım ve veri tabanı | `backend/app/database.py`, `docker-compose.yml`, `backend/requirements.txt`, `frontend/package.json` | SQLite varsayılanı, `DATABASE_URL` override, Docker volume, teknoloji bağımlılıkları | Yüksek |

## 3. Sistemin Amacı ve Kapsamı
CodeGradeAI mevcut kod tabanı itibarıyla programlama ödevlerinin öğretmen tarafından tanımlandığı, öğrencilerin kod teslim ettiği, AI servisinin yapılandırılmış değerlendirme ürettiği ve bu değerlendirmenin öğrenci/öğretmen ekranlarında görüntülendiği bir MVP'dir. Backend tanımı sistemin "AI-powered code grading API using Google Gemini" olduğunu belirtir. Kanıt: `backend/app/main.py:73-76`.

YAYIN_006 bağlamında sistem, öğrenci başarısına etkisi kanıtlanmış bir müdahale olarak değil; pedagojik geri bildirim mimarisi, seviye uyarlamalı değerlendirme tasarımı, rol bazlı iş akışları ve uzman değerlendirmesine sunulacak tasarım bilimi ürünü olarak ele alınmalıdır.

Kapsama giren açık özellikler:
- Öğrenci/öğretmen/süper admin rol ayrımı. Kanıt: `backend/app/models.py:30`, `frontend/types.ts:1-5`.
- Organizasyon/tenant yapısı. Kanıt: `backend/app/models.py:6-15`, `backend/app/routers/admin.py:75-133`.
- Ödev tanımlama, hedefleme ve teslim tarihi kontrolü. Kanıt: `backend/app/models.py:39-56`, `backend/app/routers/submissions.py:19-37`.
- AI destekli değerlendirme, puan ve geri bildirim JSON'u. Kanıt: `backend/app/services.py:206-266`.
- Öğretmen analitiği, öğrenci teslim listesi ve ortalama puan gösterimi. Kanıt: `frontend/App.tsx:941-1039`, `frontend/App.tsx:1148-1309`.
- Motivasyon amaçlı rozet/liderlik yapısı. Kanıt: `backend/app/badges.py:6-27`, `backend/app/routers/leaderboard.py:30-154`.

Kapsama girdiği kanıtlanmayan noktalar:
- Ön test/son test, deney/kontrol grubu veya öğrenme başarısı ölçümü yoktur.
- Gerçek test çalıştırma/sandbox kod yürütme altyapısı yoktur; `unitTests` alanı LLM yanıt şemasında bulunur ancak backend tarafında kodu çalıştıran bir test runner kanıtı bulunmamıştır. Kanıt: `backend/app/services.py:228-237`, `backend/app/schemas.py:12-22`.
- Sokratik ipucu seviyeleri veya öğrenciyle çok turlu diyalog akışı yoktur.

## 4. Kullanıcı Rolleri
| Rol | Kodda Görünen Ad | Yetki/İşlev | Kanıt |
|---|---|---|---|
| Öğrenci | Backend: `student`; Frontend enum: `STUDENT` | Ödevleri görür, kod teslim eder, AI değerlendirme sonucunu görüntüler, liderlik tablosuna dahil olur | `backend/app/models.py:30`, `frontend/types.ts:1-5`, `frontend/App.tsx:867-930`, `frontend/components/Leaderboard.tsx:35-66` |
| Öğretmen | Backend: `teacher`; Frontend enum: `TEACHER` | Ödev oluşturur/düzenler/siler, öğrenci yükler/listeler, teslimleri inceler, duyuru oluşturur | `backend/app/routers/assignments.py:11-95`, `backend/app/routers/admin.py:17-73`, `frontend/components/TeacherDashboard.tsx:46-94`, `frontend/App.tsx:941-1039` |
| Süper admin | Backend: `superadmin`; Frontend enum: `SUPERADMIN` | Tenant/organizasyon ve öğretmen hesabı oluşturur, sistem istatistiklerini görür, tenant aktif/pasif yapar/siler, global duyuru oluşturabilir | `backend/app/routers/admin.py:75-255`, `frontend/components/SuperAdminDashboard.tsx:43-127`, `frontend/components/SuperAdminHome.tsx:30-53` |

Not: Frontend `App.tsx` bazı öğretmen ekranları için `teacher || superadmin` kontrolü yapar; ancak backend `assignments.py` ödev oluşturma/güncelleme/silme için yalnızca `current_user.role == "teacher"` şartı koyar. Bu nedenle süper adminin ödev yönetimi yetkisi kodda tutarlı biçimde kanıtlanmamıştır. Kanıt: `frontend/App.tsx:558`, `backend/app/routers/assignments.py:17-18`, `backend/app/routers/assignments.py:66-84`.

## 5. Mevcut MVP Özellikleri
| Özellik | Mevcut mu? | Açıklama | Kanıt Dosya/Kod Parçası | YAYIN_006 İçin Önemi |
|---|---|---|---|---|
| JWT tabanlı giriş | Evet | `/token` kullanıcı adı/e-posta ve şifreyle giriş yapar, JWT içine rol, organizasyon ve kullanıcı id ekler | `backend/app/routers/auth.py:14-123`, `backend/app/jwt_auth.py:29-37` | Rol bazlı pedagojik iş akışlarının temelidir |
| Çoklu organizasyon/tenant bağlamı | Evet | Kullanıcılar `organization_id` ile kuruma bağlanır; aynı öğrenci numarası farklı organizasyonlarda bulunabilir | `backend/app/models.py:17-37`, `backend/app/routers/auth.py:42-88` | Uzman değerlendirmesinde sınıf/kurum bağlamı ayrımını gösterir |
| Organizasyon seçme/değiştirme | Evet | Aynı kullanıcı birden fazla organizasyonda ise girişte seçim yapılır; oturumda `/token/switch` ile değiştirilebilir | `backend/app/routers/auth.py:125-183`, `frontend/components/Login.tsx:79-84`, `frontend/components/Layout.tsx:24-68` | Çoklu ders/kurum senaryosu için tasarım kararıdır |
| Öğrenci Excel yükleme | Evet | `OgrenciNo`, `Ad`, `Soyad`, `Sinif` beklenir; öğrenci kullanıcıları oluşturulur/güncellenir | `backend/app/services.py:16-106`, `backend/app/routers/admin.py:17-43`, `frontend/components/TeacherDashboard.tsx:46-74` | Uygulamanın sınıf düzeyinde kullanılabilirliğini destekler |
| Öğrenci listeleme ve şifre sıfırlama | Evet | Öğretmen/süper admin kendi organizasyonundaki öğrencileri listeler; şifre öğrenci numarasına sıfırlanır | `backend/app/routers/admin.py:45-73`, `frontend/components/TeacherDashboard.tsx:76-94` | MVP idari iş akışını tanımlar |
| Ödev oluşturma/düzenleme/silme | Evet | Başlık, açıklama, teslim tarihi, dil, öğrenci seviyesi, hedef kitle alanlarıyla ödev kaydı | `backend/app/routers/assignments.py:11-95`, `frontend/App.tsx:256-300` | Pedagojik görev tasarımı ve AI değerlendirme bağlamı sağlar |
| Hedef kitleye göre ödev görünürlüğü | Kısmen | `target_type`, `target_class`, `target_students` alanları var; öğrenci filtreleme frontend'de yapılır | `backend/app/models.py:51-53`, `frontend/App.tsx:561-570` | Sınıf/öğrenci bazlı kişiselleştirme potansiyelini gösterir |
| Teslim tarihi kontrolü | Evet | Backend teslim sırasında ödevin `due_date` değerini kontrol eder; frontend de butonu devre dışı bırakır | `backend/app/routers/submissions.py:19-37`, `frontend/App.tsx:883-930` | Öğrenme yönetimi iş akışını destekler |
| Kod editörü | Evet | `react-simple-code-editor` ve Prism ile kod girişi/renklendirme yapılır | `frontend/package.json:13-16`, `frontend/App.tsx:900-914` | Öğrenci teslim deneyiminin parçasıdır |
| AI kod değerlendirme | Evet | Frontend `/api/grade` çağırır; backend Gemini ile değerlendirme üretir | `frontend/services/geminiService.ts:5-23`, `backend/app/main.py:107-116`, `backend/app/services.py:244-256` | YAYIN_006'nın ana tasarım bileşenidir |
| Yapılandırılmış AI çıktı şeması | Evet | `grade`, `feedback`, `codeQuality`, `suggestions`, `unitTests` alanları beklenir | `backend/app/schemas.py:17-22`, `frontend/types.ts:41-47` | Uzmanların geri bildirim bileşenlerini değerlendirmesine olanak verir |
| Öğrenci sonucu görüntüleme | Evet | Sonuç modalında puan, kod kalitesi, genel geri bildirim, birim testleri ve öneriler gösterilir | `frontend/App.tsx:1041-1128` | Geri bildirimin öğrenciye sunum biçimini belgeler |
| Öğretmen teslim inceleme | Evet | Ödev detayında teslim sayısı, sınıf ortalaması, öğrenci teslimleri ve sonuç inceleme bulunur | `frontend/App.tsx:941-1039` | Uzman değerlendirmesi için öğretmen paneli işlevini gösterir |
| Öğrenci analizi | Evet | Öğrenci listesi, sınıf filtreleme, teslim sayısı ve öğrenci detayındaki teslimler gösterilir | `frontend/App.tsx:1148-1309` | Öğretmen izleme iş akışını belgeler |
| Duyuru sistemi | Evet | Öğretmen/süper admin duyuru oluşturabilir; öğrenciler/öğretmenler global ve organizasyon duyurularını görür | `backend/app/routers/announcements.py:11-48`, `frontend/App.tsx:307-329`, `frontend/App.tsx:1513-1612` | Öğrenme ortamı yönetim bileşenidir |
| Liderlik tablosu | Evet | Öğrenciler toplam XP'ye göre sıralanır; ortalama puan, görev sayısı, streak ve rozetler gösterilir | `backend/app/routers/leaderboard.py:30-154`, `frontend/components/Leaderboard.tsx:35-66` | Motivasyonel tasarım öğesi olarak raporlanabilir |
| Rozet sistemi | Evet | First Step, Fast & Furious, Clean Code Architect, Bug Hunter, On Fire kuralları uygulanır | `backend/app/badges.py:6-27`, `backend/app/badges.py:36-119` | Oyunlaştırma/motivasyon tasarımını gösterir |
| Tenant/sistem yönetimi | Evet | Süper admin öğretmen/organizasyon oluşturur, aktif/pasif yapar, siler ve istatistikleri görür | `backend/app/routers/admin.py:75-255`, `frontend/components/SuperAdminDashboard.tsx:43-127` | Üründen çok sistem bağlamını ve ölçeklenebilirlik varsayımını açıklar |
| Gerçek kod çalıştırma/test runner | Hayır / kanıt yok | Kodda öğrenci kodunu sandbox'ta çalıştıran test altyapısı bulunmadı; `unitTests` LLM yanıt alanıdır | `backend/app/services.py:228-237`, `backend/app/schemas.py:12-22` | Etkililik/ölçme iddiası kurulmaması için kritik sınırlılık |
| Açık hata taksonomisi | Hayır / kanıt yok | Syntax/logic/runtime vb. kalıcı kategori alanı veya sınıflandırma tablosu yok | `backend/app/models.py:58-69`, `backend/app/schemas.py:17-22` | YAYIN_006'da “geliştirilmesi gereken alan” olarak konumlanmalı |
| Sokratik çok aşamalı ipucu | Hayır / kanıt yok | Kademeli ipucu seviyesi, tekrar deneme diyaloğu veya soru üretme akışı bulunmadı | `backend/app/services.py:183-204`, `frontend/App.tsx:1041-1128` | Başlıkta “Sokratik” geçiyorsa mevcut durum dikkatle sınırlandırılmalı |

## 6. Öğrenci İş Akışı
1. Öğrenci giriş ekranında öğrenci/kullanıcı no ve şifre ile `/token` uç noktasına istek gönderir. Varsayılan şifrenin öğrenci numarası olduğu arayüzde belirtilir. Kanıt: `frontend/components/Login.tsx:59-107`, `frontend/components/Login.tsx:126-168`.
2. Aynı kullanıcı birden fazla organizasyonda kayıtlıysa sistem organizasyon seçimi ister. Kanıt: `backend/app/routers/auth.py:62-88`, `frontend/components/Login.tsx:171-214`.
3. Oturum bilgileri `AuthContext` içinde localStorage'a yazılır: token, rol, kullanıcı adı, öğrenci numarası, sınıf kodu, kullanıcı id, organizasyon adı, e-posta. Kanıt: `frontend/contexts/AuthContext.tsx:24-58`.
4. Ana uygulama ödevleri, teslimleri ve duyuruları backend'den çeker. Kanıt: `frontend/App.tsx:106-160`.
5. Öğrenci ödev listesinde sadece kendisine uygun ödevleri görür; `all`, `class`, `specific` hedefleme frontend'de filtrelenir. Kanıt: `frontend/App.tsx:561-570`.
6. Öğrenci ödev yükleme modalında soru/tanımı ve kod editörünü görür; teslim tarihi geçmişse uyarı gösterilir ve gönderim butonu devre dışı kalır. Kanıt: `frontend/App.tsx:867-930`.
7. Öğrenci kodu gönderdiğinde frontend önce `/api/grade` üzerinden AI değerlendirmesini alır. Kanıt: `frontend/App.tsx:347-356`, `frontend/services/geminiService.ts:12-23`.
8. AI sonucu `grade == 0` ise frontend bunu hata gibi ele alıp kaydı yapmadan uyarı verir. Kanıt: `frontend/App.tsx:358-361`.
9. AI sonucu başarılı kabul edilirse frontend `assignment_id`, `code_content`, `grading_result` alanlarıyla `/submissions/` uç noktasına kayıt gönderir. Kanıt: `frontend/App.tsx:363-379`.
10. Backend deadline kontrolünden sonra teslimi `submissions` tablosuna kaydeder ve rozet kontrolü yapar. Kanıt: `backend/app/routers/submissions.py:19-59`.
11. Öğrenci ana sayfasında teslim geçmişi ve puanlarını görebilir; sonuç modalında detaylı AI analiz raporu açılır. Kanıt: `frontend/App.tsx:484-518`, `frontend/App.tsx:1041-1128`.

## 7. Öğretim Elemanı İş Akışı
1. Öğretmen giriş yaptıktan sonra rol bazlı menüde ödev yönetimi, liderlik tablosu, öğrenci analizi, yönetim paneli, duyuru yönetimi ve profil ekranlarını görür. Kanıt: `frontend/components/Layout.tsx:85-166`.
2. Yönetim panelinde Excel dosyası yükleyerek öğrencileri sisteme kaydeder. Beklenen sütunlar arayüzde `OgrenciNo, Ad, Soyad, Sinif` olarak belirtilir; backend aynı sütunlarla okuma yapar. Kanıt: `frontend/components/TeacherDashboard.tsx:96-153`, `backend/app/services.py:21-40`.
3. Öğrenci kaydı oluşturulurken varsayılan şifre öğrenci numarasının hashlenmiş halidir; öğrenci `role="student"` ve `organization_id` ile kaydedilir. Kanıt: `backend/app/services.py:82-97`.
4. Öğretmen kayıtlı öğrencileri listeler ve gerekirse şifre sıfırlar. Kanıt: `frontend/components/TeacherDashboard.tsx:156-197`, `backend/app/routers/admin.py:45-73`.
5. Öğretmen ödev oluştururken başlık, açıklama, dil, teslim tarihi, AI seviyesi ve hedef kitle seçer. Kanıt: `frontend/App.tsx:718-860`.
6. Ödev backend'de öğretmenin organizasyonuna bağlanır. Kanıt: `backend/app/routers/assignments.py:17-25`.
7. Öğretmen ödev detayında toplam teslim, sınıf ortalaması ve her öğrencinin teslim sonucunu inceler. Kanıt: `frontend/App.tsx:941-1039`.
8. Öğretmen öğrenci analizi ekranında öğrencileri arar/sınıfa göre filtreler ve öğrenci bazlı teslim geçmişini görür. Kanıt: `frontend/App.tsx:1148-1309`.
9. Öğretmen duyuru oluşturabilir/silebilir. Kanıt: `backend/app/routers/announcements.py:11-27`, `frontend/App.tsx:1513-1612`.

## 8. Kod Değerlendirme ve AI Geri Bildirim İş Akışı
1. Frontend `gradeSubmission` fonksiyonunu çağırır ve ödev açıklaması, hedef dil, öğrenci kodu ve öğrenci seviyesini backend'e gönderir. Kanıt: `frontend/services/geminiService.ts:5-23`, `frontend/App.tsx:347-356`.
2. Backend `/api/grade` uç noktası `SubmissionRequest` alır ve `grade_submission` servisini çağırır. Kanıt: `backend/app/main.py:107-116`, `backend/app/schemas.py:24-29`.
3. `grade_submission`, API anahtarı yoksa `grade=0`, Türkçe hata mesajı ve boş `unitTests` döndürür. Kanıt: `backend/app/services.py:206-214`.
4. Sistem yönergesi `get_system_instruction(student_level)` ile hazırlanır; başlangıç, orta ve ileri seviyeler için odak/teknik derinlik/puanlama önceliği farklılaşır. Kanıt: `backend/app/services.py:124-181`.
5. Kullanıcı prompt'u ödev tanımı, hedef dil, öğrenci kodu ve öğrenci seviyesinden oluşur. Kanıt: `backend/app/services.py:216-229`.
6. Gemini çağrısında `temperature=0.4`, `max_output_tokens=8192`, `response_mime_type="application/json"` ve `response_schema=GradingResult` kullanılır. Kanıt: `backend/app/services.py:231-247`.
7. Backend Gemini yanıtını `json.loads` ile ayrıştırır ve `GradingResult` nesnesi döndürür. Kanıt: `backend/app/services.py:249-256`.
8. Frontend sonucu önce kullanır, sonra `grading_result` alanında JSON string olarak `/submissions/` kaydına gönderir. Kanıt: `frontend/App.tsx:363-379`.
9. Backend teslim kaydını `Submission` tablosuna yazar; `code_content`, `grading_result` ve `submitted_at` saklanır. Kanıt: `backend/app/models.py:58-69`, `backend/app/routers/submissions.py:39-59`.
10. Sonuç modalında puan, kod kalitesi, genel geri bildirim, birim testleri ve öneriler ayrı bloklarda sunulur. Kanıt: `frontend/App.tsx:1055-1128`.

Önemli sınırlama: `unitTests` alanı “birim testi sonuçları” olarak adlandırılmıştır; ancak backend'de öğrenci kodunu gerçekten çalıştıran, test dosyası üreten veya sandbox içinde doğrulama yapan bir mekanizma kanıtlanmamıştır. Mevcut kod, LLM'den bu alanı üretmesini bekler. Kanıt: `backend/app/schemas.py:12-22`, `backend/app/services.py:228-237`.

## 9. Rubrik / Değerlendirme Mantığı
Mevcut rubrik uygulaması kodda yapılandırılabilir bir rubrik tablosu olarak değil, LLM sistem prompt'u içinde yer alan seviye uyarlamalı yönergeler ve 0-100 puan aralığı tanımları olarak uygulanmıştır.

Kanıtlanan rubrik bileşenleri:
- Başlangıç seviyesi: temel kavramlar, söz dizimi, hata ayıklama; basit açıklama ve az sayıda öneri. Kanıt: `backend/app/services.py:127-154`.
- Orta seviye: kod organizasyonu, temiz kod, orta düzey optimizasyon; DRY/KISS ve 3-4 öneri. Kanıt: `backend/app/services.py:132-161`.
- İleri seviye: algoritmik optimizasyon, güvenlik, tasarım desenleri; Big-O, hata yönetimi, test edilebilirlik, alternatif çözümler. Kanıt: `backend/app/services.py:137-168`.
- Ortak pedagojik yaklaşım: Sandwich Metodu, samimi Türkçe dil, hataları öğrenme fırsatı olarak sunma. Kanıt: `backend/app/services.py:183-188`.
- Puan aralıkları: 96-100 mükemmel, 85-95 çok iyi, 70-84 iyi/geçer, 50-69 zayıf, 0-49 başarısız. Kanıt: `backend/app/services.py:189-198`.
- Çıktı şeması: `grade`, `feedback`, `codeQuality`, `suggestions`, `unitTests`. Kanıt: `backend/app/schemas.py:17-22`.

Belirgin sınırlılıklar:
- Kriter ağırlıkları, madde bazlı rubrik, öğretmen tarafından düzenlenebilir rubrik veya rubrik versiyonu yoktur.
- Puan üretimi LLM kararına bırakılmıştır; backend puanı bağımsız kurallarla yeniden hesaplamaz.
- Rubrik ile gerçek test sonucu arasında doğrulama katmanı bulunmamaktadır.

## 10. Hata Sınıflandırması
Kodda açık bir hata sınıflandırma sistemi bulunmamaktadır. Aşağıdaki bulgular mevcut durumu sınırlar:

| Boyut | Mevcut Durum | Kanıt |
|---|---|---|
| Ayrı hata kategorisi alanı | Yok / kanıtlanmadı | `backend/app/schemas.py:17-22` yalnızca `grade`, `feedback`, `codeQuality`, `suggestions`, `unitTests` içerir |
| Hata taksonomisi tablosu | Yok / kanıtlanmadı | `backend/app/models.py:6-89` tablolarında hata türü/kategori tablosu yoktur |
| Birim testi sonucu | Var ama LLM çıktısı olarak | `backend/app/schemas.py:12-15`, `backend/app/services.py:231-237` |
| Kod kalitesi etiketi | Var | `GradingResult.codeQuality`; kanıt: `backend/app/schemas.py:20` |
| Öneriler listesi | Var | `GradingResult.suggestions`; kanıt: `backend/app/schemas.py:21` |
| Seviye temelli hata odağı | Kısmen | Başlangıçta söz dizimi/hata ayıklama, ileride hata yönetimi vurgusu; kanıt: `backend/app/services.py:127-168` |

YAYIN_006'da hata sınıflandırması şu ifadeyle sınırlandırılmalıdır: “MVP, hataları ayrı bir taksonomik veri yapısına ayırmamaktadır; hata ve iyileştirme bilgisi AI tarafından üretilen metinsel geri bildirim, kod kalitesi değerlendirmesi, öneriler ve test sonucu benzeri yapılandırılmış alanlar üzerinden temsil edilmektedir.”

## 11. Veri Akışı ve Loglanan Bilgiler
### Ana veri akışı
1. Öğretmen/öğrenci/süper admin giriş yapar ve JWT alır. Kanıt: `backend/app/routers/auth.py:90-123`.
2. Frontend token'ı localStorage'da saklar ve API isteklerinde `Authorization: Bearer` başlığıyla gönderir. Kanıt: `frontend/contexts/AuthContext.tsx:35-58`, `frontend/App.tsx:109-115`.
3. Öğretmen öğrenci listesi yükler; backend Excel'i okuyup kullanıcı kayıtları oluşturur/günceller. Kanıt: `backend/app/services.py:16-106`.
4. Öğretmen ödev oluşturur; backend ödevi öğretmenin `organization_id` değerine bağlar. Kanıt: `backend/app/routers/assignments.py:20-24`.
5. Öğrenci kod gönderir; frontend önce AI değerlendirme alır, sonra kod ve değerlendirme JSON'unu teslim olarak kaydeder. Kanıt: `frontend/App.tsx:347-379`, `backend/app/routers/submissions.py:39-59`.
6. Öğretmen ve öğrenci teslimleri okur; öğretmen organizasyondaki tüm teslimleri, öğrenci yalnızca kendi teslimlerini görür. Kanıt: `backend/app/routers/submissions.py:61-74`.
7. Liderlik tablosu teslimlerdeki `grading_result.grade` değerlerini okuyarak XP ve sıralama hesaplar. Kanıt: `backend/app/routers/leaderboard.py:74-154`.

### Veritabanında saklanan bilgiler
| Tablo | Saklanan Bilgi | Kanıt |
|---|---|---|
| `organizations` | Kurum/tenant adı, oluşturulma zamanı, aktiflik durumu | `backend/app/models.py:6-15` |
| `users` | Organizasyon id, öğrenci/kullanıcı no, ad soyad, e-posta, şifre hash'i, rol, sınıf kodu, ilk giriş bayrağı, avatar URL | `backend/app/models.py:17-37` |
| `assignments` | Organizasyon id, başlık, oluşturulma zamanı, açıklama, teslim tarihi, dil, öğrenci seviyesi, durum, hedefleme alanları | `backend/app/models.py:39-56` |
| `submissions` | Kullanıcı id, ödev id, kaynak kod, AI değerlendirme JSON'u, teslim zamanı | `backend/app/models.py:58-69` |
| `announcements` | Organizasyon id, başlık, içerik, tür, tarih | `backend/app/models.py:71-80` |
| `user_badges` | Kullanıcı id, rozet adı, kazanılma zamanı | `backend/app/models.py:81-89` |

### Uygulama logları / konsol çıktıları
- AI yanıtı backend konsoluna `DEBUG: AI Response` ile yazdırılır. Kanıt: `backend/app/services.py:252`.
- Gemini çağrı hatası backend konsoluna yazdırılır. Kanıt: `backend/app/services.py:258-264`.
- Duyuru listeleme sırasında mevcut kullanıcı rolü debug olarak yazdırılır. Kanıt: `backend/app/routers/announcements.py:34`.
- Şema/migrasyon kontrolleri backend başlangıcında `print` ile loglanır. Kanıt: `backend/app/main.py:20-69`.
- Frontend hata durumlarını `console.error` ile yazar. Kanıt: `frontend/App.tsx:164`, `frontend/services/geminiService.ts:33-41`.

Gizlilik/sınırlılık notu: Öğrenci kaynak kodu veritabanında açık metin olarak `submissions.code_content` alanında saklanır. AI yanıtı da `grading_result` olarak saklanır. Kodda ayrıca ayrı bir anonimleştirme, araştırma verisi ihracı veya açık rıza/etik onay alanı bulunmamıştır.

## 12. Sokratik ve Kademeli Geri Bildirim Açısından Mevcut Durum
Mevcut sistemde Sokratik/kademeli geri bildirim iddiasını doğrudan destekleyen açık bir çok aşamalı mekanizma kanıtlanmamıştır. Buna karşılık pedagojik ve seviye uyarlamalı geri bildirim için bazı yapı taşları vardır.

Mevcut pedagojik yapı taşları:
- Öğrenci seviyesine göre odak, teknik derinlik ve puanlama önceliği değişir. Kanıt: `backend/app/services.py:124-181`.
- Başlangıç seviyesinde daha basit dil, teknik terim açıklama, küçük başarıları övme ve az sayıda öneri yönergesi vardır. Kanıt: `backend/app/services.py:148-154`.
- Tüm seviyelerde Sandwich Metodu ve yapıcı dil istenir. Kanıt: `backend/app/services.py:183-188`.
- Çıktı Türkçe ve şemaya bağlıdır. Kanıt: `backend/app/services.py:200-204`.
- Öğrenciye geri bildirim, öneriler ve test sonucu benzeri alanlar ayrı görsel bloklarda gösterilir. Kanıt: `frontend/App.tsx:1091-1128`.

Sokratik/kademeli geri bildirim açısından eksikler:
- Öğrenciye doğrudan soru soran veya doğru cevabı vermeden yönlendiren zorunlu Sokratik prompt kuralı bulunmamaktadır.
- İpucu seviyesi, deneme sayısı, aşamalı açıklama veya “önce soru, sonra ipucu, sonra çözüm” akışı yoktur.
- Öğrenci geri bildirime yanıt verip yeniden yönlendirme almaz; mevcut akış tek seferlik değerlendirme üretir.
- Geri bildirimlerin hangi bilişsel hedefe veya hata türüne karşılık geldiği veritabanında etiketlenmez.

YAYIN_006 için önerilen ifade: “MVP, Sokratik geri bildirimin tam etkileşimli ve kademeli biçimini henüz uygulamamakta; ancak seviye uyarlamalı, yapıcı ve yapılandırılmış AI geri bildirimi için temel bir mimari sunmaktadır.”

## 13. YAYIN_006 İçin Makaleye Alınabilecek Güçlü Yönler
- Tasarım bilimi ürünü olarak somut artefakt: Rol bazlı arayüzler, API servisleri, veri modeli ve AI değerlendirme servisi birlikte çalışır. Kanıt: `backend/app/main.py:79-85`, `frontend/App.tsx:1621-1633`.
- Seviye uyarlamalı geri bildirim tasarımı: Beginner/intermediate/advanced düzeylerine göre odak ve dil yönergesi farklılaşır. Kanıt: `backend/app/services.py:124-181`.
- Yapılandırılmış geri bildirim şeması: Puan, genel geri bildirim, kod kalitesi, öneriler ve test sonucu alanları ayrıştırılmıştır. Kanıt: `backend/app/schemas.py:17-22`.
- Pedagojik dil tasarımı: Sandwich Metodu, Türkçe, yapıcı ve öğrenci seviyesine uygun dil yönergeleri bulunur. Kanıt: `backend/app/services.py:183-204`.
- Öğretmen-öğrenci iş akışı bütünlüğü: Öğretmen ödev verir, öğrenci teslim eder, öğretmen teslimleri ve öğrenci analizini görüntüler. Kanıt: `frontend/App.tsx:718-930`, `frontend/App.tsx:941-1309`.
- Çoklu organizasyon/kurum desteği: Tenant yapısı öğretmen workspace'leri ve organizasyon bağlamı sağlar. Kanıt: `backend/app/models.py:6-15`, `backend/app/routers/admin.py:75-133`.
- Hedeflenmiş ödev tasarımı: Ödevler tüm öğrencilere, belirli sınıfa veya seçili öğrencilere atanabilir. Kanıt: `frontend/App.tsx:789-849`, `backend/app/models.py:51-53`.
- Öğrenci kodu ve AI geri bildiriminin kayıt altına alınması: Daha sonraki uzman değerlendirmesi ve tasarım incelemesi için teslim artefaktları saklanır. Kanıt: `backend/app/models.py:58-69`.
- Motivasyonel destek öğeleri: Rozetler, XP ve liderlik tablosu kodda uygulanmıştır; etkililik iddiası kurmadan tasarım öğesi olarak sunulabilir. Kanıt: `backend/app/badges.py:6-119`, `backend/app/routers/leaderboard.py:30-154`.
- Uzman değerlendirmesine uygun ayrıştırılmış bileşenler: Rubrik prompt'u, geri bildirim şeması, kullanıcı rolleri ve veri akışı ayrı ayrı incelenebilir.

Bu güçlü yönler makalede “başarıyı artırdığı kanıtlanmış özellikler” olarak değil, “uzman değerlendirmesine sunulacak tasarım kararları ve MVP artefakt bileşenleri” olarak yazılmalıdır.

## 14. YAYIN_016 Öncesi Eklenmesi Gereken Özellikler
Bu bölüm öneri niteliğindedir; aşağıdaki maddeler mevcut kodda bulunmayan veya eksik/kanıtlanmamış alanlara göre yazılmıştır.

| Önerilen Özellik | Neden Gerekli? | Mevcut Kodda Durum |
|---|---|---|
| Açık hata taksonomisi | Syntax, mantık, runtime, algoritma, okunabilirlik, gereksinim eksikliği gibi sınıflar analiz edilebilir hale gelir | Ayrı alan/tablo yok; `GradingResult` metinsel/yarı yapılandırılmış alanlarla sınırlı |
| Kademeli/Sokratik geri bildirim modu | YAYIN_006 başlığındaki Sokratik iddianın sistemsel karşılığı oluşur | Çok turlu ipucu veya soru-cevap akışı yok |
| Geri bildirim düzeyi ve ipucu sayacı | Öğrencinin doğrudan cevap almadan yönlendirilmesi izlenebilir | Teslim tek seferlik değerlendirme şeklinde |
| Rubrik versiyonlama | Farklı dönemlerde veya uzman değerlendirmesinde hangi rubrik/prompt kullanıldı izlenir | Rubrik prompt içinde sabit; DB'de versiyon yok |
| Model/prompt/AI parametre loglama | YAYIN_016'da hangi model ve prompt ile geri bildirim üretildiği izlenebilir | `MODEL_NAME` env ile değişebilir; teslimde model/prompt versiyonu saklanmıyor |
| Gerçek test çalıştırma altyapısı | LLM değerlendirmesi ile çalışan test sonucu ayrılabilir | Test runner kanıtı yok; `unitTests` LLM çıktısı |
| Öğrenci deneme geçmişi ve tekrar teslim politikası | Gelişim süreci, deneme sayısı ve geri bildirimin etkisi analiz edilir | Backend tekrar teslimi açıkça engellemez; frontend ilk teslimi tamamlandı gösterir |
| Öğrenci onamı ve anonim araştırma kimliği | Etik kurul ve veri gizliliği için araştırma verisi ayrıştırılır | Onam/anonimleştirme alanı yok |
| Veri dışa aktarımı | YAYIN_016 için teslim, puan, hata türü, süre ve etkileşim verileri analiz edilebilir | Araştırma odaklı export API'si yok |
| Etkileşim logları | Öğrencinin geri bildirimi açıp açmadığı, önerileri takip edip etmediği ölçülebilir | Ayrı event log tablosu yok |
| Öğretmen manuel değerlendirme/override | AI puanının pedagojik denetimi sağlanır | Manuel puan/rubrik notu alanı yok |
| Aktif/pasif tenant erişim denetimi | Sistem panelindeki aktif/pasif durum gerçek erişim kontrolüne bağlanır | `is_active` yönetiliyor; login/API erişiminde kullanıldığı kanıtlanmadı |
| Veri minimizasyonu ve debug log temizliği | Öğrenci verisi ve AI yanıtlarının gereksiz loglanması azaltılır | AI yanıtı konsola yazdırılıyor |
| Deneysel çalışma modülü | YAYIN_016 için grup, zaman, müdahale koşulu, ölçüm noktası tanımlanabilir | Deney/kontrol veya ön test/son test yapısı yok |

## 15. Belirsiz / Kullanıcıdan Doğrulama Gerektiren Noktalar
- “Sokratik geri bildirim” hedefi mevcut kodda açık bir Sokratik diyalog/çok aşamalı ipucu sistemi olarak görünmüyor. Kullanıcıdan doğrulama gerekli: YAYIN_006'da bu ifade mevcut MVP için mi, yoksa önerilen tasarım yönü için mi kullanılacak?
- Hata sınıflandırması ayrı bir veri yapısı olarak yok. Kullanıcıdan doğrulama gerekli: Makalede hata sınıflandırması mevcut sistem özelliği olarak mı, yoksa uzman değerlendirmesine sunulacak geliştirme ihtiyacı olarak mı konumlanacak?
- `unitTests` alanı LLM tarafından üretilen yapılandırılmış çıktı gibi görünüyor; gerçek testlerin çalıştırıldığına dair backend kanıtı yok. Kullanıcıdan doğrulama gerekli: Sistem tasarımında unit testler hedeflenen özellik mi, yoksa mevcut LLM açıklama formatı mı?
- `Organization.is_active` alanı ve süper admin aktif/pasif işlemi var; ancak giriş veya API erişiminde aktiflik kontrolü kanıtlanmadı. Kullanıcıdan doğrulama gerekli: Bu davranış planlanan ama eksik özellik mi?
- Süper admin bazı frontend guard'larında öğretmenle birlikte ele alınsa da assignment backend router'ı ödev CRUD için yalnızca `teacher` rolünü kabul ediyor. Kullanıcıdan doğrulama gerekli: Süper admin öğretmen yerine geçip ödev yönetebilmeli mi?
- Frontend'de `frontend/services/persistence.ts` ve `frontend/constants.ts` mock/localStorage katmanı bulunuyor; `App.tsx` `db` import ediyor ancak ana akış backend API'lerini kullanıyor. Kullanıcıdan doğrulama gerekli: Bu dosyalar eski prototip kalıntısı mı?
- Backend `submissions` modelinde öğrenci-ödev için unique constraint görünmüyor; frontend ilk teslimden sonra “Tamamlandı” gösteriyor. Kullanıcıdan doğrulama gerekli: Tek teslim mi, çoklu deneme mi isteniyor?
- Gemini modeli `GEMINI_MODEL_NAME` ile değiştirilebilir, varsayılan kodda `gemini-3-flash-preview`. Gerçek çalıştırma ortamındaki model bilinmiyor. Kanıt: `backend/app/services.py:112-115`.
- Öğrenci başarısı, öğrenme çıktısı, ön test/son test veya deneysel etkililik verisi kodda bulunmuyor. Bu konu YAYIN_006 kapsamına alınmamalıdır.
- Kişisel veri/etik onam/anonimleştirme mekanizması kodda bulunmadı. YAYIN_016 için ayrıca tasarlanmalıdır.

## 16. Ürün Tanıtımı Gibi Görünmemesi İçin Akademik Konumlandırma Önerisi
YAYIN_006 metni, CodeGradeAI'yi “pazara hazır ürün” olarak değil, “programlama eğitiminde AI destekli geri bildirim üretimini somutlaştıran ve uzman değerlendirmesine açılan bir tasarım bilimi artefaktı” olarak konumlandırmalıdır.

Önerilen akademik çerçeve:
- Çalışmanın amacı etkililik kanıtlamak değil, sistem tasarımını ve pedagojik kararları belgelemektir.
- “Öğrenci başarısını artırır”, “öğrenmeyi geliştirir”, “etkilidir” gibi sonuç cümleleri kullanılmamalıdır.
- Bunun yerine “seviye uyarlamalı geri bildirim üretimi için tasarlanmıştır”, “yapılandırılmış AI geri bildirim şeması sunar”, “uzman değerlendirmesine temel oluşturacak MVP bileşenleri içerir” gibi tasarım odaklı ifadeler kullanılmalıdır.
- Rubrik ve hata sınıflandırması anlatılırken mevcut durum açık sınırla yazılmalıdır: Rubrik prompt tabanlıdır; hata sınıflandırması ayrı taksonomi olarak henüz uygulanmamıştır.
- Sokratik geri bildirim ifadesi kullanılacaksa “tam etkileşimli Sokratik diyalog sistemi” iddiası kurulmadan, “Sokratik/kademeli geri bildirime evrilebilecek seviye uyarlamalı yapılandırılmış geri bildirim mimarisi” şeklinde sınırlandırılmalıdır.
- Oyunlaştırma öğeleri “motivasyonel tasarım bileşenleri” olarak sunulmalı; başarı etkisi iddiası YAYIN_016'ya bırakılmalıdır.
- Bulgular bölümü yerine “sistem tanımı”, “tasarım gereksinimleri”, “mimari bileşenler”, “pedagojik iş akışı”, “uzman değerlendirmesine sunulacak ölçütler” gibi başlıklar tercih edilmelidir.
- Sınırlılıklar açıkça yazılmalıdır: gerçek test çalıştırma yok, hata taksonomisi yok, çok turlu Sokratik akış yok, model/prompt versiyon logu yok, deneysel başarı verisi yok.
- YAYIN_015 ve YAYIN_016 ile ilişki net kurulmalıdır: YAYIN_015 ölçme aracı/madde kalitesi, YAYIN_006 sistem tasarımı/uzman değerlendirmesi, YAYIN_016 öğrenci verisine dayalı etkililik çalışmasıdır.

Kısa önerilen konumlandırma cümlesi:

> Bu çalışma, CodeGradeAI adlı MVP'nin programlama eğitiminde AI destekli, seviye uyarlamalı ve yapılandırılmış geri bildirim üretimine yönelik pedagojik tasarımını ve sistem mimarisini belgelemekte; öğrenci başarısına etkisine ilişkin nedensel bir iddia kurmadan, uzman değerlendirmesine temel olacak tasarım bileşenlerini ortaya koymaktadır.
