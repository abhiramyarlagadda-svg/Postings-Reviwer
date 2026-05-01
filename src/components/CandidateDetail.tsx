import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Zap, FileText, X, ExternalLink, FileSpreadsheet, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/src/lib/AuthContext';
import { calculateScores, sortResults, type Candidate, type Job, type JobResult } from '@/src/lib/aiEngine';
import JobTable from './JobTable';
import UploadJobsModal from './UploadJobsModal';

interface Props {
  candidate: Candidate;
  appsRevision?: number;
}

// Local YYYY-MM-DD for the date picker input value
const toDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Local midnight as a UTC ISO string so the API filter aligns with what
// toLocaleDateString() shows in the table (avoids UTC vs local mismatch)
const localMidnightISO = (d: Date): string =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();

type QuickFilter = 'today' | 'yesterday' | 'week' | 'all' | null;

export default function CandidateDetail({ candidate, appsRevision }: Props) {
  const { token } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [analysing, setAnalysing] = useState(false);
  const [results, setResults] = useState<JobResult[] | null>(null);
  const [filterApplied, setFilterApplied] = useState<'all' | 'relevant' | 'not_suitable'>('all');
  const [error, setError] = useState('');
  const [resumePreviewUrl, setResumePreviewUrl] = useState<string | null>(null);
  const [showUploadJobs, setShowUploadJobs] = useState(false);
  const [uploadedSource, setUploadedSource] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [analysedJobIds, setAnalysedJobIds] = useState<Set<string>>(new Set());
  const [hiddenJobsCount, setHiddenJobsCount] = useState(0);

  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);
  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${tokenRef.current}` }), []);

  const fetchJobs = useCallback(async (p = 1, excludeIds?: Set<string>, dateOverride?: string, dateToOverride?: string) => {
    setLoadingJobs(true);
    setResults(null);
    setSavedCount(null);
    setError('');
    setUploadedSource(false);
    try {
      const effectiveFrom = dateOverride !== undefined ? dateOverride : dateFrom;
      const effectiveTo   = dateToOverride !== undefined ? dateToOverride : dateTo;
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (effectiveFrom) params.set('date_from', effectiveFrom);
      if (effectiveTo)   params.set('date_to',   effectiveTo);
      if (candidate.technology) params.set('technology', candidate.technology);

      const res = await fetch(`/api/jobs?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch jobs');

      const exclude = excludeIds ?? analysedJobIds;
      const allJobs: Job[] = data.jobs || [];
      const filtered = allJobs.filter(j => !exclude.has(j.id));

      setJobs(filtered);
      setHiddenJobsCount(allJobs.length - filtered.length);
      setTotalPages(data.totalPages || 1);
      setTotalJobs(data.total || 0);
      setPage(p);
    } catch (e: any) {
      setError(e.message);
      setJobs([]);
      setTotalJobs(0);
    } finally {
      setLoadingJobs(false);
    }
  }, [candidate.technology, dateFrom, dateTo, authHeaders, analysedJobIds]);

  // On candidate change: load already-analysed IDs first, then fetch filtered jobs
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      let analysedIds = new Set<string>();
      try {
        const res = await fetch(`/api/applications?candidate_id=${candidate.id}`, { headers: authHeaders() });
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          analysedIds = new Set(data.map((a: any) => a.job_id));
          setAnalysedJobIds(analysedIds);
        }
      } catch { /* ignore */ }
      if (!cancelled) fetchJobs(1, analysedIds, '');
    };
    init();
    return () => { cancelled = true; };
  }, [candidate.id, appsRevision]);

  const handleQuickFilter = (preset: 'today' | 'yesterday' | 'week' | 'all') => {
    const now = new Date();
    // API filter params use local-midnight UTC so they match toLocaleDateString() display
    let apiFrom = '';
    let apiTo   = '';
    // Date picker display value (YYYY-MM-DD in local time)
    let displayFrom = '';

    if (preset === 'today') {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      apiFrom     = localMidnightISO(now);
      apiTo       = localMidnightISO(tomorrow);
      displayFrom = toDateStr(now);
    } else if (preset === 'yesterday') {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      apiFrom     = localMidnightISO(yesterday);
      apiTo       = localMidnightISO(now); // exclusive: everything before local midnight today
      displayFrom = toDateStr(yesterday);
    } else if (preset === 'week') {
      const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      apiFrom     = localMidnightISO(weekAgo);
      displayFrom = toDateStr(weekAgo);
      // no upper bound
    }
    // 'all': all remain ''

    setQuickFilter(preset);
    setDateFrom(displayFrom);
    setDateTo('');
    fetchJobs(1, analysedJobIds, apiFrom, apiTo);
  };

  const handleDateChange = (val: string) => {
    setDateFrom(val);
    setDateTo('');
    setQuickFilter(null);
    // val is 'YYYY-MM-DD' from the date picker — parse as local date for accurate midnight
    const apiFrom = val ? localMidnightISO(new Date(val + 'T00:00:00')) : '';
    fetchJobs(1, analysedJobIds, apiFrom, '');
  };

  const handleAnalyse = async () => {
    if (jobs.length === 0) return;
    setAnalysing(true);
    setError('');
    setSavedCount(null);
    try {
      const res = await fetch('/api/ai/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ candidate, jobs })
      });
      const data = await res.json();
      const scoreMap = new Map<number, number>();
      (data.scores || []).forEach((s: any) => scoreMap.set(s.index, s.score));

      const analysed = jobs.map((job, i) =>
        calculateScores(candidate, job, scoreMap.get(i) ?? 50)
      );
      const sorted = sortResults(analysed);
      setResults(sorted);
      setFilterApplied('all');

      const saveRes = await fetch('/api/applications/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          candidate_id: candidate.id,
          results: sorted.map(r => ({
            job_id: r.job.id,
            status: r.suitable ? 'relevant' : 'irrelevant',
            score: r.overallScore,
            skill_match_score: r.skillMatchScore,
            experience_score: r.experienceScore,
            location_score: r.locationScore,
            reasons: r.reasons,
            job_title: r.job.title,
            job_company: r.job.company,
            job_location: r.job.location || r.job.country || '',
            job_url: r.job.url || ''
          }))
        })
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(`Save to DB failed: ${saveData.error || 'unknown error'}. Make sure the applications table has all required columns.`);
      }

      setSavedCount(saveData.saved);
      setAnalysedJobIds(prev => {
        const next = new Set(prev);
        sorted.forEach(r => next.add(r.job.id));
        return next;
      });
    } catch (e: any) {
      setError('AI analysis failed: ' + e.message);
    } finally {
      setAnalysing(false);
    }
  };

  const handleJobsUploaded = (uploaded: Job[]) => {
    setJobs(uploaded);
    setResults(null);
    setSavedCount(null);
    setError('');
    setPage(1);
    setTotalPages(1);
    setTotalJobs(uploaded.length);
    setHiddenJobsCount(0);
    setUploadedSource(true);
  };

  const getPreviewUrl = (url: string) => {
    if (url.toLowerCase().includes('.pdf') || url.includes('application/pdf')) return url;
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  };

  const quickBtns: { label: string; value: 'today' | 'yesterday' | 'week' | 'all' }[] = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 Days', value: 'week' },
    { label: 'All Time', value: 'all' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-5 gap-4">
      {/* Candidate header */}
      <div className="bg-white rounded border border-green-100 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-green-900 truncate">{candidate.name}</h2>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="text-xs text-green-700 font-bold uppercase tracking-widest bg-green-100 px-2.5 py-1 rounded border border-green-200">
                {candidate.technology}
              </span>
              <span className="text-sm font-medium text-green-700">{candidate.country}</span>
              <span className="text-sm font-medium text-green-700">{candidate.experience_years} yrs experience</span>
              {candidate.email && <span className="text-sm text-green-500">{candidate.email}</span>}
            </div>
          </div>
          {candidate.resume_url && (
            <button
              onClick={() => setResumePreviewUrl(candidate.resume_url!)}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-green-700 hover:text-green-900 px-3 py-2 border border-green-200 rounded hover:bg-green-50"
            >
              <FileText className="w-3.5 h-3.5" /> Resume
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        {/* Row 1: filters + actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick date presets */}
          {quickBtns.map(btn => (
            <button
              key={btn.value}
              onClick={() => handleQuickFilter(btn.value)}
              className={`text-xs font-bold uppercase tracking-widest px-3 py-2 rounded border transition-colors ${
                quickFilter === btn.value
                  ? 'bg-green-700 text-white border-green-700'
                  : 'border-green-300 text-green-700 bg-white hover:bg-green-50'
              }`}
            >
              {btn.label}
            </button>
          ))}

          {/* Manual date picker */}
          <div className="flex items-center gap-2 bg-white border border-green-200 rounded px-3 py-2">
            <Calendar className="w-3.5 h-3.5 text-green-700 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => handleDateChange(e.target.value)}
              className="text-xs text-green-800 outline-none bg-transparent w-36"
            />
          </div>

          <div className="flex-1" />

          <button
            onClick={() => setShowUploadJobs(true)}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded border border-green-300 text-green-700 bg-white hover:bg-green-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Upload Jobs
          </button>

          <button
            onClick={handleAnalyse}
            disabled={analysing || jobs.length === 0}
            className={`relative flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded text-white disabled:cursor-not-allowed overflow-hidden transition-all ${
              analysing
                ? 'bg-gradient-to-r from-green-700 via-green-500 to-green-700 bg-[length:200%_100%] animate-[shimmer_1.2s_linear_infinite] shadow-lg shadow-green-300 ring-2 ring-green-300'
                : 'bg-green-700 hover:bg-green-800 disabled:opacity-50'
            }`}
          >
            {analysing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Analysing</span>
                <span className="inline-flex">
                  <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                </span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>AI Analyse</span>
              </>
            )}
          </button>
        </div>

        {/* Row 2: status info */}
        <div className="flex items-center gap-4 flex-wrap min-h-[20px]">
          {!results && !loadingJobs && !uploadedSource && totalJobs > 0 && (
            <span className="text-xs text-green-700 font-semibold">
              {totalJobs.toLocaleString()} jobs found
              {hiddenJobsCount > 0 && (
                <span className="text-green-400 font-normal ml-1">
                  ({hiddenJobsCount} already reviewed hidden)
                </span>
              )}
            </span>
          )}
          {uploadedSource && !results && (
            <span className="text-xs text-green-600 font-medium italic">
              {jobs.length} jobs loaded from file
            </span>
          )}
          {loadingJobs && (
            <span className="text-xs text-green-400 italic">Loading...</span>
          )}
          {results && (
            <span className="text-xs text-green-700 uppercase tracking-widest font-bold">
              {results.filter(r => r.suitable).length} relevant / {results.length} total
            </span>
          )}
          {savedCount !== null && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-100 border border-green-300 px-2.5 py-1 rounded animate-pulse">
              <CheckCircle className="w-3.5 h-3.5" /> {savedCount} results saved to Applications
            </span>
          )}
        </div>
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
        page={page}
        totalPages={totalPages}
        onPageChange={p => fetchJobs(p)}
        filterApplied={filterApplied}
        onFilterChange={setFilterApplied}
      />

      {/* AI Analysis Loading Overlay */}
      {analysing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-green-300 p-8 max-w-md w-full mx-4">
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-green-700 animate-pulse" />
                </div>
                <Loader2 className="absolute inset-0 w-20 h-20 text-green-700 animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-green-900 uppercase tracking-wide">AI Analysing</h3>
                <p className="text-sm text-green-700 mt-1">
                  Matching <span className="font-bold">{jobs.length}</span> jobs against {candidate.name}'s profile...
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-green-700 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-green-700 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-green-700 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <p className="text-[10px] text-green-500 mt-3 uppercase tracking-widest">
                  Saving results to applications...
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUploadJobs && (
        <UploadJobsModal
          onClose={() => setShowUploadJobs(false)}
          onLoad={handleJobsUploaded}
        />
      )}

      {resumePreviewUrl && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-green-200 w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-green-100 shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-widest text-green-800 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Resume — {candidate.name}
              </h3>
              <div className="flex items-center gap-3">
                <a
                  href={resumePreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-green-700 hover:text-green-900 px-2.5 py-1 border border-green-200 rounded hover:bg-green-50"
                >
                  <ExternalLink className="w-3 h-3" /> Open in Tab
                </a>
                <button onClick={() => setResumePreviewUrl(null)} className="text-green-400 hover:text-green-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden rounded-b-lg">
              <iframe
                src={getPreviewUrl(resumePreviewUrl)}
                className="w-full h-full border-0"
                title="Resume Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
