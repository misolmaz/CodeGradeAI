import os
import json
import google.generativeai as genai
from typing import Dict, Any
from .schemas import GradingResult, SubmissionRequest
from dotenv import load_dotenv

load_dotenv()

# Initialize Gemini
API_KEY = os.getenv("GOOGLE_API_KEY")
MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash")

if not API_KEY:
    print("WARNING: GOOGLE_API_KEY is not set in environment variables.")
else:
    genai.configure(api_key=API_KEY)

def get_system_instruction(student_level: str) -> str:
    # Configurations based on level
    level_configs = {
        "beginner": {
            "focus": "Temel kavramlar, söz dizimi, hata ayıklama",
            "complexity": "Basit açıklamalar, minimal teknik terim",
            "grading": "Çalışır kod ve temel gereksinimler öncelikli"
        },
        "intermediate": {
            "focus": "Kod organizasyonu, temiz kod, orta düzey optimizasyon",
            "complexity": "Orta düzey terimler, best practices",
            "grading": "Kalite, okunabilirlik, temel optimizasyon"
        },
        "advanced": {
            "focus": "Algoritmik optimizasyon, güvenlik, tasarım desenleri",
            "complexity": "İleri terimler, profesyonel standartlar",
            "grading": "Performans, ölçeklenebilirlik, bakım kolaylığı"
        }
    }

    config = level_configs.get(student_level, level_configs["intermediate"])

    # Determine level specific instructions
    level_specific_instruction = ""
    if student_level == "beginner":
        level_specific_instruction = """
        • Tüm geri bildirimleri basit ve anlaşılır dilde ver
        • Her teknik terimi açıkla (ör: "Rekürsif fonksiyon kendi kendini çağıran fonksiyondur")
        • Küçük başarıları öv ve motive et
        • En fazla 1-2 geliştirme önerisi ver
        """
    elif student_level == "intermediate":
        level_specific_instruction = """
        • Temiz kod prensiplerine vurgu yap (DRY, KISS)
        • Performans ve okunabilirlik dengesini değerlendir
        • Dilin daha iyi özelliklerini tanıt (list comprehension, lambda, vs.)
        • 3-4 geliştirme önerisi ver
        """
    else: # advanced
        level_specific_instruction = """
        • Profesyonel standartları bekle (hata yönetimi, test edilebilirlik)
        • Algoritmik karmaşıklık analizi yap (Big-O)
        • Güvenlik ve ölçeklenebilirlik konularına değin
        • Alternatif çözüm yolları göster
        """

    return f"""
    Sen tecrübeli, sabırlı ve öğrenci seviyesine uyum sağlayan bir Bilgisayar Bilimleri Profesörüsün.
    
    **ÖĞRENCİ SEVİYESİ: {student_level.upper()}**
    
    Bu seviyeye göre şu odak noktalarını kullan:
    - ODAK ALANLARI: {config["focus"]}
    - TEKNİK DERİNLİK: {config["complexity"]}
    - PUANLAMA ÖNCELİĞİ: {config["grading"]}
    
    **SEVİYEYE ÖZEL YAKLAŞIMLAR:**
    {level_specific_instruction}
    
    **TÜM SEVİYELER İÇİN ORTAK KURALLAR:**
    
    1. **Pedagojik Yaklaşım:** Sandwich Metodu (olumlu → gelişim → teşvik)
    2. **Dil:** Samimi "sen" dili, tamamen Türkçe
    3. **Yapıcılık:** Hataları "öğrenme fırsatı" olarak sun
    
    **PUANLAMA REHBERİ (0-100):**
    
    BAŞLANGIÇ Seviyesi:
    - Kod çalışmıyor: 0-30
    - Çalışıyor ama ciddi hatalar var: 40-60  
    - Temel gereksinimleri karşılıyor: 70-85
    - Temiz, anlaşılır, doğru: 90-100
    
    ORTA Seviyesi:
    - Kod çalışmıyor: 0-40
    - Çalışıyor ama kötü yazılmış: 50-70
    - Temiz, okunabilir, DRY: 75-90
    - Optimize, iyi yapılandırılmış: 91-100
    
    İLERİ Seviyesi:
    - Kod çalışmıyor: 0-50
    - Temel düzeyde çalışıyor: 60-75
    - İyi ama standartlara uymuyor: 76-85
    - Profesyonel kalitede: 86-95
    - Mükemmel (en iyi pratikler, testler, optimizasyon): 96-100
    
    **ÇIKTI FORMATI:**
    - TÜM çıktılar Türkçe olmalı
    - JSON şemasına kesinlikle uy
    - Feedback'te öğrenci seviyesine uygun dil kullan
    """

