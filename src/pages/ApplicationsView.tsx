import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent } from '@/src/components/ui/card';

export default function ApplicationsView() {
  const { token, logout } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/applications', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('/api/candidates', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('/api/jobs', { headers: { 'Authorization': `Bearer ${token}` } })
    ]).then(responses => {
      if (responses.some(r => r.status === 401)) {
        logout();
        return Promise.reject('Unauthorized');
      }
      return Promise.all(responses.map(r => r.ok ? r.json() : []));
    }).then(([apps, cands, js]) => {
      setApplications(Array.isArray(apps) ? apps : []);
      setCandidates(Array.isArray(cands) ? cands : []);
      setJobs(Array.isArray(js) ? js : []);
    }).catch(err => {
      console.error(err);
      if (err !== 'Unauthorized') {
        setApplications([]);
      }
    });
  }, [token, logout]);

  const enrichedApps = applications.map(a => ({
    ...a,
    candidate: candidates.find(c => c.id === a.candidateId),
    job: jobs.find(j => j.id === a.jobId)
  })).filter(a => a.candidate && a.job).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <main className="flex-1 flex flex-col bg-white border-2 border-green-200 rounded-lg shadow-sm w-full mx-auto max-w-5xl">
      <div className="p-4 md:p-6 border-b-2 border-green-50 flex justify-between items-center bg-white shrink-0">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-tight text-green-900 border-l-4 border-green-700 pl-3">Application Pipeline</h2>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-green-50/30 p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {enrichedApps.length === 0 ? (
               <div className="col-span-full py-16 text-center text-green-600 font-bold uppercase tracking-widest text-xs border-2 border-dashed border-green-200 rounded-lg bg-white">
                 No application data found. Use Engine to run matches.
               </div>
             ) : (
               enrichedApps.map(app => (
                 <div key={app.id} className="bg-white border-2 border-green-200 p-5 rounded-lg shadow-sm hover:border-green-400 hover:shadow-md transition-all flex flex-col relative overflow-hidden group">
                     <div className="flex justify-between items-start mb-4">
                        <div className="bg-green-700 text-white text-[10px] uppercase font-bold px-2 py-1 rounded-sm shrink-0">
                           {app.status}
                        </div>
                        <span className="text-[10px] text-green-500 font-bold tracking-widest uppercase">{new Date(app.createdAt).toLocaleDateString()}</span>
                     </div>
                     
                     <div className="mb-4">
                        <p className="text-[10px] text-green-600 tracking-widest font-bold uppercase mb-1">CANDIDATE LOG</p>
                        <p className="font-black text-green-900 truncate leading-none mb-1">{app.candidate.name}</p>
                     </div>
                     
                     <div className="pt-4 border-t-2 border-green-50 mt-auto">
                        <p className="text-[10px] text-green-600 tracking-widest font-bold uppercase mb-1">TARGET ROLE</p>
                        <p className="font-bold text-sm text-green-800 leading-tight mb-1">{app.job.title}</p>
                        <p className="text-[10px] uppercase italic text-green-600 tracking-widest truncate">{app.job.company} • {app.job.location}</p>
                     </div>

                     <div className="absolute top-0 left-0 w-1 h-full bg-green-500 object-left group-hover:bg-green-600 transition-colors"></div>
                 </div>
               ))
             )}
          </div>
      </div>
    </main>
  );
}
