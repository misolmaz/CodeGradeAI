# YAYIN 016: ödev tanımı ve prompt kalibrasyonu (uygulama öncesi, her yeni ödev için bir kez).
# Hafta 5 ödevlerinin doğru ve hatalı örnek çözümlerini gerçek modelle puanlatır.
# Kontrol edilenler: doğru çözüm yüksek, hatalı çözüm düşük Doğruluk alır mı; geri bildirim
# kapsam dışı yapıları (if, döngü, TryParse, try-catch, girdi denetimi) öneriyor mu.
# Veritabanına yazmaz; 8 API isteği harcar (yaklaşık 5 sent).
# Kullanım (backend konteyneri, /app):  python scripts/odev_kalibrasyon.py
import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # /app
import asyncio
from app import services
from app.schemas import SubmissionRequest

ODEV1 = """Hafta 5 Ödev 1: Saniyeyi saat, dakika ve saniyeye ayırma (C# 5, Visual Studio 2012 konsol uygulaması, proje adı Hafta05_Odev1_Sure).
Kullanıcıdan 0-1000000 aralığında toplam saniyeyi alın. Tam saati, kalan dakikayı ve kalan saniyeyi / ve % operatörleriyle hesaplayıp ayrı etiketlerle yazdırın (Saat:, Dakika:, Saniye:). const int SAATTE_SANIYE = 3600 ve const int DAKIKADA_SANIYE = 60 sabitlerini kullanın. Kullanıcıya ne gireceğini söyleyen bir istem, en az bir açıklayıcı yorum ve anlamlı değişken adları bulunmalı.
Beklenen sonuçlar: 0 için 0-0-0; 59 için 0-0-59; 60 için 0-1-0; 3661 için 1-1-1. Kontrol: toplamSaniye = saat * 3600 + dakika * 60 + saniye.
Kapsam: Girdinin belirtilen aralıkta ve doğru biçimde olduğu varsayılır. Bu hafta if, döngü, dizi, kendi metodunu yazma, TryParse, try-catch ve girdi denetimi beklenmiyor; bunların yokluğu eksik sayılmaz."""

ODEV2 = """Hafta 5 Ödev 2: Kırtasiye alışveriş hesabı (C# 5, Visual Studio 2012 konsol uygulaması, proje adı Hafta05_Odev2_Alisveris).
Bir defterin birim fiyatını decimal, adedini int olarak okuyun. Fiyat 0-1000, adet 0-100 aralığındadır. const decimal EK_BEDEL_ORANI = 0.20m; tanımlayın (eğitim amaçlı oran). Ara toplamı (fiyat * adet), ek bedeli (ara toplam * oran) ve genel toplamı ayrı değişkenlerde hesaplayıp F2 biçimiyle etiketli yazdırın. Kullanıcıya ne gireceğini söyleyen istem, en az bir açıklayıcı yorum ve anlamlı değişken adları bulunmalı.
Beklenen sonuçlar: 12,50 ve 4 için Ara toplam 50,00; Ek bedel 10,00; Genel toplam 60,00. 20 ve 0 için 0,00; 0,00; 0,00. Ondalık ayıracı Türkçe kültürde virgüldür.
Kapsam: Girdinin belirtilen aralıkta ve doğru biçimde olduğu varsayılır. Bu hafta if, döngü, dizi, kendi metodunu yazma, TryParse, try-catch ve girdi denetimi beklenmiyor; bunların yokluğu eksik sayılmaz."""

O1_DOGRU = """using System;
namespace Hafta05_Odev1_Sure
{
    class Program
    {
        static void Main(string[] args)
        {
            const int SAATTE_SANIYE = 3600;
            const int DAKIKADA_SANIYE = 60;
            Console.Write("Toplam saniye (0-1000000): ");
            int toplamSaniye = int.Parse(Console.ReadLine());
            // Önce tam saatleri, sonra saatten kalan saniyeden dakikayı ayırıyoruz
            int saat = toplamSaniye / SAATTE_SANIYE;
            int kalan = toplamSaniye % SAATTE_SANIYE;
            int dakika = kalan / DAKIKADA_SANIYE;
            int saniye = kalan % DAKIKADA_SANIYE;
            Console.WriteLine("Saat: " + saat);
            Console.WriteLine("Dakika: " + dakika);
            Console.WriteLine("Saniye: " + saniye);
        }
    }
}"""

