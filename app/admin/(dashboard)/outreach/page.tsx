'use client';

import { useEffect, useMemo, useState } from 'react';

// ─── Types (mirror lib/crm) ─────────────────────────────────────────────────
type Stage = 'new' | 'researching' | 'contacts' | 'drafted' | 'sent' | 'replied' | 'won' | 'passed';
interface Contact { id: string; name: string; title: string; email: string; kind: 'named' | 'role'; verified: boolean; region?: string; linkedin?: string; note?: string; }
interface Draft { subject: string; body: string; contactId?: string; updatedAt: number; }
interface Brand { id: string; name: string; domain: string; category: string; tier: 'A' | 'B' | 'C'; region: string; fit: string; stage: Stage; contacts: Contact[]; draft?: Draft; notes?: string; updatedAt: number; }

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: 'new', label: 'New', color: '#64748b' },
  { key: 'researching', label: 'Researching', color: '#0ea5e9' },
  { key: 'contacts', label: 'Contacts', color: '#6366f1' },
  { key: 'drafted', label: 'Drafted', color: '#a855f7' },
  { key: 'sent', label: 'Sent', color: '#f59e0b' },
  { key: 'replied', label: 'Replied', color: '#10b981' },
  { key: 'won', label: 'Won', color: '#16a34a' },
  { key: 'passed', label: 'Passed', color: '#94a3b8' },
];
const stageMeta = (s: Stage) => STAGES.find(x => x.key === s) || STAGES[0];
const TIER_COLOR: Record<string, string> = { A: '#16a34a', B: '#f59e0b', C: '#94a3b8' };

