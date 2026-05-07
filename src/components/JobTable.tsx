import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ExternalLink } from 'lucide-react';
import type { Job, JobResult } from '@/src/lib/aiEngine';

interface Props {
  results: JobResult[] | null;
  jobs: Job[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  filterApplied: 'all' | 'relevant' | 'not_suitable';
  onFilterChange: (f: 'all' | 'relevant' | 'not_suitable') => void;
}

export default function JobTable({
  results, jobs, loading,
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

  const relevantCount = analysed ? results!.filter(r => r.suitable).length : 0;
  const notSuitableCount = analysed ? results!.filter(r => !r.suitable).length : 0;
  const totalCount = analysed ? results!.length : 0;

  const items: (JobResult | { job: Job })[] = analysed
    ? results!.filter(r => {
        if (filterApplied === 'relevant') return r.suitable;
        if (filterApplied === 'not_suitable') return !r.suitable;
        return true;
      })
    : jobs.map(j => ({ job: j }));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filter tabs — only show after analysis */}
      {analysed && (
        <div className="flex items-center gap-2 mb-3">
          {([
            ['all', 'All', totalCount],
            ['relevant', 'Relevant', relevantCount],
            ['not_suitable', 'Not Suitable', notSuitableCount],
          ] as [typeof filterApplied, string, number][]).map(([f, label, count]) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded transition-colors ${
                filterApplied === f
                  ? 'bg-green-700 text-white'
                  : 'bg-white text-green-700 border border-green-200 hover:bg-green-50'
              }`}
            >
              {label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                filterApplied === f ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-white border border-green-100 rounded">
        {loading ? (
          <div className="p-10 text-center text-green-500 text-sm">Loading jobs...</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-green-400 text-sm">No jobs to show</div>
        ) : (
          <table className="w-full">
            <thead className="bg-green-50 sticky top-0 z-10">
              <tr className="text-left">
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Title</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Company</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Location</th>
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Posted</th>
                {analysed && (
                  <>
                    <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Score</th>
                    <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Status</th>
                  </>
                )}
                <th className="px-4 py-3 font-bold text-green-800 uppercase tracking-wider text-xs">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-50">
              {items.map(item => {
                const r = item as JobResult;
                const j = item.job;
                const isExpanded = expanded.has(j.id);

                return (
                  <React.Fragment key={j.id}>
                    <tr className="hover:bg-green-50/40">
                      <td className="px-4 py-3 text-green-900 font-semibold text-sm max-w-[260px]">
                        <span title={j.title}>{j.title}</span>
                      </td>
                      <td className="px-4 py-3 text-green-700 font-medium text-sm">{j.company}</td>
                      <td className="px-4 py-3 text-green-600 text-sm">
                        {j.is_remote ? 'Remote' : (() => {
                          const city = j.location ? j.location.split(',')[0].trim() : '';
                          const country = j.country || '';
                          if (city && country) return `${city}, ${country}`;
                          return city || country || '—';
                        })()}
                      </td>
                      <td className="px-4 py-3 text-green-500 text-xs">
                        {j.posted_at ? new Date(j.posted_at).toLocaleDateString() : '—'}
                      </td>
                      {analysed && (
                        <>
                          <td className="px-4 py-3 font-bold text-green-800 text-sm">{r.overallScore}%</td>
                          <td className="px-4 py-3">
                            {r.suitable ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-green-100 text-green-700 border border-green-300">
                                Relevant
                              </span>
                            ) : (
                              <button
                                onClick={() => toggle(j.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                              >
                                Not Suitable {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        {j.url ? (
                          <a
                            href={j.url}
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
                    {analysed && isExpanded && r.reasons.length > 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-3 bg-red-50/40 border-t border-red-100">
                          <ul className="text-xs text-red-700 space-y-1">
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

      {totalPages > 1 && !analysed && (
        <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
      )}
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 4) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 3) pages.push('...');
  pages.push(total);
  return pages;
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void; }) {
  const [jumpInput, setJumpInput] = useState('');
  const pageList = getPageNumbers(page, totalPages);

  const handleJump = () => {
    const n = parseInt(jumpInput);
    if (!isNaN(n) && n >= 1 && n <= totalPages) {
      onPageChange(n);
      setJumpInput('');
    }
  };

  return (
    <div className="flex items-center justify-between pt-3 flex-wrap gap-3">
      <span className="text-xs text-green-600 uppercase tracking-widest font-bold">
        Page {page} of {totalPages.toLocaleString()}
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          title="First page"
          className="p-1.5 rounded border border-green-200 text-green-700 disabled:opacity-40 hover:bg-green-50"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          title="Previous page"
          className="p-1.5 rounded border border-green-200 text-green-700 disabled:opacity-40 hover:bg-green-50"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {pageList.map((p, i) => (
          p === '...' ? (
            <span key={`dots-${i}`} className="px-2 text-green-400 text-xs">···</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[32px] px-2 py-1.5 rounded text-xs font-bold border transition-colors ${
                p === page
                  ? 'bg-green-700 text-white border-green-700'
                  : 'bg-white text-green-700 border-green-200 hover:bg-green-50'
              }`}
            >
              {p}
            </button>
          )
        ))}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          title="Next page"
          className="p-1.5 rounded border border-green-200 text-green-700 disabled:opacity-40 hover:bg-green-50"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          title="Last page"
          className="p-1.5 rounded border border-green-200 text-green-700 disabled:opacity-40 hover:bg-green-50"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-green-600 font-bold">Jump to</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={jumpInput}
          onChange={e => setJumpInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleJump(); }}
          placeholder={String(page)}
          className="w-16 text-xs text-center border border-green-200 rounded px-2 py-1.5 outline-none focus:border-green-500"
        />
        <button
          onClick={handleJump}
          disabled={!jumpInput}
          className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded bg-green-700 text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Go
        </button>
      </div>
    </div>
  );
}
