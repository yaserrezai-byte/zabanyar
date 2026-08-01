// ============================================================
// زبان‌یار | Date helpers
// Isolated from components so React's purity rule is satisfied:
// server components stay declarative and the clock is read here.
// ============================================================

/** Today as YYYY-MM-DD (UTC). */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The date `n` days ago as YYYY-MM-DD (UTC). */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** A continuous list of YYYY-MM-DD strings covering the last `n` days, oldest first. */
export function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(daysAgo(i));
  return out;
}

/** Current instant as an ISO timestamp. */
export function nowIso(): string {
  return new Date().toISOString();
}
