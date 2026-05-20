import { GoogleGenAI } from '@google/genai';
import { API_BASE } from './apiBase';

export type GeminiGenerateParams = {
  model: string;
  contents: { parts: unknown[] };
  config?: Record<string, unknown>;
};

let ai: GoogleGenAI | null = null;

const getClientAI = () => {
  if (!ai) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      throw new Error('Gemini API key is not configured. Please contact support.');
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

function formatGeminiErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const err = (body as { error?: { message?: string; code?: number } }).error;
    if (err?.message) {
      if (err.message.includes('API key not valid') || err.message.includes('API_KEY_INVALID')) {
        return 'Gemini API key is invalid or not enabled for this app. If you run locally, start the backend (port 8080) with GEMINI_API_KEY in .env, or create a key at https://aistudio.google.com/apikey';
      }
      return err.message;
    }
    const detail = (body as { detail?: string }).detail;
    if (detail) return detail;
  }
  return `Gemini request failed (${status})`;
}

async function generateViaProxy(params: GeminiGenerateParams): Promise<{ text?: string }> {
  const res = await fetch(`${API_BASE}/api/gemini/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(formatGeminiErrorMessage(body, res.status));
  }

  return body as { text?: string };
}

async function generateViaClient(params: GeminiGenerateParams): Promise<{ text?: string }> {
  const response = await getClientAI().models.generateContent(params);
  return { text: response.text };
}

/**
 * Calls Gemini via the FastAPI proxy when available (recommended).
 * Falls back to the browser SDK only when the proxy is unreachable and VITE_GEMINI_API_KEY is set.
 */
export async function geminiGenerateContent(params: GeminiGenerateParams): Promise<{ text?: string }> {
  try {
    return await generateViaProxy(params);
  } catch (proxyErr) {
    const hasClientKey = Boolean(import.meta.env.VITE_GEMINI_API_KEY);
    const isNetworkFailure =
      proxyErr instanceof TypeError ||
      (proxyErr instanceof Error &&
        /fetch|network|Failed to fetch/i.test(proxyErr.message));

    if (hasClientKey && isNetworkFailure) {
      console.warn('Gemini proxy unavailable, using client key:', proxyErr);
      return generateViaClient(params);
    }
    throw proxyErr;
  }
}
