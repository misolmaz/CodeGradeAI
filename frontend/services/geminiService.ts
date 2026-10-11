import { Badge, GradingResult } from "../types";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

/** POST /api/grade yanıtı: (öğrenci koşuluna göre süzülmüş) değerlendirme + sunucuda oluşturulan teslim. */
export interface GradeResponse extends GradingResult {
  submissionId?: number;
  assignmentId?: number;
  userId?: number;
  studentName?: string;
  submittedAt?: string;
  attemptNo?: number;
  newBadges?: Badge[];
}

/** Sunucunun reddettiği teslim (deneme hakkı dolu, süre geçmiş, AI geçici hata vb.). */
export class GradeRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GradeRequestError";
    this.status = status;
  }
}

/**
 * Tek adımlı teslim (YAYIN 016): teslim sunucuda oluşturulur, değerlendirilir ve kaydedilir.
 * Not artık istemciden sunucuya gönderilmez. Hata durumunda GradeRequestError fırlatır;
 * iptal edilen istek (AbortError) olduğu gibi yeniden fırlatılır.
 */
export const gradeSubmission = async (
  token: string,
  assignmentId: number,
  assignmentDescription: string,
  assignmentLanguage: string,
  studentCode: string,
  studentLevel: string = "beginner",
  signal?: AbortSignal
): Promise<GradeResponse> => {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/grade`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        assignmentId,
        assignmentDescription,
        assignmentLanguage,
        studentCode,
        studentLevel,
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    console.error("Error grading submission:", error);
    throw new GradeRequestError(
      "Sunucu ile bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.",
      0
    );
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail =
      typeof errorData.detail === "string" ? errorData.detail : `Sunucu hatası: ${response.status}`;
    throw new GradeRequestError(detail, response.status);
  }

  return (await response.json()) as GradeResponse;
};

/**
 * YAYIN 016 uygulama sadakati logu (ateşle-unut). Hata öğrenci deneyimini etkilemez.
 * result_viewed: sonuç ekranı açıldı; scaffold_advanced: bir sonraki Sokratik kademeye geçildi.
 */
export const logInteraction = (
  token: string,
  payload:
    | { submissionId: number; event: "result_viewed"; uiLevel?: number | null }
    | { submissionId: number; event: "scaffold_advanced"; fromLevel: number; toLevel: number }
): void => {
  if (!token || !Number.isFinite(payload.submissionId)) return;
  fetch(`${BACKEND_URL}/api/interaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    /* sessizce yok say */
  });
};
