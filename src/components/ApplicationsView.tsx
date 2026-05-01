import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, Search, CheckCircle2, Eye, Trash2, X, AlertTriangle } from 'lucide-react';
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

type StatusFilter = 'all' | 'relevant' | 'irrelevant';

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0); // start at 0 so it counts up on first load

  useEffect(() => {
    if (display === value) return;
    const diff = Math.abs(value - display);
    const delay = diff > 10 ? 12 : diff > 3 ? 25 : 50;
    const timer = setTimeout(() => {
      setDisplay(prev => prev + (value > prev ? 1 : -1));
    }, delay);
    return () => clearTimeout(timer);
  }, [display, value]);

  return <span className={className}>{display}</span>;
}

export default function ApplicationsView({ onDeleted }: { onDeleted?: () => void }) {
  const { token } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [candidateFilter, setCandidateFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setError('');
    setReviewedIds(new Set());
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

  const toggle = (id: string, isIrrelevant?: boolean, hasReasons?: boolean) => {
    // Always mark as reviewed on first click
    if (isIrrelevant) {
      setReviewedIds(r => { const nr = new Set(r); nr.add(id); return nr; });
    }
    // Only expand/collapse if there are red flags to show
    if (hasReasons) {
      setExpanded(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }
  };

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

      // Brief delay so the fade-out plays
      setTimeout(() => {
        setApps(prev => prev.filter(a => a.id !== id));
        setReviewedIds(r => { const n = new Set(r); n.delete(id); return n; });
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

  const deleteReviewed = async () => {
    const ids = Array.from(reviewedIds);
    if (ids.length === 0) return;
    setBulkConfirm(false);
    setDeletingIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });

    try {
      const res = await fetch('/api/applications/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Bulk delete failed');

      setTimeout(() => {
        setApps(prev => prev.filter(a => !reviewedIds.has(a.id)));
        setReviewedIds(new Set());
        setDeletingIds(new Set());
        showToast(`${ids.length} reviewed application${ids.length > 1 ? 's' : ''} deleted`);
        onDeleted?.();
      }, 320);
    } catch (e: any) {
      setDeletingIds(new Set());
      setError(e.message || 'Bulk delete failed');
    }
  };

  // Unique candidate names for dropdown
  const candidateNames = Array.from(
    new Map(apps.map(a => [a.candidate_id, a.candidates?.name || 'Unknown'])).entries()
  ).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

  const filtered = apps.filter(a => {
    if (statusFilter === 'relevant' && a.status !== 'relevant') return false;
    if (statusFilter === 'irrelevant' && a.status !== 'irrelevant') return false;
    if (candidateFilter && a.candidate_id !== candidateFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const candidateName = (a.candidates?.name || '').toLowerCase();
      const jobTitle = (a.job_title || '').toLowerCase();
      const company = (a.job_company || '').toLowerCase();
      if (!candidateName.includes(q) && !jobTitle.includes(q) && !company.includes(q)) return false;
    }
    return true;
  });

  const relevantCount = apps.filter(a => a.status === 'relevant').length;
  const irrelevantCount = apps.filter(a => a.status === 'irrelevant').length;
  const reviewedCount = reviewedIds.size;
  const remainingCount = Math.max(0, irrelevantCount - reviewedCount);
  const progressPercent = irrelevantCount > 0 ? (reviewedCount / irrelevantCount) * 100 : 0;
  const allReviewed = irrelevantCount > 0 && remainingCount === 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-5 gap-4">
      {/* Header */}
      <div className="bg-white rounded border border-green-100 p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-green-900">Applications</h2>
            <p className="text-xs text-green-500 mt-1">All AI-analysed jobs saved across candidates</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700">{apps.length}</div>
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

        {/* Review progress tracker — only shown when there are not-suitable items */}
        {!loading && irrelevantCount > 0 && (
          <div className={`rounded-lg border px-4 py-3 transition-all duration-500 ${
            allReviewed
              ? 'bg-green-50 border-green-300'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {allReviewed ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <Eye className="w-4 h-4 text-amber-600" />
                )}
                <span className={`text-xs font-bold uppercase tracking-widest ${
                  allReviewed ? 'text-green-700' : 'text-amber-700'
                }`}>
                  {allReviewed ? 'All Not Suitable Items Reviewed' : 'Review Progress'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {allReviewed ? (
                  <span className="text-xs font-bold text-green-600 bg-green-100 px-2.5 py-1 rounded-full border border-green-300">
                    {irrelevantCount} / {irrelevantCount} reviewed
                  </span>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <AnimatedNumber
                      value={remainingCount}
                      className="text-2xl font-black text-amber-700 tabular-nums leading-none"
                    />
                    <span className="text-xs font-bold text-amber-600">remaining to review</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-white rounded-full border border-green-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  allReviewed
                    ? 'bg-green-500'
                    : 'bg-gradient-to-r from-amber-400 to-green-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-green-500">
                Click <span className="font-bold text-red-500">Not Suitable</span> to expand red flags &amp; mark as reviewed
              </span>
              <div className="flex items-center gap-2.5">
                <span className={`text-[10px] font-bold tabular-nums ${
                  allReviewed ? 'text-green-600' : 'text-amber-600'
                }`}>
                  {reviewedCount} / {irrelevantCount} reviewed
                </span>
                {reviewedCount > 0 && !bulkConfirm && (
                  <button
                    onClick={() => setBulkConfirm(true)}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Delete reviewed ({reviewedCount})
                  </button>
                )}
                {bulkConfirm && (
                  <div className="flex items-center gap-1.5 bg-red-50 border border-red-300 rounded px-2 py-1 animate-[shimmer_0.3s_ease-out]">
                    <AlertTriangle className="w-3 h-3 text-red-600" />
                    <span className="text-[10px] font-bold text-red-700">Delete {reviewedCount} forever?</span>
                    <button
                      onClick={deleteReviewed}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setBulkConfirm(false)}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-red-700 hover:bg-red-100"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {([['all', 'All'], ['relevant', 'Relevant'], ['irrelevant', 'Not Suitable']] as [StatusFilter, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setStatusFilter(val)}
            className={`text-xs font-bold uppercase tracking-widest px-4 py-2 rounded border transition-colors ${
              statusFilter === val
                ? 'bg-green-700 text-white border-green-700'
                : 'bg-white text-green-700 border-green-200 hover:bg-green-50'
            }`}
          >
            {label}
          </button>
        ))}

        <select
          value={candidateFilter}
          onChange={e => setCandidateFilter(e.target.value)}
          className="text-xs text-green-800 border border-green-200 rounded px-3 py-2 bg-white focus:outline-none focus:border-green-500"
        >
          <option value="">All Candidates</option>
          {candidateNames.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 bg-white border border-green-200 rounded px-3 py-2 flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-green-500 shrink-0" />
          <input
            type="text"
            placeholder="Search by candidate, job title or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs text-green-800 outline-none bg-transparent w-full"
          />
        </div>

        <span className="text-xs text-green-500 font-medium ml-auto">
          {filtered.length} of {apps.length} shown
        </span>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto bg-white border border-green-100 rounded">
        {loading ? (
          <div className="p-10 text-center text-green-500 text-sm">Loading applications...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-green-400 text-sm">
            {apps.length === 0
              ? 'No applications yet. Run AI Analyse on a candidate to save results here.'
              : 'No applications match the current filters.'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-green-50 sticky top-0 z-10">
              <tr className="text-left">
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Candidate</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Job Title</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Company</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Location</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Score</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Status</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Analysed</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Link</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-50">
              {filtered.map(app => {
                const isExpanded = expanded.has(app.id);
                const isReviewed = reviewedIds.has(app.id);
                const isDeleting = deletingIds.has(app.id);
                const isConfirming = confirmingDelete === app.id;
                const reasons = Array.isArray(app.reasons) ? app.reasons : [];
                const hasReasons = reasons.length > 0;
                const isIrrelevant = app.status === 'irrelevant';
                const candidateName = app.candidates?.name || 'Unknown';
                const candidateTech = app.candidates?.technology || '';

                return (
                  <React.Fragment key={app.id}>
                    <tr className={`transition-all duration-300 ${
                      isDeleting
                        ? 'opacity-0 -translate-x-4 bg-red-50'
                        : isConfirming
                          ? 'bg-red-50/60'
                          : isReviewed && isIrrelevant
                            ? 'bg-green-50/30 opacity-75 hover:opacity-100 hover:bg-green-50/60'
                            : 'hover:bg-green-50/40'
                    }`}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-green-900">{candidateName}</div>
                        {candidateTech && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                            {candidateTech}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-900 max-w-[220px]">
                        {app.job_title || '—'}
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
                            onClick={() => toggle(app.id, true, hasReasons)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider border transition-all ${
                              isReviewed
                                ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-default'
                                : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 cursor-pointer'
                            }`}
                          >
                            {isReviewed ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                <span>Reviewed</span>
                              </>
                            ) : (
                              <>
                                Not Suitable
                                {hasReasons && (isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                              </>
                            )}
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
                            className="p-1.5 rounded text-green-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && hasReasons && !isDeleting && (
                      <tr>
                        <td colSpan={9} className="px-4 py-3 bg-red-50/40 border-t border-red-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1.5">Red Flags</p>
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
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-700 text-white px-4 py-3 rounded-lg shadow-lg border border-green-800 animate-[shimmer_0.4s_ease-out]">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-bold">{toast}</span>
        </div>
      )}
    </div>
  );
}
