import { Bot, Check, Copy, KeyRound, Loader2, LogOut, MessageCircle, PenLine, Search, Send, Settings, Square, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getClaudeKey, isClaudeKey, setClaudeKey } from '../../agent/keys';
import { draftOpeningMessage, summarizeLead } from '../../agent/fallback';
import { computeMetrics } from '../../lib/metrics';
import { formatPhone, whatsappLink } from '../../lib/phone';
import { statusDef } from '../../lib/status';
import type { Lead, LeadPatch, MessageTemplate, StatusId } from '../../types';
import { Button, StatusBadge, inputClass } from '../ui';

/**
 * "עוזר הלידים" – אייקון צף + חלון צ'אט (agent/SPEC.md).
 * הטריגר: ליד חדש מהאוטומציה → "נכנס ליד חדש – מה תרצה שאעשה?" + 3 אפשרויות.
 */

const NEXT_STATUS: StatusId = 'sent_intro';

/** ה-SDK של Claude נטען רק כשצריך אותו. */
const loadAi = () => import('../../agent/claude');

type Msg =
  | { id: number; kind: 'text'; from: 'agent' | 'user'; text: string }
  | { id: number; kind: 'newLead'; leadId: string }
  | { id: number; kind: 'draft'; leadId: string; text: string; ai: boolean }
  | { id: number; kind: 'approval'; leadId: string; before: StatusId | null; patch: LeadPatch; state: 'pending' | 'approved' | 'rejected' }
  | { id: number; kind: 'quick' };

let seq = 0;
const nextId = () => ++seq;

const stamp = () => new Date().toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** צליל עדין קצר כשנכנס ליד (בלי קבצים חיצוניים). */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.12);
      o.stop(ctx.currentTime + i * 0.12 + 0.55);
    });
  } catch {
    /* אין שמע – לא חשוב */
  }
}

