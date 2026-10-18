import { AIRTABLE, AIRTABLE_PROXY, getBrowserToken } from '../config';
import type { Lead, LeadPatch, MessageTemplate } from '../types';
import { statusFromAirtable, statusToAirtable } from './status';

// בפיתוח: דרך הפרוקסי /api/airtable (vite.config.ts), שמוסיף את הטוקן בצד השרת.
// באתר הסטטי: ישירות ל-Airtable (תומך CORS) עם הטוקן שהוזן בדפדפן.
const PROXY_API = '/api/airtable';
const DIRECT_API = 'https://api.airtable.com/v0';
const F = AIRTABLE.leads.fields;
const T = AIRTABLE.templates.fields;

type Fields = Record<string, unknown>;
interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Fields;
}

export class AirtableError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = AIRTABLE_PROXY ? null : getBrowserToken();
  const api = AIRTABLE_PROXY ? PROXY_API : DIRECT_API;
  const res = await fetch(`${api}/${AIRTABLE.baseId}/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  });
  if (!res.ok) {
    let msg = `Airtable ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.error?.message ?? body?.error?.type ?? msg;
    } catch {
      /* גוף לא JSON */
    }
    throw new AirtableError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

/** שולף את כל הרשומות (Airtable מחזיר עד 100 בעמוד, ממשיכים עם offset). */
async function listAll(tableId: string, params: Record<string, string> = {}): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const qs = new URLSearchParams({ pageSize: '100', returnFieldsByFieldId: 'true', ...params });
    if (offset) qs.set('offset', offset);
    const page = await request<{ records: AirtableRecord[]; offset?: string }>(`${tableId}?${qs}`);
    out.push(...page.records);
    offset = page.offset;
  } while (offset);
  return out;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

export function recordToLead(r: AirtableRecord): Lead {
  const f = r.fields;
  return {
    id: r.id,
    phone: str(f[F.phone]),
    name: str(f[F.name]),
    firstAttempt: str(f[F.firstAttempt]),
    secondAttempt: str(f[F.secondAttempt]),
    lastUpdate: str(f[F.lastUpdate]),
    status: statusFromAirtable(f[F.status]),
    notes: str(f[F.notes]),
    createdTime: r.createdTime,
  };
}

export function patchToFields(patch: LeadPatch): Fields {
  const out: Fields = {};
  if ('phone' in patch) out[F.phone] = patch.phone;
  if ('name' in patch) out[F.name] = patch.name;
  if ('firstAttempt' in patch) out[F.firstAttempt] = patch.firstAttempt;
  if ('secondAttempt' in patch) out[F.secondAttempt] = patch.secondAttempt;
  if ('lastUpdate' in patch) out[F.lastUpdate] = patch.lastUpdate;
  if ('notes' in patch) out[F.notes] = patch.notes;
  if ('status' in patch) out[F.status] = statusToAirtable(patch.status ?? null);
  return out;
}

export async function fetchLeads(): Promise<Lead[]> {
  const records = await listAll(AIRTABLE.leads.tableId, { view: AIRTABLE.leads.viewId });
  return records.map(recordToLead);
}

export async function updateLead(id: string, patch: LeadPatch): Promise<Lead> {
  const r = await request<AirtableRecord>(`${AIRTABLE.leads.tableId}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: patchToFields(patch), returnFieldsByFieldId: true, typecast: true }),
  });
  return recordToLead(r);
}

export async function createLead(patch: LeadPatch): Promise<Lead> {
  const res = await request<{ records: AirtableRecord[] }>(AIRTABLE.leads.tableId, {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields: patchToFields(patch) }], returnFieldsByFieldId: true, typecast: true }),
  });
  return recordToLead(res.records[0]);
}

export async function fetchTemplates(): Promise<MessageTemplate[]> {
  const records = await listAll(AIRTABLE.templates.tableId);
  return records.map((r) => ({
    id: r.id,
    leadType: str(r.fields[T.leadType]),
    goal: str(r.fields[T.goal]),
    stageA: str(r.fields[T.stageA]),
    stageB: str(r.fields[T.stageB]),
    extra: str(r.fields[T.extra]),
  }));
}
