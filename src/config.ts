// מזהי Airtable – מקור הנתונים של הדאשבורד (בסיס Leads).
// https://airtable.com/app1gnlGwquesbWLz/tblDtDEufknTM9nRq/viwDhazqxYdBrmjLf
export const AIRTABLE = {
  baseId: 'app1gnlGwquesbWLz',
  leads: {
    tableId: 'tblDtDEufknTM9nRq', // לידים
    viewId: 'viwDhazqxYdBrmjLf',
    fields: {
      phone: 'fldLHxUXHC2gA4y9x', // Phone
      name: 'fldIGzRBcKP55LiZa', // Name
      firstAttempt: 'fldKIudhbFQRf0MzN', // ניסיון ראשון
      secondAttempt: 'fldFJtQXsUvbeYGEv', // ניסיון שני
      lastUpdate: 'fld6VWJYEELjSyIgt', // עדכון אחרון
      status: 'fldbnDYos8psUmmlL', // סטטוס
      notes: 'fldwAOWPraFHViM2X', // Summary (סיכום ה-AI מ-Make)
    },
  },
  templates: {
    tableId: 'tblOj9i54fyZZRq84', // הודעות ואצאפ
    fields: {
      leadType: 'fldbe3iddTo4oX12a', // סוג ליד
      goal: 'fld3E2OYAcv4uJ8u1', // מטרה
      stageA: 'fldlcDCqd2vFv1EF1', // הודעה שלב א
      stageB: 'fldyiqtFCfIRCGrnt', // הודעה שלב ב'
      extra: 'flddohg0lcebbLx5O', // הודעה נוספת
    },
  },
} as const;

declare const __AIRTABLE_ENABLED__: boolean;

/** true כשהוגדר AIRTABLE_TOKEN בקובץ .env (שרת הפיתוח) – הבקשות עוברות דרך הפרוקסי. */
export const AIRTABLE_PROXY: boolean =
  typeof __AIRTABLE_ENABLED__ !== 'undefined' && __AIRTABLE_ENABLED__;

// באתר הסטטי (GitHub Pages) אין שרת – הטוקן מוזן פעם אחת בדפדפן ונשמר ב-localStorage בלבד.
// הוא לעולם לא נכנס לקוד או לריפו (הריפו ציבורי).
const TOKEN_KEY = 'airtableToken';

export function getBrowserToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setBrowserToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* אחסון חסום */
  }
}

/** האם יש חיבור ל-Airtable – דרך הפרוקסי או דרך טוקן שהוזן בדפדפן. */
export const airtableEnabled = (): boolean => AIRTABLE_PROXY || Boolean(getBrowserToken());

/** לידים שלא עודכנו יותר מכך נחשבים "ממתינים למעקב". */
export const STALE_AFTER_DAYS = 3;
