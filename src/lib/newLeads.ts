import type { Lead } from '../types';

/**
 * זיהוי לידים חדשים שנכנסו מהאוטומציה (Gmail → Make → Airtable).
 * "חדש" = נוצר אחרי נקודת הייחוס האחרונה שהסוכן כבר הציג.
 */

const time = (iso: string | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

/** זמן היצירה המאוחר ביותר ברשימה (ISO), או null לרשימה ריקה. */
export function latestCreated(leads: Lead[]): string | null {
  let best: Lead | null = null;
  for (const l of leads) if (!best || time(l.createdTime) > time(best.createdTime)) best = l;
  return best ? best.createdTime : null;
}

/** לידים שנוצרו אחרי `since`, מהחדש לישן. מזהים ב-`ignore` (לידים שנוצרו ידנית בדאשבורד) לא נכללים. */
export function findNewLeads(leads: Lead[], since: string | null, ignore: ReadonlySet<string> = new Set()): Lead[] {
  if (!since) return [];
  const from = time(since);
  return leads
    .filter((l) => time(l.createdTime) > from && !ignore.has(l.id))
    .sort((a, b) => time(b.createdTime) - time(a.createdTime));
}
