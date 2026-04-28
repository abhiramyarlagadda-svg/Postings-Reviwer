import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Zap, FileText, X, ExternalLink, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/src/lib/AuthContext';
import { calculateScores, sortResults, type Candidate, type Job, type JobResult } from '@/src/lib/aiEngine';
import JobTable from './JobTable';
import UploadJobsModal from './UploadJobsModal';

interface Props {
  candidate: Candidate;
}

export default function CandidateDetail({ candidate }: Props) {
  const { token } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [analysing, setAnalysing] = useState(false);
  const [results, setResults] = useState<JobResult[] | null>(null);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [filterApplied, setFilterApplied] = useState<'all' | 'applied'>('all');
  const [error, setError] = useState('');
  const [resumePreviewUrl, setResumePreviewUrl] = useState<string | null>(null);
  const [applyConfirmJob, setApplyConfirmJob] = useState<Job | null>(null);
  const [showUploadJobs, setShowUploadJobs] = useState(false);
  const [uploadedSource, setUploadedSource] = useState(false);

  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);
  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${tokenRef.current}` }), []);

  const fetchJobs = useCallback(async (p = 1) => {
    setLoadingJobs(true);
    setResults(null);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (dateFrom) params.set('date_from', dateFrom);
      if (candidate.technology) params.set('technology', candidate.technology);

      const res = await fetch(`/api/jobs?${params}`, { headers: authHeaders() });
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
  }, [candidate.technology, dateFrom, authHeaders]);

  const fetchApplications = useCallback(async () => {
    try {
      const res = await fetch(`/api/applications?candidate_id=${candidate.id}`, { headers: authHeaders() });
      const data = await res.json();
      if (Array.isArray(data)) {
        setAppliedJobIds(new Set(data.map((a: any) => a.job_id)));
      }
    } catch { /* ignore */ }
  }, [candidate.id, authHeaders]);

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
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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

  // Load jobs from Excel upload — replaces current list, clears analysis
  const handleJobsUploaded = (uploaded: Job[]) => {
    setJobs(uploaded);
    setResults(null);
    setError('');
    setPage(1);
    setTotalPages(1);
    setUploadedSource(true);
  };

  // Opens job URL in new tab and shows the "Did you apply?" confirmation popup
  const handleApplyClick = (job: Job) => {
    if (job.url) window.open(job.url, '_blank', 'noreferrer');
    setApplyConfirmJob(job);
  };

  // Called from the confirmation popup
  const handleConfirmApply = async (confirmed: boolean) => {
    if (confirmed && applyConfirmJob) {
      try {
        const res = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ candidate_id: candidate.id, job_id: applyConfirmJob.id })
        });
        if (res.ok) {
          setAppliedJobIds(prev => new Set([...prev, applyConfirmJob.id]));
          setFilterApplied('applied');
        }
      } catch { /* ignore */ }
    }
    setApplyConfirmJob(null);
  };

  // Pick preview URL — use Google Docs viewer for non-PDFs
  const getPreviewUrl = (url: string) => {
    if (url.toLowerCase().includes('.pdf') || url.includes('application/pdf')) return url;
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  };

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

      {/* Filters */}
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
          className="text-xs font-bold uppercase tracking-widest px-3 py-2 rounded border border-green-300 text-green-700 hover:bg-green-50"
        >
          Apply Filter
        </button>

        <button
          onClick={() => setShowUploadJobs(true)}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded border border-green-300 text-green-700 hover:bg-green-50"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Upload Jobs
        </button>

        <button
          onClick={handleAnalyse}
          disabled={analysing || jobs.length === 0}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="w-3.5 h-3.5" />
          {analysing ? 'Analysing...' : 'AI Analyse'}
        </button>

        {uploadedSource && !results && (
          <span className="text-xs text-green-600 font-medium italic">
            {jobs.length} jobs loaded from file
          </span>
        )}
        {results && (
          <span className="text-xs text-green-700 uppercase tracking-widest font-bold">
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
        onApply={handleApplyClick}
        page={page}
        totalPages={totalPages}
        onPageChange={p => fetchJobs(p)}
        filterApplied={filterApplied}
        onFilterChange={setFilterApplied}
      />

      {/* ── Upload Jobs Modal ── */}
      {showUploadJobs && (
        <UploadJobsModal
          onClose={() => setShowUploadJobs(false)}
          onLoad={handleJobsUploaded}
        />
      )}

      {/* ── Resume Preview Modal ── */}
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
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-green-700 hover:text-green-900 px-2.5 py-1 border border-green-200 rounded hover:bg-green-50"
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

      {/* ── Apply Confirmation Popup ── */}
      {applyConfirmJob && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-green-200 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-green-100">
              <h3 className="text-xs font-bold uppercase tracking-widest text-green-800">Confirm Application</h3>
              <button onClick={() => setApplyConfirmJob(null)} className="text-green-400 hover:text-green-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-green-900 font-medium mb-1">
                Did you apply to this job?
              </p>
              <p className="text-xs text-green-600 mb-5">
                <span className="font-semibold">{applyConfirmJob.title}</span> at <span className="font-semibold">{applyConfirmJob.company}</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleConfirmApply(false)}
                  className="flex-1 text-[10px] font-bold uppercase tracking-widest py-2.5 rounded border border-green-300 text-green-700 hover:bg-green-50"
                >
                  No, Not Yet
                </button>
                <button
                  onClick={() => handleConfirmApply(true)}
                  className="flex-1 text-[10px] font-bold uppercase tracking-widest py-2.5 rounded bg-green-700 text-white hover:bg-green-800"
                >
                  Yes, Applied!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
