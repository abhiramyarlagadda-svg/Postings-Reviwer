import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Zap, FileText } from 'lucide-react';
import { calculateScores, sortResults, type Candidate, type Job, type JobResult } from '@/src/lib/aiEngine';
import JobTable from './JobTable';

interface Props {
  candidate: Candidate;
}

export default function CandidateDetail({ candidate }: Props) {
  const [dateFrom, setDateFrom] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [analysing, setAnalysing] = useState(false);
  const [results, setResults] = useState<JobResult[] | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [filterApplied, setFilterApplied] = useState<'all' | 'applied' | 'not_applied'>('all');
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchJobs = useCallback(async (p = 1) => {
    setLoadingJobs(true);
    setResults(null);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (dateFrom) params.set('date_from', dateFrom);
      if (candidate.technology) params.set('technology', candidate.technology);

      const res = await fetch(`/api/jobs?${params}`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch jobs');

      setJobs(data.jobs || []);
      setTotalPages(data.totalPages || 1);
      setPage(p);
    } catch (e: any) {
      setError(e.message);
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, [candidate.technology, dateFrom]);

  const fetchApplications = useCallback(async () => {
    try {
      const res = await fetch(`/api/applications?candidate_id=${candidate.id}`, { headers: authHeaders });
      const data = await res.json();
      if (Array.isArray(data)) {
        setAppliedJobIds(new Set(data.map((a: any) => a.job_id)));
      }
    } catch {
      /* ignore */
    }
  }, [candidate.id]);

  useEffect(() => {
    fetchJobs(1);
    fetchApplications();
  }, [candidate.id]);

  const handleAnalyse = async () => {
    if (jobs.length === 0) return;
    setAnalysing(true);
    setError('');
    try {
      const res = await fetch('/api/ai/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ candidate, jobs })
      });
      const data = await res.json();
      const scoreMap = new Map<number, number>();
      (data.scores || []).forEach((s: any) => scoreMap.set(s.index, s.score));

      const analysed = jobs.map((job, i) =>
        calculateScores(candidate, job, scoreMap.get(i) ?? 50)
      );
      setResults(sortResults(analysed));
    } catch (e: any) {
      setError('AI analysis failed: ' + e.message);
    } finally {
      setAnalysing(false);
    }
  };

  const handleApply = async (jobId: string) => {
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ candidate_id: candidate.id, job_id: jobId })
      });
      if (res.ok) {
        setAppliedJobIds(prev => new Set([...prev, jobId]));
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-5 gap-4">
      <div className="bg-white rounded border border-green-100 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-green-900 truncate">{candidate.name}</h2>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
              <span className="text-[10px] text-green-700 font-bold uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded">
                {candidate.technology}
              </span>
              <span className="text-[11px] text-green-600">{candidate.country}</span>
              <span className="text-[11px] text-green-600">{candidate.experience_years} yrs experience</span>
              {candidate.email && <span className="text-[11px] text-green-500">{candidate.email}</span>}
            </div>
          </div>
          {candidate.resume_url && (
            <a
              href={candidate.resume_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-green-700 hover:text-green-900 px-3 py-1.5 border border-green-200 rounded hover:bg-green-50"
            >
              <FileText className="w-3 h-3" /> Resume
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-green-200 rounded px-3 py-2">
          <Calendar className="w-3.5 h-3.5 text-green-700" />
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-xs text-green-800 outline-none bg-transparent w-36"
          />
        </div>

        <button
          onClick={() => fetchJobs(1)}
          className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded border border-green-300 text-green-700 hover:bg-green-50"
        >
          Apply Filter
        </button>

        <button
          onClick={handleAnalyse}
          disabled={analysing || jobs.length === 0}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="w-3.5 h-3.5" />
          {analysing ? 'Analysing...' : 'AI Analyse'}
        </button>

        {results && (
          <span className="text-[10px] text-green-700 uppercase tracking-widest font-bold">
            {results.filter(r => r.suitable).length} relevant / {results.length} total
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {error}
        </div>
      )}

      <JobTable
        results={results}
        jobs={jobs}
        loading={loadingJobs}
        appliedJobIds={appliedJobIds}
        onApply={handleApply}
        page={page}
        totalPages={totalPages}
        onPageChange={p => fetchJobs(p)}
        filterApplied={filterApplied}
        onFilterChange={setFilterApplied}
      />
    </div>
  );
}
