import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { matchJobs } from '@/src/lib/gemini';
import { MatchResults } from './MatchResults';
import { cn } from '@/src/lib/utils';

export default function CandidatesView() {
  const { token, logout } = useAuth();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [technology, setTechnology] = useState('React');
  const [country, setCountry] = useState('United States');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchCandidates = async () => {
    try {
      const res = await fetch('/api/candidates', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const validData = Array.isArray(data) ? data : [];
        setCandidates(validData);
        if (validData.length > 0 && !selectedCandidate) {
          setSelectedCandidate(validData[0]);
        }
      } else {
        setCandidates([]);
      }
    } catch (e) {
      setCandidates([]);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert('Resume is required');
    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('technology', technology);
    formData.append('country', country);
    formData.append('resume', file);

    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        const newCand = await res.json();
        setShowAdd(false);
        setName('');
        setEmail('');
        setTechnology('React');
        setCountry('United States');
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await fetchCandidates();
        setSelectedCandidate(newCand);
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (e: any) {
      alert(`Network error: ${e.message}`);
    }
  };

  return (
    <>
      {/* Sidebar */}
      <aside className="w-64 shrink-0 flex flex-col gap-4 overflow-y-auto pb-4">
         <div className="bg-white border-2 border-green-200 p-4 rounded-lg shadow-sm flex flex-col min-h-0 h-full">
            <h2 className="text-xs font-bold uppercase tracking-widest text-green-600 mb-3 shrink-0">Candidates Engine</h2>
            
            <Button 
               className="w-full shrink-0 mb-4" 
               onClick={() => { setShowAdd(true); setSelectedCandidate(null); }}
               variant={showAdd ? "outline" : "default"}
            >
              + ADD NEW LOG
            </Button>
            
            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
              {candidates.length === 0 && !showAdd && (
                <div className="text-center py-8 text-xs text-green-600 border border-dashed border-green-200 rounded p-4 font-medium uppercase tracking-widest">
                  No DB records
                </div>
              )}
              {candidates.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => { setSelectedCandidate(c); setShowAdd(false); }}
                  className={cn("p-3 border-2 rounded-lg cursor-pointer transition-all flex flex-col gap-2", selectedCandidate?.id === c.id ? "bg-green-50 border-green-400 shadow-sm" : "bg-white border-green-100 hover:border-green-300 hover:bg-green-50/50")}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-green-700 text-white flex items-center justify-center text-xs uppercase font-black shrink-0 shadow-sm">{c.name.substring(0,2)}</div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate text-green-900 leading-none">{c.name}</p>
                      <p className="text-[10px] text-green-600 uppercase font-bold tracking-widest truncate mt-1">{c.technology}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
         </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-white border-2 border-green-200 rounded-lg shadow-sm overflow-hidden min-w-0">
        {!showAdd && !selectedCandidate && (
           <div className="flex-1 flex items-center justify-center bg-green-50/30">
              <div className="text-center p-8 max-w-md">
                 <div className="w-16 h-16 mx-auto mb-4 bg-green-100 text-green-600 flex items-center justify-center rounded-lg border-2 border-green-200 rotate-12">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                 </div>
                 <h2 className="text-xl font-bold uppercase tracking-tight text-green-900 mb-2">Awaiting Selection</h2>
                 <p className="text-xs text-green-600 font-medium leading-relaxed">System standby. Select an existing record or provision a new candidate profile to initialize the analysis engine.</p>
              </div>
           </div>
        )}
        
        {showAdd && (
           <div className="flex-1 flex flex-col overflow-hidden">
             <div className="p-4 border-b-2 border-green-100 flex items-center bg-white shrink-0">
                <h2 className="text-lg font-bold">New Candidate Entry</h2>
             </div>
             <div className="p-6 md:p-8 flex-1 overflow-y-auto bg-green-50/20">
                <div className="max-w-xl">
                   <Card>
                      <CardContent className="pt-6">
                        <form onSubmit={handleAdd} className="space-y-5">
                          <div>
                            <Label>Full Name Identity</Label>
                            <Input required value={name} onChange={e => setName(e.target.value)} />
                          </div>
                          <div>
                            <Label>Contact Protocol (Email)</Label>
                            <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Primary Stack</Label>
                              <select 
                                className="flex h-10 w-full rounded-sm border-2 border-green-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-green-500 font-medium text-green-900"
                                value={technology} 
                                onChange={e => setTechnology(e.target.value)}
                              >
                                <option>React</option>
                                <option>Node.js</option>
                                <option>Python</option>
                                <option>Java</option>
                                <option>Go</option>
                                <option>TypeScript</option>
                              </select>
                            </div>
                            <div>
                              <Label>Geolocator</Label>
                              <select 
                                className="flex h-10 w-full rounded-sm border-2 border-green-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-green-500 font-medium text-green-900"
                                value={country} 
                                onChange={e => setCountry(e.target.value)}
                              >
                                <option>United States</option>
                                <option>United Kingdom</option>
                                <option>Canada</option>
                                <option>India</option>
                                <option>Australia</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <Label>Resume Source (PDF)</Label>
                            <Input ref={fileInputRef} type="file" required onChange={e => setFile(e.target.files?.[0] || null)} className="pt-1.5 focus-visible:border-green-200 text-green-700 font-bold" />
                          </div>
                          <div className="pt-2 border-t border-green-100 flex justify-end gap-3">
                             <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>CANCEL</Button>
                             <Button type="submit">INITIALIZE PROFILE</Button>
                          </div>
                        </form>
                      </CardContent>
                   </Card>
                </div>
             </div>
           </div>
        )}
        
        {selectedCandidate && !showAdd && (
           <CandidateDetail candidate={selectedCandidate} />
        )}
      </main>
    </>
  );
}

function CandidateDetail({ candidate }: { candidate: any }) {
  const { token, logout } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [matchResults, setMatchResults] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/jobs', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => {
      if (res.status === 401) {
        logout();
        return [];
      }
      return res.ok ? res.json() : [];
    }).then(setJobs).catch(() => setJobs([]));
    // Reset match results when candidate changes
    setMatchResults([]);
  }, [candidate.id, token, logout]);

  const handleMatch = async () => {
    setIsMatching(true);
    setMatchResults([]);
    try {
      // @ts-ignore
      const { streamMatchJobs } = await import('@/src/lib/gemini');
      const stream = streamMatchJobs(candidate.resumeText, jobs);
      
      for await (const partial of stream) {
         // Sort results by overallMatchScore descending and update state to show sequence
         const sorted = [...partial].sort((a, b) => b.overallMatchScore - a.overallMatchScore);
         setMatchResults(sorted);
      }
    } catch (e) {
      alert("Failed to run AI Engine.");
    }
    setIsMatching(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden w-full h-full">
      <div className="p-4 md:p-6 border-b-2 border-green-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white shrink-0 gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-green-900 mb-1">{candidate.name}</h2>
          <div className="flex items-center gap-3">
            <span className="text-[10px] bg-green-100 text-green-800 font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm">{candidate.technology}</span>
            <span className="text-[10px] text-green-600 font-bold uppercase tracking-widest">LOC: {candidate.country}</span>
          </div>
        </div>
        <div className="flex gap-3 items-center w-full sm:w-auto">
          {isMatching && <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse mr-1"></span>}
          <Button onClick={handleMatch} disabled={isMatching || jobs.length === 0} className="w-full sm:w-auto shadow-sm">
             {isMatching ? 'PROCESSING MATCHES...' : 'RUN AI MATCH ANALYSIS'}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto bg-green-50/50 p-4 md:p-6">
        {matchResults.length > 0 || isMatching ? (
          <MatchResults results={matchResults} candidate={candidate} jobs={jobs} isMatching={isMatching} />
        ) : (
           <div className="flex items-center justify-center p-8 lg:p-16 h-full min-h-[300px]">
             <div className="text-center bg-white border-2 border-green-200 p-8 rounded-lg max-w-sm shadow-sm">
               <h3 className="text-sm font-bold uppercase tracking-widest text-green-800 mb-2">Engine Idle</h3>
               <p className="text-xs text-green-600 font-medium leading-relaxed mb-6">Execute the AI match sequence to algorithmically compare this profile against {jobs.length} indexed job requirements.</p>
               {jobs.length === 0 && (
                 <p className="text-xs font-bold text-red-600 bg-red-50 p-3 rounded border border-red-200">System Warning: Database is empty. Go to Job Pool to populate data.</p>
               )}
             </div>
           </div>
        )}
      </div>
    </div>
  );
}
