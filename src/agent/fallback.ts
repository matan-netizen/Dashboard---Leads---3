import { formatPhone } from '../lib/phone';
import { relativeDays } from '../lib/metrics';
import { stageDef, stageOf, statusDef } from '../lib/status';
import type { Lead, MessageTemplate } from '../types';

/**
 * יכולות הסוכן בלי מודל AI (כשאין מפתח Claude, או כשהקריאה נכשלה).
 * פונקציות טהורות – נבדקות ב-fallback.test.ts.
 */

const templateText = (t: MessageTemplate) => [t.stageA, t.stageB, t.extra].filter(Boolean).join('\n\n');

/** שם פרטי לפנייה. שם שנראה כמו שם עסק/פלטפורמה (באנגלית או ריק) → בלי שם. */
export function firstName(name: string): string {
  const n = name.trim();
  if (!n || /[A-Za-z]/.test(n)) return '';
  return n.split(/\s+/)[0];
}

/** תבנית פתיחה לליד חדש: תבנית שסוגה מכיל "פתיחה", אחרת זו שמותאמת לסטטוס, אחרת אין. */
export function pickOpeningTemplate(lead: Lead, templates: MessageTemplate[]): MessageTemplate | null {
  const usable = templates.filter((t) => templateText(t));
  const opening = usable.find((t) => /פתיחה/.test(t.leadType));
  if (opening) return opening;
  const type = lead.status ? statusDef(lead.status).templateType : undefined;
  return (type && usable.find((t) => t.leadType === type)) || null;
}

/** טיוטת הודעת וואטסאפ ראשונה. מבוססת תבנית אם יש, אחרת הודעת פתיחה כללית. */
export function draftOpeningMessage(lead: Lead, templates: MessageTemplate[], signature = ''): string {
  const name = firstName(lead.name);
  const hello = name ? `היי ${name},` : 'היי,';
  const tpl = pickOpeningTemplate(lead, templates);
  const body = tpl
    ? templateText(tpl)
    : 'קיבלתי את הפנייה שלך – תודה! אשמח לשמוע קצת יותר על העסק ומה חשוב לך להשיג, ולהציע את הדרך המתאימה.\nמתי נוח לך לשיחה קצרה של 10 דקות?';
  return [hello, body, signature].filter(Boolean).join('\n');
}

/** סיכום ליד + צעד הבא מומלץ, כטקסט קריא. */
export function summarizeLead(lead: Lead, now: number = Date.now()): string {
  const stage = stageOf(lead.status);
  const next = lead.status ? statusDef(lead.status).nextAction : 'לשלוח הודעת פתיחה בוואטסאפ עוד היום – ליד חדש מגיב הכי טוב בשעות הראשונות';
  const lines = [
    `👤 ${lead.name || 'ללא שם'}${lead.phone ? ` · ${formatPhone(lead.phone)}` : ' · אין טלפון'}`,
    `🕒 נכנס ${relativeDays(lead.createdTime, now)} · שלב: ${stageDef(stage).label}${lead.status ? ` (${statusDef(lead.status).label})` : ''}`,
    lead.notes ? `📝 ${lead.notes}` : '📝 אין סיכום פנייה',
    ...[lead.firstAttempt, lead.secondAttempt, lead.lastUpdate].filter(Boolean).map((t) => `↩️ ${t}`),
    `➡️ הצעד הבא: ${next}`,
  ];
  if (!lead.phone) lines.push('⚠️ אין מספר טלפון – כדאי לחזור במייל ולבקש מספר.');
  return lines.join('\n');
}
