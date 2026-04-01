/**
 * Parse month labels from bill / AI output for sorting and display.
 * JCP&L graphs use a separate A/E/C row (Actual/Estimate) — those must never be month strings.
 */

const MONTH_PREFIXES: [string, number][] = [
  ['january', 0],
  ['jan', 0],
  ['february', 1],
  ['feb', 1],
  ['march', 2],
  ['mar', 2],
  ['april', 3],
  ['apr', 3],
  ['may', 4],
  ['june', 5],
  ['jun', 5],
  ['july', 6],
  ['jul', 6],
  ['august', 7],
  ['aug', 7],
  ['september', 8],
  ['sept', 8],
  ['sep', 8],
  ['october', 9],
  ['oct', 9],
  ['november', 10],
  ['nov', 10],
  ['december', 11],
  ['dec', 11]
];

export function parseBillMonthLabel(s: string): { year: number; month: number } | null {
  const raw = s.trim();
  if (!raw) return null;
  // Actual / Estimate / Customer markers — not months
  if (/^(a|e|c)$/i.test(raw)) return null;

  const norm = raw.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const yearMatch = norm.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  // Longest names first within same month not needed if we check september before sep
  const ordered = [...MONTH_PREFIXES].sort((a, b) => b[0].length - a[0].length);
  for (const [pref, monthIdx] of ordered) {
    if (norm === pref || norm.startsWith(pref + ' ') || norm.startsWith(pref + ',')) {
      return { year: year ?? new Date().getFullYear(), month: monthIdx };
    }
  }

  return null;
}

/** Chronological sort key; unknown labels sort after real dates, preserving fallbackIndex order */
export function billMonthSortKey(label: string, fallbackIndex: number): number {
  const p = parseBillMonthLabel(label);
  if (p) return p.year * 12 + p.month;
  return 4000 * 12 + fallbackIndex;
}

const DISPLAY_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

export function formatBillMonthDisplay(label: string): string {
  const p = parseBillMonthLabel(label);
  if (p) return `${DISPLAY_NAMES[p.month]} ${p.year}`;
  const idx = legacyMonthIndexOnly(label);
  if (idx >= 0) return DISPLAY_NAMES[idx];
  return label.split(/\s+/)[0] || label;
}

/** 0–11 for calendar month only; no year (legacy); single-letter J/M/A ambiguous — returns -1 */
export function legacyMonthIndexOnly(monthStr: string): number {
  const lower = monthStr.toLowerCase().trim();
  if (/^(a|e|c)$/i.test(lower)) return -1;
  if (lower.length <= 1) return -1;
  if (lower.startsWith('ja')) return 0;
  if (lower.startsWith('f')) return 1;
  if (lower.startsWith('mar')) return 2;
  if (lower.startsWith('ap')) return 3;
  if (lower.startsWith('may')) return 4;
  if (lower.startsWith('jun')) return 5;
  if (lower.startsWith('jul')) return 6;
  if (lower.startsWith('au')) return 7;
  if (lower.startsWith('sep')) return 8;
  if (lower.startsWith('oct')) return 9;
  if (lower.startsWith('nov')) return 10;
  if (lower.startsWith('dec')) return 11;
  if (lower.startsWith('s')) return 8;
  if (lower.startsWith('o')) return 9;
  if (lower.startsWith('n')) return 10;
  if (lower.startsWith('d')) return 11;
  return -1;
}

/** Map label to calendar month 0–11 for CSV columns (January–December) */
export function calendarMonthIndexForCsv(label: string): number {
  const p = parseBillMonthLabel(label);
  if (p) return p.month;
  return legacyMonthIndexOnly(label);
}
