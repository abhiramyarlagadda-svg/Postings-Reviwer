import React, { useState } from 'react';
import { useAuth } from '@/src/lib/AuthContext';
import { useNavigate } from 'react-router';
import CandidatesView from './CandidatesView';
import JobsView from './JobsView';
import ApplicationsView from './ApplicationsView';
import { cn } from '@/src/lib/utils';
import { Users, Briefcase, FileSignature, LogOut } from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'candidates' | 'jobs' | 'applications'>('candidates');
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="h-screen bg-green-50 text-green-900 font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-green-700 text-white flex items-center justify-between px-6 md:px-8 border-b-4 border-green-800 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-sm flex items-center justify-center shadow-inner">
            <div className="w-4 h-4 bg-green-700"></div>
          </div>
          <h1 className="text-xl font-bold tracking-tight hidden sm:block">POSTINGS REVIEWER <span className="font-light opacity-80 uppercase text-[10px] tracking-widest align-middle">| AI Engine</span></h1>
        </div>
        <nav className="flex gap-2 sm:gap-6 text-sm font-medium items-center">
          <button onClick={() => setActiveTab('candidates')} className={cn("transition-colors font-bold uppercase text-[10px] tracking-widest py-1.5 px-3 rounded-sm flex items-center gap-1.5", activeTab === 'candidates' ? "bg-green-800 text-white" : "hover:bg-green-800/50 hover:text-white")}>
             <Users className="w-3.5 h-3.5" /> Candidates
          </button>
          <button onClick={() => setActiveTab('jobs')} className={cn("transition-colors font-bold uppercase text-[10px] tracking-widest py-1.5 px-3 rounded-sm flex items-center gap-1.5", activeTab === 'jobs' ? "bg-green-800 text-white" : "hover:bg-green-800/50 hover:text-white")}>
             <Briefcase className="w-3.5 h-3.5" /> Job Pool
          </button>
          <button onClick={() => setActiveTab('applications')} className={cn("transition-colors font-bold uppercase text-[10px] tracking-widest py-1.5 px-3 rounded-sm flex items-center gap-1.5", activeTab === 'applications' ? "bg-green-800 text-white" : "hover:bg-green-800/50 hover:text-white")}>
             <FileSignature className="w-3.5 h-3.5" /> Applications
          </button>
          
          <div className="relative ml-2 sm:ml-4">
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold cursor-pointer shadow-sm border border-green-600 hover:bg-green-200 transition-colors"
            >
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </button>
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-10 w-48 bg-white border-2 border-green-200 rounded-lg shadow-lg z-50 text-green-900 overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-green-100 bg-green-50">
                    <p className="text-sm font-bold truncate">{user?.name || 'Demo User'}</p>
                    <p className="text-[10px] text-green-600 uppercase tracking-widest truncate">{user?.email || 'demo@example.com'}</p>
                  </div>
                  <button className="flex items-center gap-2 text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-red-600 hover:bg-green-100 transition-colors" onClick={handleLogout}>
                    <LogOut className="w-3 h-3" /> Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </nav>
      </header>

      <div className="flex-1 flex overflow-hidden p-4 md:p-6 gap-6 bg-green-50 relative z-0">
        {activeTab === 'candidates' && <CandidatesView />}
        {activeTab === 'jobs' && <JobsView />}
        {activeTab === 'applications' && <ApplicationsView />}
      </div>
    </div>
  );
}
