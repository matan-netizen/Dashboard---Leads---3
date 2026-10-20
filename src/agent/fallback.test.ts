import { describe, expect, it } from 'vitest';
import { DEMO_TEMPLATES } from '../data/demo';
import type { Lead, MessageTemplate } from '../types';
import { draftOpeningMessage, firstName, pickOpeningTemplate, summarizeLead } from './fallback';
import { leadLine } from './claude';

const NOW = Date.parse('2026-10-18T12:00:00Z');
const lead = (p: Partial<Lead>): Lead => ({
  id: 'recTEST000000001', phone: '050-000-1111', name: 'דנה כהן', firstAttempt: '', secondAttempt: '', lastUpdate: '',
  notes: 'מבקשת הצעת מחיר לקידום אורגני', status: null, createdTime: '2026-10-18T11:00:00Z', ...p,
});

describe('firstName', () => {
  it('takes the first Hebrew word', () => expect(firstName('דנה כהן')).toBe('דנה'));
  it('skips names that look like platforms', () => expect(firstName('LinkedIn')).toBe(''));
  it('handles empty names', () => expect(firstName('  ')).toBe(''));
});

describe('pickOpeningTemplate', () => {
  const opening: MessageTemplate = { id: 'o', leadType: 'הודעת פתיחה', goal: '', stageA: 'שלום, ראיתי את הפנייה', stageB: '', extra: '' };
  it('prefers an opening template', () => expect(pickOpeningTemplate(lead({}), [...DEMO_TEMPLATES, opening])?.id).toBe('o'));
  it('falls back to the status template', () =>
    expect(pickOpeningTemplate(lead({ status: 'sent_intro' }), DEMO_TEMPLATES)?.leadType).toBe('קיבל פניה ולא הגיב'));
  it('returns null when nothing fits', () => expect(pickOpeningTemplate(lead({}), [])).toBeNull());
});

describe('draftOpeningMessage', () => {
  it('greets by first name and asks for a call', () => {
    const t = draftOpeningMessage(lead({}), []);
    expect(t.startsWith('היי דנה,')).toBe(true);
    expect(t).toContain('שיחה');
  });
  it('appends a signature', () => expect(draftOpeningMessage(lead({}), [], 'מתן')).toMatch(/מתן$/));
});

describe('summarizeLead', () => {
  it('includes notes, next step and relative time', () => {
    const s = summarizeLead(lead({}), NOW);
    expect(s).toContain('מבקשת הצעת מחיר');
    expect(s).toContain('הצעד הבא');
    expect(s).toContain('היום');
  });
  it('warns when there is no phone', () => expect(summarizeLead(lead({ phone: '' }), NOW)).toContain('אין מספר טלפון'));
});

describe('leadLine', () => {
  it('is compact and labels the fields', () => {
    const line = leadLine(lead({}), NOW);
    expect(line).toContain('id=recTEST000000001');
    expect(line).toContain('שלב=פנייה ראשונית');
    expect(line).not.toContain('\n');
  });
});
