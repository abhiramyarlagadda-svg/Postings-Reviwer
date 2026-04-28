import React, { useState } from 'react';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/src/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';

export function MatchResults({ results, candidate, jobs, isMatching }: { results: any[], candidate: any, jobs: any[], isMatching?: boolean }) {
  const { token, logout } = useAuth();
  const [applying, setApplying] = useState<Record<string, boolean>>({});
  const [applied, setApplied] = useState<Record<string, boolean>>({});

  const handleApply = async (jobId: string) => {
    setApplying(p => ({ ...p, [jobId]: true }));
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ jobId, candidateId: candidate.id })
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        setApplied(p => ({ ...p, [jobId]: true }));
      } else {
        const err = await res.json();
        alert(err.error);
        if (err.error === 'Already applied') setApplied(p => ({ ...p, [jobId]: true }));
      }
    } catch (e) {
      console.error(e);
    }
    setApplying(p => ({ ...p, [jobId]: false }));
  };

  const enrichedResults = results.map(r => {
    const job = jobs.find(j => j.id === r.jobId);
    return { ...r, job };
  }).filter(r => r.job).sort((a, b) => b.overallMatchScore - a.overallMatchScore);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border-2 border-green-200 rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b-2 border-green-50 flex justify-between items-center bg-white shrink-0">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-green-900 border-l-4 border-green-700 pl-3">Top AI Recommendations</h2>
        </div>
      </div>

      <div className="flex-1 overflow-auto overflow-x-hidden">
        <table className="w-full text-left min-w-[600px] table-fixed">
          <thead className="bg-green-50 text-green-700 sticky top-0 z-10 block w-full">
            <tr className="border-b border-green-100 flex w-full">
              <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider flex-1">Role / Company</th>
              <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider text-center w-24">Score</th>
              <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider hidden sm:flex flex-1">AI Reasoning Snapshot</th>
              <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider text-right w-36">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-green-50 block w-full">
            <AnimatePresence>
              {enrichedResults.slice(0, 10).map((r, i) => (
                <motion.tr 
                  layout
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, layout: { type: "spring", bounce: 0.2 } }}
                  key={r.jobId} 
                  className={cn("flex w-full", i % 2 === 0 ? "bg-green-100/30 hover:bg-green-100/50 transition-colors" : "bg-white hover:bg-green-50/50 transition-colors")}
                >
                  <td className="py-4 px-4 align-top flex-1">
                    <p className="font-bold text-green-900 mb-1">{r.job.title}</p>
                    <p className="text-xs text-green-700 font-medium italic">{r.job.company} • {r.job.location}</p>
                  </td>
                  <td className="py-4 px-4 text-center font-black text-2xl text-green-700 align-top w-24">
                    {r.overallMatchScore}<span className="text-sm text-green-500 ml-0.5 opacity-70">%</span>
                  </td>
                  <td className="py-4 px-4 text-xs align-top hidden sm:block flex-1">
                    <div className="bg-white border-2 border-green-100 p-3 rounded-md text-green-800 leading-relaxed shadow-sm">
                       <span className="font-bold uppercase tracking-wide border-b border-green-200 pb-0.5 block mb-1.5" style={{ 
                          color: r.suitability === 'Highly Suitable' ? '#15803d' : r.suitability === 'Moderately Suitable' ? '#b45309' : '#b91c1c' 
                        }}>{r.suitability}</span>
                       {r.reason}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right align-top w-36">
                    <Button 
                      onClick={() => handleApply(r.jobId)} 
                      disabled={applying[r.jobId] || applied[r.jobId]}
                      variant={applied[r.jobId] ? 'secondary' : 'default'}
                      className="w-full shadow-sm"
                    >
                      {applied[r.jobId] ? 'APPLIED ✓' : applying[r.jobId] ? 'SYNCING...' : 'APPLY NOW'}
                    </Button>
                  </td>
                </motion.tr>
              ))}
              {isMatching && (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex w-full bg-green-50/50"
                  key="loading-indicator"
                >
                  <td colSpan={4} className="py-8 px-4 flex-1 flex flex-col items-center justify-center">
                    <div className="flex items-center gap-4">
                      <div className="relative w-8 h-8">
                        <div className="absolute inset-0 border-2 border-green-200 rounded-full"></div>
                        <div className="absolute inset-0 border-2 border-green-600 rounded-full border-t-transparent animate-spin"></div>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-green-700 animate-pulse">Buffering next match...</span>
                    </div>
                  </td>
                </motion.tr>
              )}
              {enrichedResults.length === 0 && !isMatching && (
                <tr className="flex w-full">
                  <td colSpan={4} className="py-12 px-4 flex-1 text-center text-xs font-bold uppercase tracking-widest text-green-600">
                    No matching jobs found.
                  </td>
                </tr>
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      <div className="h-10 border-t-2 border-green-100 bg-green-50 flex items-center px-6 justify-between text-[10px] font-bold uppercase tracking-widest text-green-700 shrink-0">
        <div className="flex gap-6">
          <span>Top {Math.min(enrichedResults.length, 10)} Matches</span>
        </div>
        <div className="flex gap-3 items-center">
          {isMatching ? (
             <>
               <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
               <span>Engine Processing</span>
             </>
          ) : (
             <>
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
               <span>Analysis Complete</span>
             </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Add simple cn helper inside this file or import it
import { cn } from '@/src/lib/utils';