# Hata: dakika saatten kalan yerine toplamdan hesaplanıyor (3661 için Dakika: 61)
O1_HATALI = O1_DOGRU.replace("int dakika = kalan / DAKIKADA_SANIYE;", "int dakika = toplamSaniye / DAKIKADA_SANIYE;")

O2_DOGRU = """using System;
namespace Hafta05_Odev2_Alisveris
{
    class Program
    {
        static void Main(string[] args)
        {
            const decimal EK_BEDEL_ORANI = 0.20m;
            Console.Write("Defter birim fiyati: ");
            decimal fiyat = decimal.Parse(Console.ReadLine());
            Console.Write("Adet: ");
            int adet = int.Parse(Console.ReadLine());
            // Ek bedel ara toplam uzerinden hesaplanir
            decimal araToplam = fiyat * adet;
            decimal ekBedel = araToplam * EK_BEDEL_ORANI;
            decimal genelToplam = araToplam + ekBedel;
            Console.WriteLine("Ara toplam: {0:F2}", araToplam);
            Console.WriteLine("Ek bedel: {0:F2}", ekBedel);
            Console.WriteLine("Genel toplam: {0:F2}", genelToplam);
        }
    }
}"""

# Hata: ek bedel birim fiyat üzerinden (adet unutuluyor); 12,50 ve 4 için Ek bedel 2,50
O2_HATALI = O2_DOGRU.replace("decimal ekBedel = araToplam * EK_BEDEL_ORANI;", "decimal ekBedel = fiyat * EK_BEDEL_ORANI;")

ORNEKLER = [
    ("Ödev1 doğru ", ODEV1, O1_DOGRU),
    ("Ödev1 hatalı", ODEV1, O1_HATALI),
    ("Ödev2 doğru ", ODEV2, O2_DOGRU),
    ("Ödev2 hatalı", ODEV2, O2_HATALI),
]
TEKRAR = 2
KAPSAM_DISI = re.compile(r"TryParse|\btry\b|\bcatch\b|\bif\b|döngü|girdi kontrol|giriş kontrol|geçersiz|doğrula", re.IGNORECASE)


def _metin(r):
    parcalar = [r.feedback or "", " ".join(r.suggestions or [])]
    sf = r.socraticFeedback
    if sf:
        parcalar += [sf.awareness_question, sf.guiding_question, sf.progressive_hint, sf.next_action]
    return " ".join(p for p in parcalar if p)


async def puanla(ad, tanim, kod):
    req = SubmissionRequest(assignmentDescription=tanim, assignmentLanguage="C#",
                            studentCode=kod, studentLevel="beginner")
    r = await services.grade_submission(req)
    rs = r.rubricScores
    rub = f"{rs.correctness}-{rs.algorithmic_thinking}-{rs.syntax_and_language_use}-{rs.code_readability}-{rs.debugging_awareness}" if rs else "-"
    bulunan = sorted({m.group(0).lower() for m in KAPSAM_DISI.finditer(_metin(r))})
    return ad, r.grade, rub, [e.error_type for e in (r.errorFindings or [])], bulunan, r


async def main():
    print(f"Model: {services.MODEL_NAME} | sıcaklık: {services.LLM_TEMPERATURE} | düşünme: {services.LLM_THINKING_LEVEL} | prompt: {services.PROMPT_VERSION}")
    print("Rubrik sırası: doğruluk-algoritma-sözdizimi-okunabilirlik-hata ayıklama\n")
    isler = [puanla(ad, t, k) for ad, t, k in ORNEKLER for _ in range(TEKRAR)]
    sonuclar = await asyncio.gather(*isler)
    for ad, g, rub, hatalar, bulunan, _ in sonuclar:
        print(f"  {ad} | puan {g:3d} | rubrik {rub} | hatalar {hatalar} | kapsam dışı kelime: {bulunan or 'yok'}")
    # Bir örneğin Sokratik ipuçlarını göster (deney grubunun göreceği metin)
    for ad, _, _, _, _, r in sonuclar:
        if "hatalı" in ad and r.socraticFeedback:
            sf = r.socraticFeedback
            print(f"\nÖrnek Sokratik geri bildirim ({ad.strip()}):")
            print("  Farkındalık:", sf.awareness_question)
            print("  Yönlendirme:", sf.guiding_question)
            print("  İpucu      :", sf.progressive_hint)
            break
    print("\nBeklenen: doğru çözümler 80+ ve Doğruluk 4-5; hatalı çözümlerde Doğruluk 1-3;"
          " 'kapsam dışı kelime' çoğunlukla 'yok'.")


asyncio.run(main())
