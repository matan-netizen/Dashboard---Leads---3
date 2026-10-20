/** מפתח Claude API – נשמר רק ב-localStorage של הדפדפן הזה, לעולם לא בקוד או בריפו. */
const KEY = 'claudeApiKey';

export function getClaudeKey(): string | null {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function setClaudeKey(key: string | null): void {
  try {
    if (key) localStorage.setItem(KEY, key.trim());
    else localStorage.removeItem(KEY);
  } catch {
    /* אחסון חסום */
  }
}

export const isClaudeKey = (k: string) => /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k.trim());
