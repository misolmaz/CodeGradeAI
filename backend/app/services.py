import os
import json
import google.generativeai as genai
from typing import Dict, Any
from .schemas import GradingResult, SubmissionRequest
from dotenv import load_dotenv
import pandas as pd
from sqlalchemy.orm import Session
from .models import User
from .auth import get_password_hash

load_dotenv()
import io
# ... (Gemini Init remains) ...

def process_excel_upload(file_contents: bytes, db: Session, admin_user: User = None):
    try:
        # Read Excel file from bytes stream to avoid FutureWarning
        df = pd.read_excel(io.BytesIO(file_contents))
        
        # Expected columns: OgrenciNo, Ad, Soyad, Sinif
        # Normalize column names just in case
        df.columns = [c.strip() for c in df.columns]
        
        results = {"added": 0, "skipped": 0, "updated": 0, "errors": []}
        
        for index, row in df.iterrows():
            try:
                student_no = str(row['OgrenciNo']).strip()
                full_name = f"{row.get('Ad', '')} {row.get('Soyad', '')}".strip()
                class_code = str(row.get('Sinif', ''))
                
                # Check if user exists
                existing_user = db.query(User).filter(User.student_number == student_no).first()
                
                if existing_user:
                    # Update existing user info (except password/role)
                    existing_user.full_name = full_name
                    existing_user.class_code = class_code
                    # Assign to current organization if not assigned (upsert logic for tenant)
                    if admin_user and not existing_user.organization_id:
                         existing_user.organization_id = admin_user.organization_id
                    
                    results["updated"] += 1
                else:
                    # Create new user
                    # Default password is the student number
                    hashed_pwd = get_password_hash(student_no)
                    
                    new_user = User(
                        student_number=student_no,
                        full_name=full_name,
                        password_hash=hashed_pwd,
                        role="student",
                        class_code=class_code,
                        is_first_login=True,
                        organization_id=admin_user.organization_id if admin_user else None
                    )
                    db.add(new_user)
                    results["added"] += 1
                
            except Exception as e:
                results["errors"].append(f"Row {index}: {str(e)}")
        
        db.commit()
        return results

    except Exception as e:
        raise Exception(f"Excel işleme hatası: {str(e)}")

# ... (Existing Gemini functions) ...

# Initialize Gemini
# Check both GEMINI_API_KEY and GOOGLE_API_KEY for service compatibility
API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
# Default to the most universal stable model if not specified
MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-3-flash-preview")



if not API_KEY:
    print("WARNING: API Key (GEMINI_API_KEY or GOOGLE_API_KEY) is not set in environment variables.")
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
    
    Aşağıdaki kriterlere göre Puan ver:
    96-100: Mükemmel çözüm. Gereksinimleri tam karşılıyor, hata yok, temiz ve seviyeye uygun en iyi pratikleri kullanıyor. Eğer kod istenen seviye için kusursuzsa 100 vermekten çekinme.
    85-95: Çok iyi. Küçük stil hataları veya çok ufak optimizasyon fırsatları var ama ana mantık kusursuz.
    70-84: İyi/Geçer. Bazı best-practice ihlalleri var veya kod biraz karışık ama çalışıyor ve görevini yapıyor.
    50-69: Zayıf. Kod çalışıyor ama mantıksal eksiklikler, kötü isimlendirmeler veya ciddi verimsizlikler var.
    0-49: Başarısız. Kod çalışmıyor, ana gereksinimler karşılanmamış veya tamamen yanlış yaklaşım.

    **NOT:** Sırf öneride bulunmak için puan kırma. Eğer kod mükemmelse 100 puan ver ve öneriler kısmına "Kodunuz zaten çok temiz, tebrikler!" gibi notlar düş.
    
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
    """

    generation_config = {
        "temperature": 0.4,
        "top_p": 1,
        "top_k": 32,
        "max_output_tokens": 8192,
        "response_mime_type": "application/json",
        "response_schema": GradingResult,
    }
    
    # Combined prompt with system instruction
    system_text = get_system_instruction(request.studentLevel)
    final_prompt = f"{system_text}\n\n---\n\n{user_prompt}"

    model = genai.GenerativeModel(
        model_name=MODEL_NAME,
        generation_config=generation_config
    )

    try:
        response = model.generate_content(final_prompt)
        text = response.text.strip()
        print(f"DEBUG: AI Response: {text}")
        
        # Parse JSON response
        result_json = json.loads(text)
        return GradingResult(**result_json)
        
    except Exception as e:
        print(f"Error calling Gemini: {e}")
        return GradingResult(
            grade=0,
            feedback=f"Yapay zeka yanıtı işlenirken bir hata oluştu: {str(e)}",
            codeQuality="Hata",
            suggestions=["Lütfen tekrar gönderin"],
            unitTests=[]
        )
