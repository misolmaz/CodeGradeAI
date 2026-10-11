# YAYIN 016: Çalışma ayarları ve doğrulama

Bu dal (`study-016-prep`), CodeGradeAI'yi deney-kontrol çalışmasına hazırlar. Veritabanı şeması değişmez; migration gerekmez. Koşullar ortam değişkenleriyle yönetilir.

## 1. Ortam değişkenleri (Coolify > backend > Environment Variables)

| Değişken | Çalışma değeri | Anlamı |
|---|---|---|
| `GRADE_ONLY_CLASS_CODES` | Kontrol şubesinin sınıf kodu (ör. `1A`) | Bu sınıftaki öğrenciler yalnızca puanı görür. Diğer herkes Sokratik geri bildirim alır. Büyük/küçük harf duyarsız; Excel'deki `Sinif` sütunuyla aynı yazılmalı |
| `GAMIFICATION_ENABLED` | `false` | Öğrenciler için liderlik tablosu ve rozetler kapanır (öğretmen görünümü etkilenmez) |
| `MAX_ATTEMPTS_PER_ASSIGNMENT` | `2` | Ödev başına değerlendirilen en fazla teslim; iki grupta aynı |
| `SUCCESS_GRADE_THRESHOLD` | `90` | Bu puan alınınca o ödeve yeni teslim kabul edilmez |
| `LLM_TEMPERATURE` | `0` | Değerlendirme modelinin sıcaklığı. Varsayılan 0.4; aynı koda farklı puan verme olasılığını azaltmak için 0. Her değerlendirme olayının metadata'sına yazılır |

Değişken eklendikten veya değiştikten sonra backend yeniden başlatılmalıdır. Varsayılanlar mevcut davranışı korur (`GRADE_ONLY_CLASS_CODES` boşsa herkes Sokratik alır).

**Uyarı:** `GRADE_ONLY_CLASS_CODES` yanlış yazılırsa kontrol grubu Sokratik geri bildirim alır (bulaşma). Uygulama başlamadan önce Bölüm 3'teki kontrol yapılmalıdır.

## 2. Değişen davranış

| Konu | Önce | Sonra |
|---|---|---|
| Teslim akışı | İstemci `/api/grade` (kimliksiz) çağırır, sonra notu `/submissions/`'a kendisi yazar | Tek adım: `/api/grade` (kimlik zorunlu) teslimi sunucuda oluşturur, değerlendirir, kaydeder. `POST /submissions/` 410 döner |
| Araştırma logu | Arayüzden hiç oluşmuyordu (token ve ödev kimliği gönderilmiyordu) | Her teslimde `study_sessions`, `submissions` (attempt_no), `evaluations`, `interaction_events` yazılır. `submission_created` olayında `feedback_mode` ve `class_code` kaydedilir |
| Kontrol koşulu | Yok | Sunucu, `grade_only` öğrencisine yalnızca puanı döndürür (`/api/grade` ve `GET /submissions/`). Tam değerlendirme veritabanında saklanır; öğretmen tam raporu görür |
| Deneme hakkı | Yalnızca arayüzde (2) | Sunucuda denetlenir; iki grupta aynı |
| AI hatası | Arayüz hatayı gösterir, teslim kaydedilmez | Teslim `submission_source = ai_error` ile logda kalır, deneme hakkından düşmez, listede, öğretmen analizinde ve liderlik tablosunda sayılmaz; öğrenciye 503 ile mesaj döner |
| İlk giriş | `is_first_login` uygulanmıyordu | Öğrenci parolasını değiştirmeden ödev gönderemez; yeni parola en az 6 karakter ve öğrenci numarasından farklı. Öğretmenin parola sıfırlaması ilk giriş zorunluluğunu yeniden açar |
| Teslim silme | Öğrenci kendi teslimini silebiliyordu; değerlendirmesi olan teslimin silinmesi PostgreSQL'de yabancı anahtar hatası verirdi | Yalnızca öğretmen/yönetici kaldırabilir. Araştırma kaydı fiziksel silinmez: `submission_source = teacher_removed` olur, listeden ve deneme sayısından çıkar, işlem loglanır; öğrenci yeniden gönderebilir |
| Oyunlaştırma | Her zaman açık | `GAMIFICATION_ENABLED=false` ile öğrencide kapalı |
| Uygulama sadakati | İpucu kademesi yalnızca tarayıcıda tutuluyordu | `POST /api/interaction`: `result_viewed` (iki koşul; açılıştaki kademe), `scaffold_advanced` (deney; kademe 0-1-2-3), kademe 3'te `full_report_unlocked` ve `study_sessions.full_report_unlocked_at` |

Not: `study_sessions.consent_recorded` alanı arayüzden doldurulmuyor (her zaman `false`). Onam kâğıt üzerinde alındığı için analizde bu alana göre süzme yapılmamalıdır.

## 3. Yayına almadan önce kontrol (yaklaşık 15 dakika)

1. Üretim veritabanının yedeğini al.
2. Ortam değişkenlerini gir ve backend'i yeniden başlat. `GET /api/config` yanıtı: `{"gamification_enabled": false, "max_attempts": 2, "success_threshold": 90}`.
3. Bir test ödevi oluştur. İki test öğrencisi kullan: biri kontrol sınıf kodunda, biri deney sınıf kodunda.
4. Her iki öğrenciyle giriş yap: parola değiştirme ekranı gelmeli.
5. Kontrol öğrencisi: teslim sonrası yalnızca puan paneli görünmeli. Tarayıcı geliştirici araçları > Ağ sekmesinde `/api/grade` yanıtında `feedback` boş, `socraticFeedback` `null` olmalı.
6. Deney öğrencisi: ilk teslimde farkındalık sorusu, ikinci teslimde tam rapor görünmeli. "Daha Fazla İpucu" tıklamaları `interaction_events` tablosunda `scaffold_advanced` olarak görünmeli.
7. Üçüncü teslim denemesi iki öğrencide de reddedilmeli.
8. Öğretmen hesabıyla iki öğrencinin teslimlerinde tam rapor görünmeli.
9. Test kayıtlarını sil veya çalışma verisinden ayırmak için test öğrencilerinin numaralarını not et.

## 4. Testler

```bash
cd backend
python -m pytest tests -q
```

Testler geçici SQLite kullanır ve gerçek AI çağrısı yapmaz.
