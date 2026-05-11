import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, Search, CheckCircle2, Trash2, X, Calendar } from 'lucide-react';
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
  };
}

interface CandidateCard {
  id: string;
  name: string;
  technology: string;
  country: string;
  total: number;
  relevant: number;
}

type StatusFilter = 'all' | 'relevant' | 'irrelevant';
type DateFilter = 'all' | 'today' | 'week' | 'month';

function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function ApplicationsView({ onDeleted }: { onDeleted?: () => void }) {
  const { token } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setError('');
    setExpanded(new Set());
    setConfirmingDelete(null);
    try {
      const res = await fetch('/api/applications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch applications');
      setApps(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchApps(); }, [fetchApps]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const deleteOne = async (id: string) => {
    setConfirmingDelete(null);
    setDeletingIds(prev => { const n = new Set(prev); n.add(id); return n; });
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setTimeout(() => {
        setApps(prev => prev.filter(a => a.id !== id));
        setExpanded(e => { const n = new Set(e); n.delete(id); return n; });
        setDeletingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
        showToast('Application deleted');
        onDeleted?.();
      }, 280);
    } catch (e: any) {
      setDeletingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      setError(e.message || 'Delete failed');
    }
  };

  const toggleReasons = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Build candidate cards from apps data
  const candidateCards: CandidateCard[] = Array.from(
    apps.reduce((map, a) => {
      if (!map.has(a.candidate_id)) {
        map.set(a.candidate_id, {
          id: a.candidate_id,
          name: a.candidates?.name || 'Unknown',
          technology: a.candidates?.technology || '',
          country: a.candidates?.country || '',
          total: 0,
          relevant: 0,
        });
      }
      const card = map.get(a.candidate_id)!;
      card.total++;
      if (a.status === 'relevant') card.relevant++;
      return map;
    }, new Map<string, CandidateCard>()).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Date filter logic on created_at
  const now = new Date();
  const todayStr = localDateStr(now);
  const weekAgoStr = localDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  const monthAgoStr = localDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));

  const filtered = apps.filter(a => {
    if (selectedCandidateId && a.candidate_id !== selectedCandidateId) return false;
    if (statusFilter === 'relevant' && a.status !== 'relevant') return false;
    if (statusFilter === 'irrelevant' && a.status !== 'irrelevant') return false;

    if (dateFilter !== 'all' && a.created_at) {
      const appDateStr = localDateStr(new Date(a.created_at));
      if (dateFilter === 'today' && appDateStr !== todayStr) return false;
      if (dateFilter === 'week' && appDateStr < weekAgoStr) return false;
      if (dateFilter === 'month' && appDateStr < monthAgoStr) return false;
    }

    if (search) {
      const q = search.toLowerCase();
      const jobTitle = (a.job_title || '').toLowerCase();
      const company = (a.job_company || '').toLowerCase();
      const candidateName = (a.candidates?.name || '').toLowerCase();
      if (!jobTitle.includes(q) && !company.includes(q) && !candidateName.includes(q)) return false;
    }

    return true;
  });

  const visibleApps = selectedCandidateId
    ? apps.filter(a => a.candidate_id === selectedCandidateId)
    : apps;
  const relevantCount = visibleApps.filter(a => a.status === 'relevant').length;
  const irrelevantCount = visibleApps.filter(a => a.status === 'irrelevant').length;

  const selectedCard = candidateCards.find(c => c.id === selectedCandidateId);

  const dateBtns: { label: string; value: DateFilter }[] = [
    { label: 'All Time', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'Last 7 Days', value: 'week' },
    { label: 'Last 30 Days', value: 'month' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-5 gap-4">

      {/* ── Header ── */}
      <div className="bg-white rounded border border-green-100 p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-green-900">
              {selectedCard ? selectedCard.name : 'Applications'}
            </h2>
            <p className="text-xs text-green-500 mt-0.5">
              {selectedCard
                ? `${selectedCard.technology} · ${selectedCard.country}`
                : 'Select a candidate below to view their applications'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700">{visibleApps.length}</div>
              <div className="text-[10px] uppercase tracking-widest text-green-500">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{relevantCount}</div>
              <div className="text-[10px] uppercase tracking-widest text-green-500">Relevant</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-400">{irrelevantCount}</div>
              <div className="text-[10px] uppercase tracking-widest text-green-500">Not Suitable</div>
            </div>
            <button
              onClick={fetchApps}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-2 rounded border border-green-300 text-green-700 hover:bg-green-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Candidate Cards ── */}
      {!loading && (
        <div className="flex items-start gap-3 overflow-x-auto pb-1 shrink-0">
          {/* All card */}
          <button
            onClick={() => setSelectedCandidateId(null)}
            className={`shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-lg border-2 transition-all min-w-[90px] ${
              selectedCandidateId === null
                ? 'border-green-700 bg-green-700 text-white shadow-md'
                : 'border-green-200 bg-white text-green-700 hover:border-green-400 hover:bg-green-50'
            }`}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm ${
              selectedCandidateId === null ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
            }`}>
              All
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">All</span>
            <span className={`text-[10px] font-semibold ${selectedCandidateId === null ? 'text-green-200' : 'text-green-500'}`}>
              {apps.length} apps
            </span>
          </button>

          {candidateCards.length === 0 && (
            <div className="text-xs text-green-400 italic self-center">No applications yet</div>
          )}

          {candidateCards.map(card => {
            const isSelected = selectedCandidateId === card.id;
            return (
              <button
                key={card.id}
                onClick={() => setSelectedCandidateId(isSelected ? null : card.id)}
                className={`shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-lg border-2 transition-all min-w-[110px] max-w-[140px] ${
                  isSelected
                    ? 'border-green-700 bg-green-700 text-white shadow-md'
                    : 'border-green-200 bg-white text-green-700 hover:border-green-400 hover:bg-green-50'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
                }`}>
                  {card.name.charAt(0).toUpperCase()}
                </div>
                <span className={`text-[10px] font-bold truncate w-full text-center ${isSelected ? 'text-white' : 'text-green-900'}`}>
                  {card.name.split(' ')[0]}
                </span>
                <span className={`text-[10px] truncate w-full text-center ${isSelected ? 'text-green-200' : 'text-green-500'}`}>
                  {card.technology}
                </span>
                <div className={`flex items-center gap-1.5 text-[10px] font-semibold ${isSelected ? 'text-green-200' : 'text-green-500'}`}>
                  <span className={`font-bold ${isSelected ? 'text-green-100' : 'text-green-600'}`}>{card.relevant}</span>
                  <span>/</span>
                  <span>{card.total}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status tabs */}
        {([['all', 'All'], ['relevant', 'Relevant'], ['irrelevant', 'Not Suitable']] as [StatusFilter, string][]).map(([val, label]) => {
          const count = val === 'all' ? visibleApps.length
            : val === 'relevant' ? relevantCount
            : irrelevantCount;
          return (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-2 rounded border transition-colors ${
                statusFilter === val
                  ? 'bg-green-700 text-white border-green-700'
                  : 'bg-white text-green-700 border-green-200 hover:bg-green-50'
              }`}
            >
              {label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                statusFilter === val ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
              }`}>
                {count}
              </span>
            </button>
          );
        })}

        <div className="w-px h-6 bg-green-200 mx-1" />

        {/* Date filter */}
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-green-500" />
          {dateBtns.map(btn => (
            <button
              key={btn.value}
              onClick={() => setDateFilter(btn.value)}
              className={`text-xs font-bold uppercase tracking-widest px-3 py-2 rounded border transition-colors ${
                dateFilter === btn.value
                  ? 'bg-green-700 text-white border-green-700'
                  : 'bg-white text-green-700 border-green-200 hover:bg-green-50'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-green-200 rounded px-3 py-2 flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-green-500 shrink-0" />
          <input
            type="text"
            placeholder="Search job title or company..."
            value={searchInput}
            onChange={e => {
              const val = e.target.value;
              setSearchInput(val);
              if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
              searchDebounceRef.current = setTimeout(() => setSearch(val), 300);
            }}
            className="text-xs text-green-800 outline-none bg-transparent w-full"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); setSearch(''); }} className="text-green-400 hover:text-green-700">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <span className="text-xs text-green-500 font-medium ml-auto whitespace-nowrap">
          {filtered.length} shown
        </span>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-y-auto bg-white border border-green-100 rounded">
        {loading ? (
          <div className="p-10 text-center text-green-500 text-sm">Loading applications...</div>
        ) : apps.length === 0 ? (
          <div className="p-10 text-center text-green-400 text-sm">
            No applications yet. Run AI Analyse on a candidate to save results here.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-green-400 text-sm">
            No applications match the current filters.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-green-50 sticky top-0 z-10">
              <tr className="text-left">
                {!selectedCandidateId && (
                  <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Candidate</th>
                )}
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Job Title</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Company</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Location</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Score</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Status</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Analysed On</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Link</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-50">
              {filtered.map(app => {
                const isExpanded = expanded.has(app.id);
                const isDeleting = deletingIds.has(app.id);
                const isConfirming = confirmingDelete === app.id;
                const reasons = Array.isArray(app.reasons) ? app.reasons : [];
                const hasReasons = reasons.length > 0;
                const colSpan = selectedCandidateId ? 8 : 9;

                return (
                  <React.Fragment key={app.id}>
                    <tr className={`transition-all duration-300 ${
                      isDeleting
                        ? 'opacity-0 -translate-x-4 bg-red-50'
                        : isConfirming
                          ? 'bg-red-50/60'
                          : 'hover:bg-green-50/40'
                    }`}>
                      {!selectedCandidateId && (
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-green-900">
                            {app.candidates?.name || '—'}
                          </div>
                          {app.candidates?.technology && (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                              {app.candidates.technology}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm font-semibold text-green-900 max-w-[220px]">
                        <span title={app.job_title}>{app.job_title || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-green-700">{app.job_company || '—'}</td>
                      <td className="px-4 py-3 text-sm text-green-600">{app.job_location || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-bold text-green-800">{app.score ?? '—'}%</div>
                        <div className="text-[10px] text-green-400 space-y-0.5 mt-0.5">
                          {app.skill_match_score != null && <div>Skill {app.skill_match_score}%</div>}
                          {app.experience_score != null && <div>Exp {app.experience_score}%</div>}
                          {app.location_score != null && <div>Loc {app.location_score}%</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {app.status === 'relevant' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-green-100 text-green-700 border border-green-300">
                            Relevant
                          </span>
                        ) : (
                          <button
                            onClick={() => hasReasons && toggleReasons(app.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-200 ${
                              hasReasons ? 'hover:bg-red-100 cursor-pointer' : 'cursor-default'
                            }`}
                          >
                            Not Suitable
                            {hasReasons && (isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-green-400 whitespace-nowrap">
                        {app.created_at ? new Date(app.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {app.job_url ? (
                          <a
                            href={app.job_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded bg-green-700 text-white hover:bg-green-800"
                          >
                            <ExternalLink className="w-3 h-3" /> View Job
                          </a>
                        ) : (
                          <span className="text-xs text-green-300">No link</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => deleteOne(app.id)}
                              title="Confirm delete"
                              className="p-1.5 rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmingDelete(null)}
                              title="Cancel"
                              className="p-1.5 rounded bg-white text-green-700 border border-green-200 hover:bg-green-50 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingDelete(app.id)}
                            title="Delete application"
                            disabled={isDeleting}
                            className="p-1.5 rounded text-green-300 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && hasReasons && !isDeleting && (
                      <tr>
                        <td colSpan={colSpan} className="px-4 py-3 bg-red-50/40 border-t border-red-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1.5">Reasons Not Suitable</p>
                          <ul className="text-xs text-red-700 space-y-1">
                            {reasons.map((r, i) => (
                              <li key={i}>• {r}</li>
                            ))}
                          </ul>
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-700 text-white px-4 py-3 rounded-lg shadow-lg border border-green-800">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-bold">{toast}</span>
        </div>
      )}
    </div>
  );
}
