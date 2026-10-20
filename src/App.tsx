import { Database, Download, KeyRound, LogOut, LayoutDashboard, List, MessageSquareText, Moon, Plus, RefreshCw, Sun, Columns3, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FilterBar } from './components/FilterBar';
import { KanbanBoard } from './components/KanbanBoard';
import { LeadDrawer } from './components/LeadDrawer';
import { LeadsTable } from './components/LeadsTable';
import { NewLeadDialog } from './components/NewLeadDialog';
import { Overview } from './components/Overview';
import { TemplatesView } from './components/TemplatesView';
import { Button } from './components/ui';
import { AIRTABLE, AIRTABLE_PROXY, setBrowserToken } from './config';
import { ConnectDialog } from './components/ConnectDialog';
import { AgentWidget } from './components/agent/AgentWidget';
import { useNewLeadTrigger } from './hooks/useNewLeadTrigger';
import { useLeads } from './hooks/useLeads';
import { useTheme } from './hooks/useTheme';
import { EMPTY_FILTERS, applyFilters, type Filters } from './lib/filters';
import { computeMetrics, toCSV } from './lib/metrics';
import { findDuplicates } from './lib/phone';

type Tab = 'overview' | 'leads' | 'board' | 'templates';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'סקירה', icon: <LayoutDashboard size={16} /> },
  { id: 'leads', label: 'לידים', icon: <List size={16} /> },
  { id: 'board', label: 'לוח', icon: <Columns3 size={16} /> },
  { id: 'templates', label: 'תבניות וואטסאפ', icon: <MessageSquareText size={16} /> },
];

const AIRTABLE_URL = `https://airtable.com/${AIRTABLE.baseId}/${AIRTABLE.leads.tableId}/${AIRTABLE.leads.viewId}`;

export default function App() {
  const data = useLeads();
  const theme = useTheme();
  const trigger = useNewLeadTrigger({ leads: data.leads, source: data.source, loading: data.loading, reload: data.reload });
  const [tab, setTab] = useState<Tab>('overview');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const disconnect = () => {
    setBrowserToken(null);
    window.location.reload();
  };

  const metrics = useMemo(() => computeMetrics(data.leads), [data.leads]);
  const duplicates = useMemo(() => findDuplicates(data.leads), [data.leads]);
  const duplicatePhones = useMemo(() => new Set(duplicates.keys()), [duplicates]);
  const filtered = useMemo(() => applyFilters(data.leads, filters, duplicatePhones), [data.leads, filters, duplicatePhones]);
  const openLead = data.leads.find((l) => l.id === openId);

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCSV(filtered)], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `leads-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] px-4 pb-10 sm:px-6">
      <header className="flex flex-wrap items-center gap-3 py-5">
        <div className="me-auto">
          <h1 className="text-2xl font-bold">ניהול לידים</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <Database size={14} />
            {data.source === 'airtable' ? (
              <a href={AIRTABLE_URL} target="_blank" rel="noreferrer" className="hover:underline">
                מחובר ל-Airtable
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setConnecting(true)}
                className="rounded bg-amber-100 px-1.5 text-amber-900 hover:underline dark:bg-amber-900/50 dark:text-amber-100"
              >
                נתוני דמה – לחצו לחיבור ל-Airtable
              </button>
            )}
            {data.syncedAt && <span>· עודכן {data.syncedAt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>}
          </p>
        </div>
        {data.source === 'airtable' && !AIRTABLE_PROXY ? (
          <Button variant="ghost" onClick={disconnect} aria-label="התנתקות מ-Airtable">
            <LogOut size={16} /> התנתקות
          </Button>
        ) : (
          data.source !== 'airtable' && (
            <Button onClick={() => setConnecting(true)}>
              <KeyRound size={16} /> חיבור ל-Airtable
            </Button>
          )
        )}
        <Button onClick={data.reload} disabled={data.loading} aria-label="רענון נתונים">
          <RefreshCw size={16} className={data.loading ? 'animate-spin' : ''} /> רענון
        </Button>
        <Button onClick={exportCsv} aria-label="ייצוא הלידים המסוננים ל-CSV">
          <Download size={16} /> CSV
        </Button>
        <Button variant="ghost" onClick={theme.toggle} aria-label={theme.dark ? 'מצב בהיר' : 'מצב כהה'}>
          {theme.dark ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> ליד חדש
        </Button>
      </header>

      {data.error && (
        <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-100 dark:ring-red-900">
          {data.error}
          <button onClick={data.dismissError} aria-label="סגירת הודעה"><X size={16} /></button>
        </div>
      )}

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-[var(--grid)]" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${tab === t.id ? 'border-blue-600 text-[var(--ink)] dark:border-blue-400' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      {data.loading && data.leads.length === 0 ? (
        <div className="grid gap-3 md:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-stone-200 dark:bg-stone-800" />)}
        </div>
      ) : (
        <main>
          {tab === 'overview' && (
            <Overview leads={data.leads} metrics={metrics} duplicates={duplicates} onOpen={setOpenId} onFilter={(f) => (setFilters(f), setTab('leads'))} />
          )}
          {(tab === 'leads' || tab === 'board') && (
            <div className="space-y-4">
              <FilterBar f={filters} onChange={setFilters} count={filtered.length} />
              {tab === 'leads' ? (
                <LeadsTable leads={filtered} duplicatePhones={duplicatePhones} onOpen={setOpenId} />
              ) : (
                <KanbanBoard leads={filtered} onOpen={setOpenId} onUpdate={data.update} />
              )}
            </div>
          )}
          {tab === 'templates' && <TemplatesView templates={data.templates} />}
        </main>
      )}

      {openLead && <LeadDrawer key={openLead.id} lead={openLead} templates={data.templates} onClose={() => setOpenId(null)} onSave={data.update} />}
      {creating && (
        <NewLeadDialog
          onClose={() => setCreating(false)}
          onCreate={async (p) => {
            const ok = await data.create(p);
            if (ok) trigger.markSeenNow(); // ליד ידני – לא "ליד חדש מהמייל"
            return ok;
          }}
        />
      )}
      {connecting && <ConnectDialog onClose={() => setConnecting(false)} onConnected={data.reload} />}
      <AgentWidget leads={data.leads} templates={data.templates} pending={trigger.pending} onSeen={trigger.markAllSeen} onUpdate={data.update} onOpenLead={setOpenId} />
    </div>
  );
}
