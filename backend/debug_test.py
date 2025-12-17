import os
from dotenv import load_dotenv
import google.generativeai as genai

# .env dosyasını yükle
load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
model_name = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash") # Varsayılan olarak flash kullan

print("--- HATA AYIKLAMA BAŞLIYOR ---")
print(f"1. Model Adı: {model_name}")

if not api_key:
    print("❌ HATA: GOOGLE_API_KEY .env dosyasından okunamadı!")
else:
    print(f"2. API Key Durumu: Okundu ({api_key[:5]}...)")
    
    try:
        print("3. Google'a bağlanılıyor...")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Test: Merhaba, çalışıyor musun?")
        print("✅ BAŞARILI! Cevap geldi:")
        print(response.text)
    except Exception as e:
        print("\n❌ BAĞLANTI HATASI OLUŞTU:")
        print(e)

print("--- HATA AYIKLAMA BİTTİ ---")