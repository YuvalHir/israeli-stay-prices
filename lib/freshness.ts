/** Report freshness uses the older of the stay month and submission time.
 * A late-submitted old stay cannot become a fresh price. */
export function reportAgeDays(createdAt: string | null | undefined, stayMonth: string | null | undefined, now = Date.now()): number | null {
  const submitted = createdAt ? Date.parse(`${createdAt.replace(' ', 'T')}${/[Zz]|[+-]\d{2}:?\d{2}$/.test(createdAt) ? '' : 'Z'}`) : NaN;
  const match = stayMonth?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  const stayed = match ? Date.UTC(Number(match[1]), Number(match[2]), 0, 23, 59, 59) : NaN;
  const valid = [submitted, stayed].filter(Number.isFinite);
  if (!valid.length) return null;
  return Math.max(0, Math.floor((now - Math.min(...valid)) / 864e5));
}
export function freshnessLabel(days: number | null): string {
  if (days == null) return 'תאריך הדיווח לא ידוע';
  if (days === 0) return 'דווח ב־24 השעות האחרונות';
  if (days === 1) return 'דווח לפני יום';
  return `דווח לפני ${days} ימים`;
}
/** Every 90 days halves a report's weight. Old reports remain available, never zeroed. */
export function freshnessWeight(days: number | null): number {
  return days == null ? 0.1 : Math.max(0.1, Math.pow(0.5, days / 90));
}
export function weightedMedian(samples: { price: number; days: number | null }[]): number | null {
  const sorted = samples.filter(x => Number.isFinite(x.price) && x.price >= 0).sort((a, b) => a.price - b.price);
  if (!sorted.length) return null;
  const total = sorted.reduce((sum, item) => sum + freshnessWeight(item.days), 0);
  let running = 0;
  for (let i = 0; i < sorted.length; i++) {
    running += freshnessWeight(sorted[i].days);
    if (running >= total / 2 - 1e-9) {
      if (Math.abs(running - total / 2) < 1e-9 && sorted[i + 1]) return (sorted[i].price + sorted[i + 1].price) / 2;
      return sorted[i].price;
    }
  }
  return sorted[sorted.length - 1].price;
}