// ─── Email link helpers (draft → open in the user's mail client) ─────────────
function gmailUrl(to: string, subject: string, body: string) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
function mailtoUrl(to: string, subject: string, body: string) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function OutreachPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [tier, setTier] = useState('all');
  const [stage, setStage] = useState<'all' | Stage>('all');
  const [selId, setSelId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/outreach')
      .then(r => r.json())
      .then(d => setBrands(d.brands || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const patchBrand = (b: Brand) => setBrands(prev => prev.map(x => (x.id === b.id ? b : x)));

  const categories = useMemo(() => Array.from(new Set(brands.map(b => b.category))).sort(), [brands]);
  const stageCounts = useMemo(() => {
    const m: Record<string, number> = {};
    brands.forEach(b => { m[b.stage] = (m[b.stage] || 0) + 1; });
    return m;
  }, [brands]);

  const filtered = useMemo(() => brands.filter(b =>
    (cat === 'all' || b.category === cat) &&
    (tier === 'all' || b.tier === tier) &&
    (stage === 'all' || b.stage === stage) &&
    (!q || b.name.toLowerCase().includes(q.toLowerCase()) || b.category.toLowerCase().includes(q.toLowerCase()))
  ), [brands, cat, tier, stage, q]);

  const sel = brands.find(b => b.id === selId) || null;

  async function setStageFor(id: string, s: Stage) {
    const r = await fetch('/api/admin/outreach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateStage', id, stage: s }) });
    const d = await r.json(); if (d.brand) patchBrand(d.brand);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brand Outreach</h1>
          <p className="text-gray-400 text-sm mt-1">{brands.length} target brands · prospect → contact → draft → send. Monetise the channel.</p>
        </div>
        <div className="flex items-center gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search brands…" className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 w-48 focus:outline-none focus:ring-2 focus:ring-violet-300" />
        </div>
      </div>

      {/* Pipeline summary */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setStage('all')} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${stage === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>All {brands.length}</button>
        {STAGES.map(s => (
          <button key={s.key} onClick={() => setStage(stage === s.key ? 'all' : s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${stage === s.key ? 'text-white' : 'bg-white hover:border-gray-300'}`}
            style={stage === s.key ? { background: s.color, borderColor: s.color } : { color: s.color, borderColor: '#e5e7eb' }}>
            {s.label} {stageCounts[s.key] || 0}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <select value={cat} onChange={e => setCat(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700">
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={tier} onChange={e => setTier(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700">
          <option value="all">All tiers</option>
          <option value="A">Tier A — top fit</option>
          <option value="B">Tier B — strong</option>
          <option value="C">Tier C — opportunistic</option>
        </select>
        <span className="text-gray-400 text-xs ml-auto">{filtered.length} shown</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-gray-400 py-20 text-sm">Loading brands…</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 font-semibold">Brand</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Tier</th>
                <th className="px-4 py-3 font-semibold">Region</th>
                <th className="px-4 py-3 font-semibold">Contacts</th>
                <th className="px-4 py-3 font-semibold">Stage</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const sm = stageMeta(b.stage);
                return (
                  <tr key={b.id} onClick={() => setSelId(b.id)} className="border-b border-gray-50 hover:bg-violet-50/40 cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{b.name}</div>
                      <div className="text-gray-400 text-xs">{b.domain}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{b.category}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: TIER_COLOR[b.tier] }}>{b.tier}</span></td>
                    <td className="px-4 py-3 text-gray-500">{b.region}</td>
                    <td className="px-4 py-3 text-gray-500">{b.contacts.length || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: sm.color }}>{sm.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <div className="text-center text-gray-400 py-16 text-sm">No brands match these filters.</div>}
        </div>
      )}

      {sel && <Drawer brand={sel} onClose={() => setSelId(null)} onPatch={patchBrand} onStage={setStageFor} />}
    </div>
  );
}

// ─── Detail drawer ───────────────────────────────────────────────────────────
function Drawer({ brand, onClose, onPatch, onStage }: {
  brand: Brand; onClose: () => void; onPatch: (b: Brand) => void; onStage: (id: string, s: Stage) => void;
}) {
  const [finding, setFinding] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [notes, setNotes] = useState(brand.notes || '');
  const [subject, setSubject] = useState(brand.draft?.subject || '');
  const [body, setBody] = useState(brand.draft?.body || '');
  const [activeContact, setActiveContact] = useState<string | undefined>(brand.draft?.contactId || brand.contacts[0]?.id);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setNotes(brand.notes || '');
    setSubject(brand.draft?.subject || '');
    setBody(brand.draft?.body || '');
    setActiveContact(brand.draft?.contactId || brand.contacts[0]?.id);
  }, [brand.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const to = brand.contacts.find(c => c.id === activeContact)?.email || brand.contacts[0]?.email || `partnerships@${brand.domain}`;

  async function findContacts() {
    setFinding(true);
    try {
      const r = await fetch('/api/admin/outreach/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: brand.id }) });
      const d = await r.json();
      if (d.brand) { onPatch(d.brand); setActiveContact(d.brand.contacts[0]?.id); }
    } finally { setFinding(false); }
  }

  async function draftEmail() {
    setDrafting(true);
    try {
      const r = await fetch('/api/admin/outreach/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: brand.id, contactId: activeContact }) });
      const d = await r.json();
      if (d.brand?.draft) { onPatch(d.brand); setSubject(d.brand.draft.subject); setBody(d.brand.draft.body); }
    } finally { setDrafting(false); }
  }

  async function saveNotes() {
    const r = await fetch('/api/admin/outreach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateNotes', id: brand.id, notes }) });
    const d = await r.json(); if (d.brand) onPatch(d.brand);
  }

  const sm = stageMeta(brand.stage);

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{brand.name}</h2>
              <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: TIER_COLOR[brand.tier] }}>Tier {brand.tier}</span>
            </div>
            <a href={`https://${brand.domain}`} target="_blank" rel="noreferrer" className="text-violet-600 text-xs hover:underline">{brand.domain} ↗</a>
            <span className="text-gray-400 text-xs"> · {brand.category} · {brand.region}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Fit */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase mb-1">Why this brand fits</div>
            <p className="text-sm text-gray-700">{brand.fit}</p>
          </div>

          {/* Stage */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Pipeline stage</div>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map(s => (
                <button key={s.key} onClick={() => onStage(brand.id, s.key)}
                  className="px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors"
                  style={brand.stage === s.key ? { background: s.color, borderColor: s.color, color: '#fff' } : { color: s.color, borderColor: '#e5e7eb' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Contacts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-400 uppercase">Contacts</div>
              <button onClick={findContacts} disabled={finding} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                {finding ? 'Scanning…' : brand.contacts.length ? '↻ Re-scan contacts' : '🔍 Find contacts'}
              </button>
            </div>
            {!brand.contacts.length ? (
              <p className="text-sm text-gray-400">No contacts yet. Scan to surface partnership contacts + role inboxes.</p>
            ) : (
              <div className="space-y-2">
                {brand.contacts.map(c => (
                  <div key={c.id} onClick={() => setActiveContact(c.id)}
                    className={`p-3 rounded-lg border cursor-pointer ${activeContact === c.id ? 'border-violet-400 bg-violet-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm text-gray-900">{c.name}</div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.kind === 'named' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{c.kind === 'named' ? 'NAMED' : 'ROLE'}</span>
                    </div>
                    <div className="text-xs text-gray-500">{c.title}{c.region ? ` · ${c.region}` : ''}</div>
                    <div className="text-xs text-violet-600 mt-0.5">{c.email}</div>
                    {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[11px] text-blue-600 hover:underline">LinkedIn ↗</a>}
                    {c.note && <div className="text-[11px] text-amber-600 mt-0.5">⚠ {c.note}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Draft email */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-400 uppercase">Outreach email</div>
              <button onClick={draftEmail} disabled={drafting} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                {drafting ? 'Writing…' : brand.draft ? '↻ Re-draft' : '✍️ Draft email'}
              </button>
            </div>
            {(subject || body) ? (
              <div className="space-y-2">
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-900 font-medium" />
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={12} className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-700 leading-relaxed resize-y" />
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={gmailUrl(to, subject, body)} target="_blank" rel="noreferrer" onClick={() => onStage(brand.id, 'sent')} className="text-xs font-semibold px-3 py-2 rounded-lg text-white" style={{ background: '#ea4335' }}>✉ Open in Gmail</a>
                  <a href={mailtoUrl(to, subject, body)} onClick={() => onStage(brand.id, 'sent')} className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Open in Mail app</a>
                  <button onClick={() => { navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">{copied ? 'Copied ✓' : 'Copy'}</button>
                  <span className="text-[11px] text-gray-400">→ {to}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No draft yet. {brand.contacts.length ? 'Draft a personalised pitch using your media-kit stats + past brand work.' : 'Find a contact first, then draft.'}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">Notes</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} rows={3} placeholder="Deal terms, follow-up dates, who replied…" className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-700 resize-y" />
          </div>
        </div>
      </div>
    </div>
  );
}
