# YAYIN 016: eşzamanlı değerlendirme yük testi (veritabanına yazmaz; yalnızca API kotası harcar).
# Kullanım (backend konteyneri, /app):  python scripts/yuk_testi.py 10
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # /app
# "Error calling Gemini: 429 ..." satırları kota/hız sınırına takılan istekleri gösterir.
import asyncio, sys, time
from app import services
from app.schemas import SubmissionRequest

N = int(sys.argv[1]) if len(sys.argv) > 1 else 10
KOD = """using System;
class Program {
    static void Main() {
        int n1 = int.Parse(Console.ReadLine());
        int n2 = int.Parse(Console.ReadLine());
        int n3 = int.Parse(Console.ReadLine());
        double ort = (n1 + n2 + n3) / 3;
        Console.WriteLine("Ortalama: " + ort);
        if (ort > 50) Console.WriteLine("Geçti");
        else Console.WriteLine("Kaldı");
    }
}"""
REQ = SubmissionRequest(
    assignmentDescription="Kullanıcıdan 3 sınav notu alın, ortalamayı ondalıklı hesaplayıp yazdırın; 50 ve üzeri Geçti, değilse Kaldı.",
    assignmentLanguage="C#", studentCode=KOD, studentLevel="beginner")

# gemini-3.8-flash standart fiyat (31.12.2026'ya kadar), 1M token başına USD
FIYAT_GIRDI, FIYAT_CIKTI = 0.75, 3.75


async def bir(i):
    t = time.perf_counter()
    u = {}
    r = await services.grade_submission(REQ, usage=u)
    ok = r.pedagogicalMetadata is not None
    rs = r.rubricScores
    rub = f"{rs.correctness}-{rs.algorithmic_thinking}-{rs.syntax_and_language_use}-{rs.code_readability}-{rs.debugging_awareness}" if rs else "-"
    return i, time.perf_counter() - t, ok, r.grade, rub, u

async def main():
    print(f"Model: {services.MODEL_NAME} | sıcaklık: {getattr(services, 'LLM_TEMPERATURE', '?')} | düşünme: {getattr(services, 'LLM_THINKING_LEVEL', '?')} | eşzamanlı istek: {N}")
    t = time.perf_counter()
    sonuc = await asyncio.gather(*[bir(i + 1) for i in range(N)])
    maliyet = []
    for i, s, ok, g, rub, u in sonuc:
        gir = u.get("prompt_token_count", 0)
        cik = u.get("candidates_token_count", 0) + u.get("thoughts_token_count", 0)
        usd = gir / 1e6 * FIYAT_GIRDI + cik / 1e6 * FIYAT_CIKTI
        if ok:
            maliyet.append(usd)
        print(f"  #{i:2d} | {s:5.1f} sn | {'BAŞARILI' if ok else 'HATA    '} | puan {g:3d} | rubrik {rub} | deneme {u.get('attempts', '-')} | girdi {gir} çıktı+düşünme {cik} token | ${usd:.4f}")
    basarili = sum(1 for x in sonuc if x[2])
    print(f"Toplam {time.perf_counter() - t:.1f} sn | başarılı {basarili}/{N}")
    puanlar = sorted({x[3] for x in sonuc if x[2]})
    print(f"Aynı koda verilen farklı puanlar: {puanlar}")
    if maliyet:
        ort = sum(maliyet) / len(maliyet)
        print(f"Değerlendirme başına ortalama maliyet: ${ort:.4f} | 1.100 değerlendirme (dönem tahmini): ${ort * 1100:.2f}")

asyncio.run(main())
