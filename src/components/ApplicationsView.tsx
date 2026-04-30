import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, Search } from 'lucide-react';
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

export default function ApplicationsView() {
  const { token } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [candidateFilter, setCandidateFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchApps = useCallback(async () => {
    setLoading(true);
    setError('');
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

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-5 gap-4">
      {/* Header */}
      <div className="bg-white rounded border border-green-100 p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
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
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status tabs */}
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

        {/* Candidate filter */}
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

        {/* Search */}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-green-50">
              {filtered.map(app => {
                const isExpanded = expanded.has(app.id);
                const hasReasons = Array.isArray(app.reasons) && app.reasons.length > 0;
                const candidateName = app.candidates?.name || 'Unknown';
                const candidateTech = app.candidates?.technology || '';

                return (
                  <React.Fragment key={app.id}>
                    <tr className="hover:bg-green-50/40">
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
                        {app.skill_match_score != null && (
                          <div className="text-[10px] text-green-400">
                            Skill {app.skill_match_score}% · Exp {app.experience_score}%
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {app.status === 'relevant' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-green-100 text-green-700 border border-green-300">
                            Relevant
                          </span>
                        ) : (
                          <button
                            onClick={() => hasReasons && toggle(app.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-200 ${hasReasons ? 'hover:bg-red-100 cursor-pointer' : 'cursor-default'}`}
                          >
                            Not Suitable
                            {hasReasons && (isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-green-400">
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
                    </tr>
                    {isExpanded && hasReasons && (
                      <tr>
                        <td colSpan={8} className="px-4 py-3 bg-red-50/40 border-t border-red-100">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1.5">Red Flags</p>
                          <ul className="text-xs text-red-700 space-y-1">
                            {app.reasons.map((r, i) => (
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
    </div>
  );
}
