import { GoogleGenAI } from "@google/genai";

// Global cooldown tracker for Gemini API
let geminiCooldownUntil = 0;

/**
 * Checks if the Gemini API is currently in backoff/cooldown due to quota/rate limits.
 */
export function isGeminiCooldownActive(): boolean {
  return Date.now() < geminiCooldownUntil;
}

/**
 * Activates a cooldown period for all Gemini API calls.
 */
export function activateGeminiCooldown(durationMs = 5 * 60 * 1000): void {
  geminiCooldownUntil = Date.now() + durationMs;
  console.warn(`[Gemini] Cooldown activated. All queries will bypass Gemini and use high-quality simulated fallback until: ${new Date(geminiCooldownUntil).toISOString()}`);
}

/**
 * Helper to call Gemini's generateContent with automatic retry and exponential backoff
 * for transient errors (e.g. 503 UNAVAILABLE or 429 RATE_LIMIT).
 * @param aiClient GoogleGenAI client instance
 * @param params Request parameters
 * @param retries The explicit retry bound (default: 5)
 * @param initialDelay Initial delay before retrying in milliseconds (default: 1500)
 */
export async function generateContentWithRetry(
  aiClient: GoogleGenAI,
  params: { model: string; contents: any; config?: any },
  retries = 3, // Lower default retries to be nicer to quota
  initialDelay = 1500
): Promise<any> {
  if (isGeminiCooldownActive()) {
    throw new Error("Gemini API is currently in cooldown/backoff due to rate limit (429/RESOURCE_EXHAUSTED).");
  }

  let lastError: any = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await aiClient.models.generateContent(params);
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.statusCode || 0;
      const errMessage = err?.message || String(err);
      
      const isQuotaError =
        status === 429 || 
        errMessage.includes("429") ||
        errMessage.includes("RESOURCE_EXHAUSTED") ||
        errMessage.includes("quota") ||
        errMessage.includes("limit exceeded") ||
        errMessage.includes("Quota exceeded");

      if (isQuotaError) {
        console.warn(`[Gemini] Quota limit hit during attempt ${attempt}. Activating cooldown/backoff.`);
        activateGeminiCooldown();
        break; // Fail fast so calling logic can immediately transition to simulation fallback
      }

      const isTransient = 
        status === 503 || 
        errMessage.includes("503") || 
        errMessage.includes("UNAVAILABLE") ||
        errMessage.includes("high demand") ||
        errMessage.includes("temporary");

      if (isTransient && attempt < retries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.warn(`[Gemini] Attempt ${attempt} failed with transient error: ${errMessage}. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }
  throw lastError;
}
