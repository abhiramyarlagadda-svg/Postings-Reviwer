import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function JobsView() {
  const { token, logout } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fetchingGalaxy, setFetchingGalaxy] = useState(false);
  
  const [previewJobs, setPreviewJobs] = useState<any[] | null>(null);

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setJobs(Array.isArray(data) ? data : []);
      } else {
        setJobs([]);
      }
    } catch (e) {
      setJobs([]);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/jobs/preview', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      } else {
        const data = await res.json();
        setPreviewJobs(data.preview);
      }
    } catch (e: any) {
      alert(`Network error: ${e.message}`);
    }
    setUploading(false);
    // Reset file input
    e.target.value = '';
  };

  const handleProceed = async () => {
    if (!previewJobs) return;
    setUploading(true);
    try {
      const res = await fetch('/api/jobs/bulk', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ jobs: previewJobs })
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        alert("Failed to store jobs.");
      } else {
        setPreviewJobs(null);
        fetchJobs();
      }
    } catch (e) {
      alert("Error storing jobs.");
    }
    setUploading(false);
  };

  const handleCancelPreview = () => {
    setPreviewJobs(null);
  };

  const handleGalaxyFetch = async () => {
    setFetchingGalaxy(true);
    try {
      const res = await fetch('/api/jobs/galaxy', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        logout();
        return;
      }
      fetchJobs();
    } catch (e) {
      alert("Failed to fetch Galaxy jobs");
    }
    setFetchingGalaxy(false);
  };

  return (
    <>
      <aside className="w-64 shrink-0 flex flex-col gap-4 overflow-y-auto pb-4">
        <div className="bg-white border-2 border-green-200 p-4 rounded-lg shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-widest text-green-600 mb-4">Ingestion Engine</h2>
          <div className="space-y-4">
            <div className="relative">
              <input type="file" accept=".xlsx,.xls,.csv,.pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" disabled={uploading || previewJobs !== null} title="Upload Excel, CSV, or PDF" />
              <Button variant="dashed" className="w-full flex items-center justify-center gap-2" disabled={uploading || previewJobs !== null}>
                {uploading ? 'ANALYZING DOCUMENT...' : 'UPLOAD EXCEL / CSV / PDF'}
              </Button>
            </div>
            
            <div 
               className={cn("p-3 border-2 border-green-200 rounded-lg bg-green-50 transition-colors flex flex-col justify-center gap-2 relative overflow-hidden", previewJobs ? "opacity-50 cursor-not-allowed" : "hover:bg-green-100 cursor-pointer")}
               onClick={previewJobs ? undefined : handleGalaxyFetch}
            >
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", fetchingGalaxy ? "bg-yellow-500 animate-pulse" : "bg-green-500")}></div>
                <span className="text-xs font-bold uppercase tracking-widest text-green-800 z-10">
                   {fetchingGalaxy ? 'SYNCING GALAXY...' : 'SYNC GALAXY API'}
                </span>
              </div>
              <p className="text-[10px] text-green-600 tracking-wider">Automated Daily Refresh</p>
            </div>
          </div>
        </div>

        <div className="mt-auto p-4 bg-green-800 text-white rounded-lg shadow-sm border-2 border-green-900 border-opacity-20 shrink-0">
          <p className="text-[10px] uppercase tracking-widest opacity-70 mb-1">Database Size</p>
          <p className="text-sm font-medium italic">{jobs.length} valid opportunities</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-white border-2 border-green-200 rounded-lg shadow-sm overflow-hidden min-w-0">
        <div className="p-4 md:p-6 border-b-2 border-green-50 flex justify-between items-center bg-white shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight text-green-900 uppercase">
              {previewJobs ? 'Data Ingestion Preview' : 'Job Database Pool'}
            </h2>
          </div>
          {previewJobs && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={handleCancelPreview} disabled={uploading}>CANCEL</Button>
              <Button variant="default" onClick={handleProceed} disabled={uploading}>
                {uploading ? 'SAVING...' : 'PROCEED TO SAVE'}
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-white relative">
          <AnimatePresence mode="wait">
             {previewJobs ? (
                <motion.div 
                  key="preview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full"
                >
                  <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-yellow-50 text-yellow-800 sticky top-0 z-10 shadow-sm border-b-2 border-yellow-200">
                      <tr>
                        <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider">Parsed Title</th>
                        <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider">Parsed Entity</th>
                        <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider">Location</th>
                        <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider">Source Vector</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-yellow-100/50">
                       {previewJobs.map((job, i) => (
                          <motion.tr 
                            initial={{ opacity: 0, x: -10 }} 
                            animate={{ opacity: 1, x: 0 }} 
                            transition={{ delay: i * 0.05 }}
                            key={i} 
                            className="bg-yellow-50/20 hover:bg-yellow-50/50"
                          >
                            <td className="py-4 px-4 font-bold text-yellow-900">{job.title}</td>
                            <td className="py-4 px-4 italic text-yellow-800 font-medium">{job.company}</td>
                            <td className="py-4 px-4 text-yellow-800 text-xs font-bold">{job.location}</td>
                            <td className="py-4 px-4">
                               <span className="bg-white text-yellow-800 border items-center inline-block border-yellow-200 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-widest leading-none shadow-sm">{job.source}</span>
                            </td>
                          </motion.tr>
                       ))}
                    </tbody>
                  </table>
                </motion.div>
             ) : (
                <motion.table 
                  key="main"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full text-left min-w-[600px]"
                >
                  <thead className="bg-green-50 text-green-700 sticky top-0 z-10 shadow-sm">
                    <tr className="border-b border-green-100">
                      <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider">Job Title / Role</th>
                      <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider">Entity</th>
                      <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider">Location</th>
                      <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider">Source Vector</th>
                      <th className="py-3 px-4 text-[10px] uppercase font-bold tracking-wider text-right">Acquisition Date</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-green-50">
                     {jobs.length === 0 ? (
                       <tr>
                          <td colSpan={5} className="py-12 text-center">
                             <p className="text-green-600 font-medium text-xs uppercase tracking-widest">No entries found. Awaiting ingestion.</p>
                          </td>
                       </tr>
                     ) : (
                       jobs.sort((a,b)=>new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((job, i) => (
                          <tr key={job.id} className={i % 2 === 0 ? "bg-green-100/30 hover:bg-green-100/50" : "bg-white hover:bg-green-50/50"}>
                            <td className="py-4 px-4 font-bold text-green-900">{job.title}</td>
                            <td className="py-4 px-4 italic text-green-800 font-medium">{job.company}</td>
                            <td className="py-4 px-4 text-green-800 text-xs font-bold">{job.location}</td>
                            <td className="py-4 px-4">
                               <span className="bg-white text-green-800 border-2 border-green-200 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-widest leading-none block w-max shadow-sm">{job.source}</span>
                            </td>
                            <td className="py-4 px-4 text-green-600 text-[10px] font-bold tracking-widest uppercase text-right">{new Date(job.createdAt).toLocaleDateString()}</td>
                          </tr>
                       ))
                     )}
                  </tbody>
                </motion.table>
             )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}
