  // מזהי Airtable – מקור הנתונים של הדאשבורד.
// https://airtable.com/app0fHlPfEW2j2Fti/tbluBvD05Y5PrZy1z/viweSepoDyFWqMsNU
export const AIRTABLE = {
  baseId: 'app1gnlGwquesbWLz',
  leads: {
    tableId:  'tblOj9i54fyZZRq84',
    viewId: 'viweSepoDyFWqMsNU',
    fields: {
      phone: 'fldatY6aabyro2QxH', // נייד (שדה ראשי)
      name: 'fld3gkDsopHXERkPz', // שם
      firstAttempt: 'fldyzfJPvnpzR9ODq', // ניסיון ראשון
      secondAttempt: 'fldmOGLXf8saAj6ja', // ניסיון שני
      lastUpdate: 'fldnFNa1q6Sutu3S7', // עדכון אחרון
      status: 'fldUFuQsuxVUTJ6Ds', // סטטוס
      notes: 'fldaNfYdxp6wdu2xq', // הערות / תשלום
    },
  },
  templates: {
    tableId: 'tbl8SI6TZBh5njWAJ',
    fields: {
      leadType: 'fldJDbgKJEtEONNHB', // סוג ליד
      goal: 'fldKEOSfkncvsufWo', // מטרה
      stageA: 'fldSAAj6R93XN9EEk', // הודעה שלב א'
      stageB: 'fld2AhUnH7LzrX8XM', // הודעה שלב ב'
      extra: 'fldHl1S33XJ3KXCPQ', // הודעה נוספת
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