export function AgentWidget({
  leads,
  templates,
  pending,
  onSeen,
  onUpdate,
  onOpenLead,
}: {
  leads: Lead[];
  templates: MessageTemplate[];
  pending: Lead[];
  onSeen: () => void;
  onUpdate: (id: string, patch: LeadPatch) => void;
  onOpenLead: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    { id: nextId(), kind: 'text', from: 'agent', text: 'היי! אני עוזר הלידים 👋\nכשנכנס ליד חדש מהמייל אודיע לך כאן ואציע מה לעשות. אפשר גם לשאול אותי שאלות על הלידים.' },
    { id: nextId(), kind: 'quick' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState(() => Boolean(getClaudeKey()));
  const [settings, setSettings] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const push = useCallback((...m: Msg[]) => setMsgs((prev) => [...prev, ...m]), []);
  const say = useCallback((text: string, from: 'agent' | 'user' = 'agent') => push({ id: nextId(), kind: 'text', from, text }), [push]);

  // ── הטריגר: ליד חדש ──
  useEffect(() => {
    if (!pending.length) return;
    push(...[...pending].reverse().map((l) => ({ id: nextId(), kind: 'newLead' as const, leadId: l.id })));
    onSeen();
    setUnread((n) => n + pending.length);
    chime();
  }, [pending, push, onSeen]);

  // כותרת הלשונית מראה כמה לידים חדשים מחכים
  useEffect(() => {
    const base = 'ניהול לידים';
    document.title = unread && !open ? `(${unread}) ליד חדש · ${base}` : base;
  }, [unread, open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy]);

  const toggle = () => {
    setOpen((o) => !o);
    setUnread(0);
  };

  /** מריץ פעולה עם AI אם יש מפתח, ואם לא (או אם נכשלה) – את הגרסה הבסיסית. */
  const run = async <T,>(ai: (signal: AbortSignal) => Promise<T>, basic: () => T): Promise<{ value: T; ai: boolean }> => {
    if (!getClaudeKey()) return { value: basic(), ai: false };
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(true);
    try {
      return { value: await ai(ctrl.signal), ai: true };
    } catch (e) {
      if (ctrl.signal.aborted) throw e;
      say(`⚠️ לא הצלחתי להגיע ל-Claude (${e instanceof Error ? e.message : e}) – הנה גרסה בסיסית.`);
      return { value: basic(), ai: false };
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  // ── 3 האפשרויות ──
  const draft = async (lead: Lead) => {
    say('✍️ נסח הודעת וואטסאפ', 'user');
    try {
      const r = await run(async (s) => (await loadAi()).aiDraftMessage(lead, templates, s), () => draftOpeningMessage(lead, templates));
      push({ id: nextId(), kind: 'draft', leadId: lead.id, text: r.value, ai: r.ai });
    } catch {
      say('עצרתי.');
    }
  };

  const summarize = async (lead: Lead) => {
    say('🔎 סכם והמלץ על צעד הבא', 'user');
    try {
      const r = await run(async (s) => (await loadAi()).aiSummarize(lead, s), () => summarizeLead(lead));
      say(r.value);
    } catch {
      say('עצרתי.');
    }
  };

  const proposeStatus = (lead: Lead) => {
    say(`✅ עדכן סטטוס ל"${statusDef(NEXT_STATUS).label}"`, 'user');
    if (lead.status === NEXT_STATUS) {
      say(`הסטטוס כבר "${statusDef(NEXT_STATUS).label}" – אין מה לעדכן.`);
      return;
    }
    const patch: LeadPatch = { status: NEXT_STATUS };
    if (!lead.firstAttempt) patch.firstAttempt = `[${stamp()}] נשלחה הודעת פתיחה בוואטסאפ`;
    push({ id: nextId(), kind: 'approval', leadId: lead.id, before: lead.status, patch, state: 'pending' });
  };

  const decide = (msgId: number, approve: boolean) => {
    setMsgs((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || m.kind !== 'approval' || m.state !== 'pending') return m;
        if (approve) onUpdate(m.leadId, m.patch);
        return { ...m, state: approve ? 'approved' : 'rejected' };
      }),
    );
    say(approve ? 'עודכן ✓' : 'בסדר, לא שיניתי כלום.');
  };

  // ── יכולת א' בלי AI: תמונת מצב מהירה ──
  const status = () => {
    say('📊 מה המצב היום?', 'user');
    const m = computeMetrics(leads);
    const today = leads.filter((l) => Date.now() - Date.parse(l.createdTime) < 86_400_000).length;
    say(`סה"כ ${m.total} לידים · ${today} נכנסו ב-24 השעות האחרונות.\n🔥 חמים: ${m.hot}\n⏳ לא עודכנו מעל 3 ימים: ${m.stale}\n✅ נסגרו: ${m.byStage.won}`);
  };

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    say(q, 'user');
    if (!getClaudeKey()) {
      say('כדי לענות על שאלות חופשיות אני צריך חיבור ל-Claude (⚙️ למעלה). בינתיים אפשר להשתמש בכפתורים 👇');
      push({ id: nextId(), kind: 'quick' });
      return;
    }
    try {
      const r = await run(async (s) => (await loadAi()).aiAnswer(q, leads, s), () => '');
      if (r.value) say(r.value);
    } catch {
      say('עצרתי.');
    }
  };

  const saveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isClaudeKey(keyDraft)) return;
    setClaudeKey(keyDraft);
    setKeyDraft('');
    setHasKey(true);
    setSettings(false);
    say('מחובר ל-Claude ✨ עכשיו אני מנסח הודעות אישיות ועונה על שאלות חופשיות.');
  };

  const disconnect = () => {
    setClaudeKey(null);
    setHasKey(false);
    say('נותקתי מ-Claude. אמשיך במצב בסיסי (תבניות וסיכום אוטומטי).');
  };

  // ── תצוגה ──
  const leadCard = (lead: Lead | undefined, m: Extract<Msg, { kind: 'newLead' }>) =>
    !lead ? (
      <p className="text-sm text-[var(--muted)]">הליד כבר לא קיים.</p>
    ) : (
      <div className="space-y-2">
        <p className="font-semibold">🔔 נכנס ליד חדש!</p>
        <div className="rounded-lg bg-[var(--page)] p-2.5 text-sm ring-1 ring-[var(--border)]">
          <div className="flex items-center justify-between gap-2">
            <b className="truncate">{lead.name || 'ללא שם'}</b>
            <StatusBadge status={lead.status} />
          </div>
          {lead.phone && <div dir="ltr" className="text-end tabular-nums text-[var(--ink-2)]">{formatPhone(lead.phone)}</div>}
          {lead.notes && <p className="mt-1 line-clamp-3 text-[var(--ink-2)]">{lead.notes}</p>}
          <button className="mt-1 text-xs text-blue-600 hover:underline dark:text-blue-400" onClick={() => onOpenLead(lead.id)}>
            פתח כרטיס ליד
          </button>
        </div>
        <p className="text-sm">מה תרצה שאעשה?</p>
        <div className="grid gap-1.5" key={m.id}>
          <Button className="justify-start" onClick={() => draft(lead)} disabled={busy}><PenLine size={15} /> נסח הודעת וואטסאפ ראשונה</Button>
          <Button className="justify-start" onClick={() => summarize(lead)} disabled={busy}><Search size={15} /> סכם את הליד והמלץ על צעד הבא</Button>
          <Button className="justify-start" onClick={() => proposeStatus(lead)} disabled={busy}><Check size={15} /> עדכן סטטוס: {statusDef(NEXT_STATUS).label}</Button>
        </div>
      </div>
    );

  const render = (m: Msg) => {
    switch (m.kind) {
      case 'text':
        return <p className="whitespace-pre-line text-sm">{m.text}</p>;
      case 'quick':
        return (
          <div className="flex flex-wrap gap-1.5">
            <Button className="!px-2.5 !py-1.5 text-xs" onClick={status}>📊 מה המצב היום?</Button>
            {leads.length > 0 && (
              <Button className="!px-2.5 !py-1.5 text-xs" onClick={() => push({ id: nextId(), kind: 'newLead', leadId: [...leads].sort((a, b) => Date.parse(b.createdTime) - Date.parse(a.createdTime))[0].id })}>
                🆕 הליד האחרון
              </Button>
            )}
          </div>
        );
      case 'newLead':
        return leadCard(byId.get(m.leadId), m);
      case 'draft': {
        const lead = byId.get(m.leadId);
        const wa = lead ? whatsappLink(lead.phone, m.text) : null;
        return (
          <div className="space-y-2">
            <p className="text-sm">טיוטה{m.ai ? ' (Claude ✨)' : ''} – אפשר לערוך לפני השליחה:</p>
            <textarea
              className={`${inputClass} min-h-28`}
              value={m.text}
              aria-label="טיוטת הודעה"
              onChange={(e) => setMsgs((prev) => prev.map((x) => (x.id === m.id && x.kind === 'draft' ? { ...x, text: e.target.value } : x)))}
            />
            <div className="flex flex-wrap gap-1.5">
              {wa ? (
                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
                  <MessageCircle size={15} /> פתח בוואטסאפ
                </a>
              ) : (
                <span className="text-xs text-[var(--muted)]">אין מספר טלפון תקין – העתק ושלח במייל.</span>
              )}
              <Button onClick={() => navigator.clipboard?.writeText(m.text)}><Copy size={15} /> העתק</Button>
            </div>
            <p className="text-xs text-[var(--muted)]">ההודעה לא נשלחת אוטומטית – אתה לוחץ "שלח" בוואטסאפ.</p>
          </div>
        );
      }
      case 'approval': {
        const lead = byId.get(m.leadId);
        return (
          <div className="space-y-2 text-sm">
            <p className="font-medium">אישור עדכון – {lead?.name || 'ליד'}</p>
            <div className="rounded-lg bg-[var(--page)] p-2.5 ring-1 ring-[var(--border)]">
              <div className="flex flex-wrap items-center gap-1.5">
                סטטוס: <StatusBadge status={m.before} /> ← <StatusBadge status={m.patch.status ?? null} />
              </div>
              {m.patch.firstAttempt && <p className="mt-1">ניסיון ראשון: {m.patch.firstAttempt}</p>}
            </div>
            {m.state === 'pending' ? (
              <div className="flex gap-1.5">
                <Button variant="primary" onClick={() => decide(m.id, true)}><Check size={15} /> אשר</Button>
                <Button onClick={() => decide(m.id, false)}><X size={15} /> בטל</Button>
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">{m.state === 'approved' ? '✓ אושר' : '✗ בוטל'}</p>
            )}
          </div>
        );
      }
    }
  };

  return (
    <>
      {/* בועת הודעה ליד האייקון כשהחלון סגור */}
      {!open && unread > 0 && (
        <button
          onClick={toggle}
          className="fixed bottom-24 end-5 z-40 max-w-64 animate-[agent-pop_.35s_ease-out] rounded-2xl rounded-ee-sm bg-[var(--surface)] px-3.5 py-2.5 text-start text-sm shadow-lg ring-1 ring-[var(--border)]"
        >
          🔔 <b>נכנס ליד חדש!</b>
          <br />
          <span className="text-[var(--ink-2)]">מה תרצה שאעשה?</span>
        </button>
      )}

      {/* האייקון הצף */}
      <button
        onClick={toggle}
        aria-label={open ? 'סגירת עוזר הלידים' : 'פתיחת עוזר הלידים'}
        aria-expanded={open}
        className={`fixed bottom-5 end-5 z-40 grid size-14 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-xl ring-4 ring-white/60 transition hover:scale-105 dark:ring-black/40 ${unread && !open ? 'animate-[agent-ring_1.6s_ease-in-out_infinite]' : ''}`}
      >
        {open ? <X size={24} /> : <Bot size={26} />}
        {unread > 0 && !open && (
          <span className="absolute -top-1 -start-1 grid size-6 place-items-center rounded-full bg-red-600 text-xs font-bold ring-2 ring-white">{unread}</span>
        )}
      </button>

      {/* חלון הצ'אט */}
      {open && (
        <section
          role="dialog"
          aria-label="עוזר הלידים"
          className="fixed bottom-24 end-5 z-40 flex h-[min(620px,calc(100dvh-8rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-2xl ring-1 ring-[var(--border)]"
        >
          <header className="flex items-center gap-2.5 bg-gradient-to-l from-violet-600 to-blue-600 px-4 py-3 text-white">
            <div className="grid size-9 place-items-center rounded-full bg-white/20"><Bot size={20} /></div>
            <div className="me-auto leading-tight">
              <h2 className="font-semibold">עוזר הלידים</h2>
              <p className="text-xs text-white/80">{hasKey ? 'מחובר ל-Claude ✨' : 'מצב בסיסי · חבר Claude לתשובות חכמות'}</p>
            </div>
            <button onClick={() => setSettings((s) => !s)} aria-label="הגדרות הסוכן" className="rounded-lg p-1.5 hover:bg-white/15"><Settings size={18} /></button>
            <button onClick={toggle} aria-label="סגירה" className="rounded-lg p-1.5 hover:bg-white/15"><X size={18} /></button>
          </header>

          {settings && (
            <div className="space-y-2 border-b border-[var(--grid)] p-3 text-sm">
              {hasKey ? (
                <Button onClick={disconnect}><LogOut size={15} /> ניתוק מ-Claude</Button>
              ) : (
                <form onSubmit={saveKey} className="space-y-2">
                  <label className="block text-xs text-[var(--ink-2)]" htmlFor="claude-key">מפתח Claude API (נשמר רק בדפדפן הזה)</label>
                  <div className="flex gap-1.5">
                    <input id="claude-key" dir="ltr" type="password" className={inputClass} placeholder="sk-ant-..." value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
                    <Button variant="primary" type="submit" disabled={!isClaudeKey(keyDraft)}><KeyRound size={15} /> חבר</Button>
                  </div>
                  <p className="text-xs text-[var(--muted)]">מומלץ מפתח ייעודי עם מגבלת הוצאה חודשית בקונסולה של Anthropic.</p>
                </form>
              )}
            </div>
          )}

          <div ref={listRef} aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-[var(--page)] p-3">
            {msgs.map((m) => {
              const mine = m.kind === 'text' && m.from === 'user';
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3 py-2 ${mine ? 'rounded-ss-sm bg-blue-600 text-white' : 'rounded-se-sm bg-[var(--surface)] ring-1 ring-[var(--border)]'}`}>
                    {render(m)}
                  </div>
                </div>
              );
            })}
            {busy && (
              <div className="flex items-center justify-end gap-2 text-sm text-[var(--muted)]">
                <Loader2 size={15} className="animate-spin" /> חושב...
                <button onClick={() => abortRef.current?.abort()} className="inline-flex items-center gap-1 rounded px-1.5 hover:bg-stone-200 dark:hover:bg-stone-800"><Square size={12} /> עצור</button>
              </div>
            )}
          </div>

          <form onSubmit={ask} className="flex gap-1.5 border-t border-[var(--grid)] p-2.5">
            <input className={inputClass} placeholder={hasKey ? 'שאל אותי על הלידים...' : 'שאלה חופשית (דורש חיבור Claude)'} value={input} onChange={(e) => setInput(e.target.value)} aria-label="הודעה לעוזר" />
            <Button variant="primary" type="submit" disabled={busy || !input.trim()} aria-label="שליחה"><Send size={16} /></Button>
          </form>
        </section>
      )}
    </>
  );
}
