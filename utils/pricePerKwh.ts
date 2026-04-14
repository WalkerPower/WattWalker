/** Parses manual $/kWh input; falls back to bill total ÷ usage when empty or invalid. */
export function parsePricePerKwhInput(
  raw: string | undefined,
  billCost: number,
  billUsage: number
): number {
  const fallback = billCost > 0 && billUsage > 0 ? billCost / billUsage : 0;
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const n = parseFloat(
    String(raw)
      .trim()
      .replace(/\$/g, '')
      .replace(/,/g, '')
  );
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/**
 * Canonical string for Master Deck mail merge: `$` + leading digit before `.` + exactly 3 decimals.
 * Slide indices that use this value are defined in `solar_app.py` (utility blocks 16–21, 27–32, 35–37).
 * Example: `0.234` → `$0.234`, `.5` → `$0.500`
 */
export function formatPricePerKwhForPresentation(rate: number): string {
  if (!Number.isFinite(rate) || rate < 0) {
    return '$0.000';
  }
  let s = rate.toFixed(3);
  if (s.startsWith('.')) {
    s = `0${s}`;
  }
  return `$${s}`;
}
