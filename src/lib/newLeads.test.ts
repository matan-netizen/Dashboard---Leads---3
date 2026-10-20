import { describe, expect, it } from 'vitest';
import type { Lead } from '../types';
import { findNewLeads, latestCreated } from './newLeads';

const lead = (id: string, createdTime: string): Lead => ({
  id, createdTime, phone: '', name: '', firstAttempt: '', secondAttempt: '', lastUpdate: '', notes: '', status: null,
});

const L = [lead('a', '2026-10-18T08:00:00Z'), lead('b', '2026-10-18T10:00:00Z'), lead('c', '2026-10-18T09:00:00Z')];

describe('latestCreated', () => {
  it('returns the newest createdTime', () => expect(latestCreated(L)).toBe('2026-10-18T10:00:00Z'));
  it('returns null for an empty list', () => expect(latestCreated([])).toBeNull());
});

describe('findNewLeads', () => {
  it('returns leads created after the reference point, newest first', () =>
    expect(findNewLeads(L, '2026-10-18T08:30:00Z').map((l) => l.id)).toEqual(['b', 'c']));
  it('nothing is new without a reference point (first run)', () => expect(findNewLeads(L, null)).toEqual([]));
  it('a lead at exactly the reference time is not new', () => expect(findNewLeads(L, '2026-10-18T10:00:00Z')).toEqual([]));
  it('ignores leads created manually in the dashboard', () =>
    expect(findNewLeads(L, '2026-10-18T07:00:00Z', new Set(['b'])).map((l) => l.id)).toEqual(['c', 'a']));
});
