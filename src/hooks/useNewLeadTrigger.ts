import { useCallback, useEffect, useMemo, useState } from 'react';
import { findNewLeads, latestCreated } from '../lib/newLeads';
import type { DataSource, Lead } from '../types';

const SEEN_KEY = 'agentLastSeenLead';
const POLL_MS = 60_000;

const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};
const writeSeen = (iso: string) => {
  try {
    localStorage.setItem(SEEN_KEY, iso);
  } catch {
    /* אחסון חסום */
  }
};

/** הדגמה: ?agent-demo בכתובת מציג את הליד האחרון כאילו נכנס עכשיו (גם בנתוני דמה). */
const DEMO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('agent-demo');

/**
 * הטריגר של הסוכן: בודק כל דקה אם נכנס ליד חדש מהאוטומציה (Make → Airtable).
 * בפעם הראשונה רק מסמן נקודת ייחוס – לידים ישנים לא מוצגים כ"חדשים".
 */
export function useNewLeadTrigger({ leads, source, loading, reload }: { leads: Lead[]; source: DataSource; loading: boolean; reload: () => void }) {
  const [seen, setSeen] = useState<string | null>(readSeen);
  const [demoShown, setDemoShown] = useState(false);
  const active = source === 'airtable';

  // נקודת ייחוס ראשונה: הליד האחרון שקיים כבר עכשיו.
  useEffect(() => {
    if (!active || loading || seen || !leads.length) return;
    const latest = latestCreated(leads);
    if (latest) {
      writeSeen(latest);
      setSeen(latest);
    }
  }, [active, loading, seen, leads]);

  // בדיקה תקופתית – רק כשהלשונית גלויה.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [active, reload]);

  const pending = useMemo(() => {
    if (DEMO && !demoShown && leads.length) {
      const latest = latestCreated(leads);
      return leads.filter((l) => l.createdTime === latest).slice(0, 1);
    }
    return active ? findNewLeads(leads, seen) : [];
  }, [active, demoShown, leads, seen]);

  /** מסמן שכל הלידים עד עכשיו כבר הוצגו (אחרי שהסוכן הודיע, או אחרי יצירה ידנית). */
  const markAllSeen = useCallback(() => {
    setDemoShown(true);
    const latest = latestCreated(leads);
    if (latest && (!seen || Date.parse(latest) > Date.parse(seen))) {
      writeSeen(latest);
      setSeen(latest);
    }
  }, [leads, seen]);

  /** אחרי יצירת ליד ידנית בדאשבורד – כדי שהסוכן לא יודיע עליו כאילו הגיע מהמייל. */
  const markSeenNow = useCallback(() => {
    const iso = new Date(Date.now() + 5_000).toISOString();
    writeSeen(iso);
    setSeen(iso);
  }, []);

  return { pending, markAllSeen, markSeenNow };
}
