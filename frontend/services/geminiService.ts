import { GradingResult } from "../types";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export const gradeSubmission = async (
  assignmentDescription: string,
  assignmentLanguage: string,
  studentCode: string,
  studentLevel: string = "beginner"
): Promise<GradingResult> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/grade`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assignmentDescription,
        assignmentLanguage,
        studentCode,
        studentLevel,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server hatası: ${response.status}`);
    }

    const result = (await response.json()) as GradingResult;
    return result;

  } catch (error) {
    console.error("Error grading submission:", error);
    return {
      grade: 0,
      feedback: "Sunucu ile bağlantı kurulamadı veya bir hata oluştu. Lütfen backend'in çalıştığından emin olun. (Hata: " + (error instanceof Error ? error.message : "Bilinmeyen Hata") + ")",
      codeQuality: "Bilinmiyor",
      suggestions: ["Backend sunucusunu kontrol et: http://localhost:8000"],
      unitTests: [],
    };
  }
};