async def grade_submission(request: SubmissionRequest) -> GradingResult:
    if not API_KEY:
         return GradingResult(
            grade=0,
            feedback="API Key yapılandırılmamış. Lütfen sunucu ayarlarını kontrol edin.",
            codeQuality="Bilinmiyor",
            suggestions=["Server .env dosyasını kontrol et"],
            unitTests=[]
        )

    user_prompt = f"""
    **Ödev Tanımı:**
    {request.assignmentDescription}

    **Hedef Dil:**
    {request.assignmentLanguage}

    **Öğrenci Kodu:**
    {request.studentCode}
    
    **Öğrenci Seviyesi:** {request.studentLevel}
    
    Lütfen kodu analiz et, zihinsel olarak çalıştır ve değerlendir.
    Yanıtın kesinlikle bir JSON nesnesi olmalı ve şu şemaya uymalıdır:
    {{
        "grade": integer,
        "feedback": string,
        "codeQuality": string,
        "suggestions": [string],
        "unitTests": [
            {{ "testName": string, "passed": boolean, "message": string }}
        ]
    }}
    """

    generation_config = {
        "temperature": 0.4,
        "top_p": 1,
        "top_k": 32,
        "max_output_tokens": 8192,
        "response_mime_type": "application/json",
    }
    
    # Combined prompt with system instruction
    system_text = get_system_instruction(request.studentLevel)
    final_prompt = f"{system_text}\n\n---\n\n{user_prompt}"

    model = genai.GenerativeModel(
        model_name=MODEL_NAME,
        generation_config=generation_config
        # system_instruction removed to Ensure compatibility
    )

    try:
        response = model.generate_content(final_prompt)
        # Clean response text (remove markdown backticks if present)
        text = response.text.strip()
        print(f"DEBUG: Raw AI Response: {text}")  # Debug log added

        if text.startswith("```"):
            # Remove first line (```json) and last line (```)
            # Find the first newline and last newline to robustly strip
            first_newline = text.find("\n")
            last_newline = text.rfind("\n")
            if first_newline != -1 and last_newline != -1:
                 text = text[first_newline+1:last_newline].strip()
        
        # Parse JSON response
        try:
            result_json = json.loads(text)
        except json.JSONDecodeError:
            # Better Repair Logic for Truncated JSON
            trimmed = text.strip()
            
            # 1. If it ends inside a string (no closing quote), backtrace to the start of that string or comma
            # Check if the number of quotes is odd (meaning inside a string)
            if trimmed.count('"') % 2 != 0:
                # Find the last quote
                last_quote_index = trimmed.rfind('"')
                if last_quote_index != -1:
                    # Remove the incomplete string content
                    # We also need to check if there was a comma before this string
                     trimmed = trimmed[:last_quote_index]
                     # Remove trailing comma if exists after removing string
                     trimmed = trimmed.rstrip().rstrip(',').rstrip()

            # 2. Close open structures
            open_braces = trimmed.count('{') - trimmed.count('}')
            open_brackets = trimmed.count('[') - trimmed.count(']')
            
            # Append necessary closing characters
            repaired_text = trimmed + ("]" * open_brackets) + ("}" * open_braces)
            
            print(f"DEBUG: Attempting repair -> {repaired_text}")

            try:
                result_json = json.loads(repaired_text)
                # If repair resulted in missing required fields (like unitTests if truncated before that), fill defaults
                if "unitTests" not in result_json:
                    result_json["unitTests"] = []
                if "suggestions" not in result_json:
                     result_json["suggestions"] = []
                
            except:
                 print(f"DEBUG: Repair failed.")
                 raise ValueError("AI yanıtı yarım kaldı (Token limiti veya ağ hatası).")

        return GradingResult(**result_json)
        
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        return GradingResult(
            grade=0,
            feedback="Yapay zeka yanıtı işlenirken bir hata oluştu (JSON Hatası). Lütfen tekrar deneyin.",
            codeQuality="Bilinmiyor",
            suggestions=["Tekrar gönderin", "Kodunuzu kısaltmayı deneyin"],
            unitTests=[]
        )
