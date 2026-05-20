/**
 * Backend base URL for WattWalker API routes (/convert, /api/*).
 * - Production (Cloud Run): empty string → same-origin relative URLs.
 * - Local dev: Vite proxies /convert and /api to port 8080 when unset.
 * - Override with VITE_API_BASE_URL (e.g. Capacitor builds pointing at Cloud Run).
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
