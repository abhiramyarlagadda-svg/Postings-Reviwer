import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, Search, CheckCircle2, Trash2, X, Calendar, Users, Briefcase, FileText, Maximize2, Download } from 'lucide-react';
import { useAuth } from '@/src/lib/AuthContext';

interface Application {
  id: string;
  candidate_id: string;
  job_id: string;
  status: 'relevant' | 'irrelevant';
  score: number;
  skill_match_score: number;
  experience_score: number;
  location_score: number;
  reasons: string[];
  job_title: string;
  job_company: string;
  job_location: string;
  job_url: string;
  created_at: string;
  candidates?: {
    name: string;
    technology: string;
    country: string;
    experience_years: number;
    resume_url?: string;
  };
}

interface CandidateSummary {
  id: string;
  name: string;
  technology: string;
  country: string;
  total: number;
  relevant: number;
  resume_url?: string;
}

type StatusFilter = 'all' | 'relevant' | 'irrelevant';
type DateFilter = 'all' | 'today' | 'week' | 'month';

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ResumeModal({ name, url, onClose }: { name: string; url: string; onClose: () => void }) {
  const isPdf = url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf');
  const viewerUrl = isPdf ? url : `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="flex-1 flex flex-col m-4 md:m-8 bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-green-100 bg-green-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-700 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-green-500">Resume Preview</p>
              <p className="text-base font-black text-green-900">{name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors">
              <Maximize2 className="w-3 h-3" /> Open Full
            </a>
            <a href={url} download
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors">
              <Download className="w-3 h-3" /> Download
            </a>
            <button onClick={onClose} className="p-2 rounded-lg text-green-400 hover:text-green-800 hover:bg-green-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-gray-100">
          <iframe src={viewerUrl} className="w-full h-full border-0" title={`${name} Resume`} />
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="relative group flex items-center gap-1.5 cursor-default">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-[10px] text-green-500 tabular-nums w-6">{value}%</span>
      <div className="absolute bottom-full left-0 mb-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 shadow-lg">
        {label}: {value}%
        <div className="absolute top-full left-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
      </div>
    </div>
  );
}

export default function ApplicationsView({ onDeleted }: { onDeleted?: () => void }) {
  const { authedFetch } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [resumePreview, setResumePreview] = useState<{ name: string; url: string } | null>(null);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setError('');
    setExpanded(new Set());
    setConfirmingDelete(null);
    try {
      const res = await authedFetch('/api/applications');
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error((data as any).error || 'Failed to fetch'); }
      const data = await res.json();
      setApps(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const deleteOne = async (id: string) => {
    setConfirmingDelete(null);
    setDeletingIds(p => { const n = new Set(p); n.add(id); return n; });
    try {
      const res = await authedFetch(`/api/applications/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setTimeout(() => {
        setApps(p => p.filter(a => a.id !== id));
        setDeletingIds(p => { const n = new Set(p); n.delete(id); return n; });
        showToast('Application deleted');
        onDeleted?.();
      }, 280);
    } catch (e: any) {
      setDeletingIds(p => { const n = new Set(p); n.delete(id); return n; });
      setError(e.message);
    }
  };

  const candidates: CandidateSummary[] = Array.from(
    apps.reduce((map, a) => {
      if (!map.has(a.candidate_id)) {
        map.set(a.candidate_id, {
          id: a.candidate_id,
          name: a.candidates?.name || 'Unknown',
          technology: a.candidates?.technology || '',
          country: a.candidates?.country || '',
          resume_url: a.candidates?.resume_url,
          total: 0, relevant: 0,
        });
      }
      const c = map.get(a.candidate_id)!;
      c.total++;
      if (a.status === 'relevant') c.relevant++;
      return map;
    }, new Map<string, CandidateSummary>()).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const now = new Date();
  const todayStr = localDateStr(now);
  const weekAgoStr = localDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  const monthAgoStr = localDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));

  const candidateApps = selectedId ? apps.filter(a => a.candidate_id === selectedId) : [];

  const filtered = candidateApps.filter(a => {
    if (statusFilter === 'relevant' && a.status !== 'relevant') return false;
    if (statusFilter === 'irrelevant' && a.status !== 'irrelevant') return false;
    if (dateFilter !== 'all' && a.created_at) {
      const d = localDateStr(new Date(a.created_at));
      if (dateFilter === 'today' && d !== todayStr) return false;
      if (dateFilter === 'week' && d < weekAgoStr) return false;
      if (dateFilter === 'month' && d < monthAgoStr) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!(a.job_title || '').toLowerCase().includes(q) &&
          !(a.job_company || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const selected = candidates.find(c => c.id === selectedId);
  const relevantCount = candidateApps.filter(a => a.status === 'relevant').length;
  const irrelevantCount = candidateApps.filter(a => a.status === 'irrelevant').length;
  const matchRate = candidateApps.length > 0 ? Math.round((relevantCount / candidateApps.length) * 100) : 0;

  const dateBtns: { label: string; value: DateFilter }[] = [
    { label: 'All Time', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'Last 7 Days', value: 'week' },
    { label: 'Last 30 Days', value: 'month' },
  ];

  return (
    <div className="flex-1 flex h-full overflow-hidden">

      {/* ── Left Sidebar ── */}
      <aside className="w-72 shrink-0 flex flex-col bg-white border-r border-green-100 h-full overflow-hidden">
        <div className="px-5 py-4 border-b border-green-100 bg-green-50/60">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-green-900">Applications</h2>
              <p className="text-[10px] text-green-500 mt-0.5">{apps.length} total across {candidates.length} candidates</p>
            </div>
            <button onClick={fetchApps} title="Refresh" className="p-1.5 rounded text-green-500 hover:text-green-800 hover:bg-green-100 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-6 text-center text-green-400 text-xs">Loading...</div>}
          {!loading && candidates.length === 0 && (
            <div className="p-8 text-center">
              <Briefcase className="w-8 h-8 text-green-200 mx-auto mb-3" />
              <p className="text-xs text-green-400 font-medium">No applications yet</p>
              <p className="text-[10px] text-green-300 mt-1">Run AI Analyse on a candidate first</p>
            </div>
          )}
          {candidates.map(c => {
            const isSelected = selectedId === c.id;
            const pct = c.total > 0 ? (c.relevant / c.total) * 100 : 0;
            return (
              <button
                key={c.id}
                onClick={() => { setSelectedId(c.id); setStatusFilter('all'); setDateFilter('all'); setSearchInput(''); setSearch(''); }}
                className={`w-full text-left px-4 py-4 border-b border-green-50 transition-all group ${
                  isSelected ? 'bg-green-700 border-l-4 border-l-white' : 'hover:bg-green-50 border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                  }`}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-green-900'}`}>{c.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-green-100 text-green-600'
                      }`}>{c.technology}</span>
                      <span className={`text-[10px] ${isSelected ? 'text-green-200' : 'text-green-400'}`}>{c.country}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-[10px] font-semibold ${isSelected ? 'text-green-100' : 'text-green-600'}`}>
                        <span className={`font-black text-sm ${isSelected ? 'text-white' : 'text-green-700'}`}>{c.relevant}</span>
                        <span className={`ml-0.5 ${isSelected ? 'text-green-200' : 'text-green-400'}`}>/ {c.total} matched</span>
                      </span>
                    </div>
                    <div className={`mt-2 h-1 rounded-full overflow-hidden ${isSelected ? 'bg-white/20' : 'bg-green-100'}`}>
                      <div className={`h-full rounded-full transition-all ${isSelected ? 'bg-white' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-green-200' : 'text-green-400'}`}>{Math.round(pct)}% match rate</p>
                    {c.resume_url && (
                      <button
                        onClick={e => { e.stopPropagation(); setResumePreview({ name: c.name, url: c.resume_url! }); }}
                        className={`mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded transition-colors ${
                          isSelected ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-green-100 text-green-600 hover:bg-green-200'
                        }`}
                      >
                        <FileText className="w-3 h-3" /> View Resume
                      </button>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-green-50/30">

        {!selectedId && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <Users className="w-10 h-10 text-green-300" />
            </div>
            <div>
              <p className="text-base font-bold text-green-800">Select a Candidate</p>
              <p className="text-sm text-green-400 mt-1">
                {candidates.length > 0
                  ? 'Choose a candidate from the left to view their job applications'
                  : 'No applications yet — run AI Analyse on a candidate to get started'}
              </p>
            </div>
          </div>
        )}

        {!selectedId && loading && (
          <div className="flex-1 flex items-center justify-center text-green-400 text-sm">Loading...</div>
        )}

        {selectedId && selected && (
          <>
            {/* Stats header */}
            <div className="bg-white border-b border-green-100 px-6 py-4 shrink-0">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-xl font-black text-green-900">{selected.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-green-100 text-green-700 px-2 py-0.5 rounded">{selected.technology}</span>
                    <span className="text-xs text-green-500">{selected.country}</span>
                    {selected.resume_url && (
                      <button
                        onClick={() => setResumePreview({ name: selected.name, url: selected.resume_url! })}
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors"
                      >
                        <FileText className="w-3 h-3" /> Resume
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-black text-green-800">{candidateApps.length}</div>
                    <div className="text-[10px] uppercase tracking-widest text-green-400 font-bold">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black text-emerald-600">{relevantCount}</div>
                    <div className="text-[10px] uppercase tracking-widest text-green-400 font-bold">Relevant</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black text-red-400">{irrelevantCount}</div>
                    <div className="text-[10px] uppercase tracking-widest text-green-400 font-bold">Not Suitable</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black text-green-700">{matchRate}%</div>
                    <div className="text-[10px] uppercase tracking-widest text-green-400 font-bold">Match Rate</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter bar */}
            <div className="bg-white border-b border-green-100 px-6 py-3 flex items-center gap-2 flex-wrap shrink-0">
              <div className="flex items-center bg-green-50 rounded-lg p-1 gap-0.5">
                {([
                  ['all', 'All', candidateApps.length],
                  ['relevant', 'Relevant', relevantCount],
                  ['irrelevant', 'Not Suitable', irrelevantCount],
                ] as [StatusFilter, string, number][]).map(([val, label, count]) => (
                  <button
                    key={val}
                    onClick={() => setStatusFilter(val)}
                    className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md transition-all ${
                      statusFilter === val ? 'bg-green-700 text-white shadow-sm' : 'text-green-600 hover:text-green-800 hover:bg-green-100'
                    }`}
                  >
                    {label}
                    <span className={`text-[9px] font-black px-1 py-0.5 rounded-full min-w-[16px] text-center ${
                      statusFilter === val ? 'bg-white/20' : 'bg-green-200 text-green-700'
                    }`}>{count}</span>
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-green-100 mx-1" />

              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-green-400" />
                <div className="flex items-center bg-green-50 rounded-lg p-1 gap-0.5">
                  {dateBtns.map(btn => (
                    <button
                      key={btn.value}
                      onClick={() => setDateFilter(btn.value)}
                      className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-md transition-all ${
                        dateFilter === btn.value ? 'bg-green-700 text-white shadow-sm' : 'text-green-600 hover:text-green-800 hover:bg-green-100'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5 flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-green-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search job title or company..."
                  value={searchInput}
                  onChange={e => {
                    const v = e.target.value;
                    setSearchInput(v);
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => setSearch(v), 300);
                  }}
                  className="text-xs text-green-800 outline-none bg-transparent w-full placeholder:text-green-300"
                />
                {searchInput && (
                  <button onClick={() => { setSearchInput(''); setSearch(''); }}>
                    <X className="w-3 h-3 text-green-400 hover:text-green-700" />
                  </button>
                )}
              </div>

              <span className="text-[10px] text-green-400 font-bold ml-auto whitespace-nowrap">{filtered.length} shown</span>
            </div>

            {error && (
              <div className="mx-6 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</div>
            )}

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 h-full text-center py-16">
                  <Briefcase className="w-10 h-10 text-green-200" />
                  <div>
                    <p className="text-sm font-bold text-green-400">No applications match</p>
                    <p className="text-xs text-green-300 mt-1">Try adjusting your filters</p>
                  </div>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-white border-b border-green-100 sticky top-0 z-10">
                    <tr className="text-left">
                      <th className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-green-500">Job Title</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-green-500">Company</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-green-500">Location</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-green-500">AI Score</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-green-500">Status</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-green-500">Analysed On</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-green-500">Link</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((app, idx) => {
                      const isExpanded = expanded.has(app.id);
                      const isDeleting = deletingIds.has(app.id);
                      const isConfirming = confirmingDelete === app.id;
                      const reasons = Array.isArray(app.reasons) ? app.reasons : [];
                      const isRelevant = app.status === 'relevant';

                      return (
                        <React.Fragment key={app.id}>
                          <tr className={`border-b border-green-50 transition-all duration-300 ${
                            isDeleting ? 'opacity-0 -translate-x-4' :
                            isConfirming ? 'bg-red-50' :
                            idx % 2 === 0 ? 'bg-white hover:bg-green-50/50' : 'bg-green-50/20 hover:bg-green-50/60'
                          }`}>
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-green-900 max-w-[260px] truncate" title={app.job_title}>
                                {app.job_title || '—'}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-sm text-green-700 font-medium">{app.job_company || '—'}</td>
                            <td className="px-4 py-4 text-xs text-green-500 max-w-[160px] truncate">{app.job_location || '—'}</td>
                            {/* Score column */}
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                {/* Overall score badge with tooltip */}
                                <div className="relative group cursor-default shrink-0">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2" style={{
                                    borderColor: app.score >= 70 ? '#34d399' : app.score >= 50 ? '#fbbf24' : '#fca5a5',
                                    color: app.score >= 70 ? '#059669' : app.score >= 50 ? '#d97706' : '#ef4444',
                                    backgroundColor: app.score >= 70 ? '#ecfdf5' : app.score >= 50 ? '#fffbeb' : '#fff1f2',
                                  }}>
                                    {app.score ?? '—'}
                                  </div>
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50 shadow-lg">
                                    Overall Score
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
                                  </div>
                                </div>
                                {/* Sub-score bars with tooltips */}
                                <div className="space-y-0.5">
                                  <ScoreBar value={app.skill_match_score ?? 0} color="bg-blue-400" label="Skill Match" />
                                  <ScoreBar value={app.experience_score ?? 0} color="bg-green-400" label="Experience" />
                                  <ScoreBar value={app.location_score ?? 0} color="bg-teal-400" label="Location" />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {isRelevant ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" /> Relevant
                                </span>
                              ) : (
                                <button
                                  onClick={() => reasons.length > 0 && setExpanded(p => {
                                    const n = new Set(p); n.has(app.id) ? n.delete(app.id) : n.add(app.id); return n;
                                  })}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-500 border border-red-200 ${
                                    reasons.length > 0 ? 'hover:bg-red-100 cursor-pointer' : 'cursor-default'
                                  }`}
                                >
                                  Not Suitable
                                  {reasons.length > 0 && (isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-4 text-xs text-green-400 whitespace-nowrap">
                              {app.created_at ? new Date(app.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </td>
                            <td className="px-4 py-4">
                              {app.job_url ? (
                                <a href={app.job_url} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors">
                                  <ExternalLink className="w-3 h-3" /> View
                                </a>
                              ) : (
                                <span className="text-xs text-green-200">—</span>
                              )}
                            </td>
                            <td className="px-2 py-4">
                              {isConfirming ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => deleteOne(app.id)} className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700">
                                    <CheckCircle2 className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setConfirmingDelete(null)} className="p-1.5 rounded-lg bg-white border border-green-200 text-green-600 hover:bg-green-50">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmingDelete(app.id)}
                                  disabled={isDeleting}
                                  className="p-1.5 rounded-lg text-green-200 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && reasons.length > 0 && !isDeleting && (
                            <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-green-50/20'}>
                              <td colSpan={8} className="px-6 py-3 border-b border-red-100">
                                <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">Why Not Suitable</p>
                                  <ul className="space-y-1">
                                    {reasons.map((r, i) => (
                                      <li key={i} className="flex items-start gap-2 text-xs text-red-600">
                                        <span className="text-red-300 mt-0.5 shrink-0">•</span>
                                        {r}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-800 text-white px-4 py-3 rounded-xl shadow-xl border border-green-700">
          <CheckCircle2 className="w-4 h-4 text-green-300" />
          <span className="text-sm font-bold">{toast}</span>
        </div>
      )}

      {resumePreview && (
        <ResumeModal
          name={resumePreview.name}
          url={resumePreview.url}
          onClose={() => setResumePreview(null)}
        />
      )}
    </div>
  );
}
