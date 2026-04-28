import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Job, JobResult } from '@/src/lib/aiEngine';

interface Props {
  results: JobResult[] | null;
  jobs: Job[];
  loading: boolean;
  appliedJobIds: Set<string>;
  onApply: (job: Job) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  filterApplied: 'all' | 'applied' | 'not_applied';
  onFilterChange: (f: 'all' | 'applied' | 'not_applied') => void;
}

export default function JobTable({
  results, jobs, loading, appliedJobIds, onApply,
  page, totalPages, onPageChange, filterApplied, onFilterChange
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const analysed = !!results;

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const passesFilter = (jobId: string) => {
    if (filterApplied === 'applied') return appliedJobIds.has(jobId);
    if (filterApplied === 'not_applied') return !appliedJobIds.has(jobId);
    return true;
  };

  const items: (JobResult | { job: Job })[] = analysed
    ? results!.filter(r => passesFilter(r.job.id))
    : jobs.filter(j => passesFilter(j.id)).map(j => ({ job: j }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        {(['all', 'applied', 'not_applied'] as const).map(f => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded transition-colors ${
              filterApplied === f
                ? 'bg-green-700 text-white'
                : 'bg-white text-green-700 border border-green-200 hover:bg-green-50'
            }`}
          >
            {f === 'all' ? 'All' : f === 'applied' ? 'Applied' : 'Not Applied'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto bg-white border border-green-100 rounded">
        {loading ? (
          <div className="p-10 text-center text-green-500 text-xs">Loading jobs...</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-green-400 text-xs">No jobs to show</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-green-50 sticky top-0 z-10">
              <tr className="text-left">
                <th className="px-3 py-2.5 font-bold text-green-800 uppercase tracking-wider text-[10px]">Title</th>
                <th className="px-3 py-2.5 font-bold text-green-800 uppercase tracking-wider text-[10px]">Company</th>
                <th className="px-3 py-2.5 font-bold text-green-800 uppercase tracking-wider text-[10px]">Location</th>
                <th className="px-3 py-2.5 font-bold text-green-800 uppercase tracking-wider text-[10px]">Posted</th>
                {analysed && (
                  <>
                    <th className="px-3 py-2.5 font-bold text-green-800 uppercase tracking-wider text-[10px]">Score</th>
                    <th className="px-3 py-2.5 font-bold text-green-800 uppercase tracking-wider text-[10px]">Status</th>
                  </>
                )}
                <th className="px-3 py-2.5 font-bold text-green-800 uppercase tracking-wider text-[10px]">Apply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-50">
              {items.map(item => {
                const r = item as JobResult;
                const j = item.job;
                const isApplied = appliedJobIds.has(j.id);
                const isExpanded = expanded.has(j.id);

                return (
                  <React.Fragment key={j.id}>
                    <tr className="hover:bg-green-50/40">
                      <td className="px-3 py-2.5 text-green-900 font-medium">
                        {j.url ? (
                          <a href={j.url} target="_blank" rel="noreferrer" className="hover:text-green-700 hover:underline">{j.title}</a>
                        ) : j.title}
                      </td>
                      <td className="px-3 py-2.5 text-green-700">{j.company}</td>
                      <td className="px-3 py-2.5 text-green-600">{j.is_remote ? 'Remote' : (j.location || j.country || '-')}</td>
                      <td className="px-3 py-2.5 text-green-500 text-[11px]">
                        {j.posted_at ? new Date(j.posted_at).toLocaleDateString() : '-'}
                      </td>
                      {analysed && (
                        <>
                          <td className="px-3 py-2.5 font-bold text-green-800">{r.overallScore}%</td>
                          <td className="px-3 py-2.5">
                            {r.suitable ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 border border-green-300">
                                Relevant
                              </span>
                            ) : (
                              <button
                                onClick={() => toggle(j.id)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                              >
                                Not Suitable {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => !isApplied && onApply(j)}
                          disabled={isApplied}
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition-colors ${
                            isApplied
                              ? 'bg-green-50 text-green-600 cursor-default border border-green-200'
                              : 'bg-green-700 text-white hover:bg-green-800'
                          }`}
                        >
                          {isApplied ? 'Applied' : 'Apply'}
                        </button>
                      </td>
                    </tr>
                    {analysed && isExpanded && r.reasons.length > 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-2.5 bg-red-50/40 border-t border-red-100">
                          <ul className="text-[11px] text-red-700 space-y-1">
                            {r.reasons.map((reason, i) => (
                              <li key={i}>• {reason}</li>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3">
          <span className="text-[10px] text-green-600 uppercase tracking-widest">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded border border-green-200 text-green-700 disabled:opacity-40 hover:bg-green-50"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded border border-green-200 text-green-700 disabled:opacity-40 hover:bg-green-50"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
