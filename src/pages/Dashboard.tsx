import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/lib/AuthContext';
import { useNavigate } from 'react-router';
import { LogOut, X, Upload, Users, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import CandidateList from '@/src/components/CandidateList';
import CandidateDetail from '@/src/components/CandidateDetail';
import ApplicationsView from '@/src/components/ApplicationsView';
import type { Candidate } from '@/src/lib/aiEngine';

type View = 'candidates' | 'applications';

const TECHNOLOGIES = [
  'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'Go',
  'Ruby on Rails', 'PHP', 'TypeScript', 'C#', '.NET', 'Swift',
  'Kotlin', 'Rust', 'Data Science', 'Machine Learning', 'DevOps', 'Other'
];

const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'France', 'Netherlands', 'Singapore', 'UAE', 'Remote', 'Other'
];

function AddCandidateModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    name: '', email: '', technology: '', country: '',
    experience_years: '', companies_worked: ''
  });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { token } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('email', form.email);
      fd.append('technology', form.technology);
      fd.append('country', form.country);
      fd.append('experience_years', form.experience_years || '0');
      const companies = form.companies_worked.split(',').map(c => c.trim()).filter(Boolean);
      fd.append('companies_worked', JSON.stringify(companies));
      if (file) fd.append('resume', file);

      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add candidate');

      onAdded();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-green-200 w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-green-100">
          <h3 className="text-xs font-bold uppercase tracking-widest text-green-800">Add Candidate</h3>
          <button onClick={onClose} className="text-green-500 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-green-800 mb-1">Name *</label>
              <input
                required
                className="w-full border border-green-200 rounded px-2.5 py-1.5 text-xs text-green-900 focus:outline-none focus:border-green-600"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-green-800 mb-1">Email</label>
              <input
                type="email"
                className="w-full border border-green-200 rounded px-2.5 py-1.5 text-xs text-green-900 focus:outline-none focus:border-green-600"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-green-800 mb-1">Technology *</label>
              <select
                required
                className="w-full border border-green-200 rounded px-2.5 py-1.5 text-xs text-green-900 focus:outline-none focus:border-green-600 bg-white"
                value={form.technology}
                onChange={e => setForm(p => ({ ...p, technology: e.target.value }))}
              >
                <option value="">Select...</option>
                {TECHNOLOGIES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-green-800 mb-1">Country *</label>
              <select
                required
                className="w-full border border-green-200 rounded px-2.5 py-1.5 text-xs text-green-900 focus:outline-none focus:border-green-600 bg-white"
                value={form.country}
                onChange={e => setForm(p => ({ ...p, country: e.target.value }))}
              >
                <option value="">Select...</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-green-800 mb-1">Experience (years)</label>
            <input
              type="number"
              min="0"
              max="50"
              className="w-full border border-green-200 rounded px-2.5 py-1.5 text-xs text-green-900 focus:outline-none focus:border-green-600"
              value={form.experience_years}
              onChange={e => setForm(p => ({ ...p, experience_years: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-green-800 mb-1">Companies Worked (comma-separated)</label>
            <input
              className="w-full border border-green-200 rounded px-2.5 py-1.5 text-xs text-green-900 focus:outline-none focus:border-green-600"
              placeholder="e.g. Google, Meta, Amazon"
              value={form.companies_worked}
              onChange={e => setForm(p => ({ ...p, companies_worked: e.target.value }))}
            />
            <p className="text-[10px] text-green-500 mt-1">Used to skip jobs at companies the candidate already worked at.</p>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-green-800 mb-1">Resume</label>
            <label className="flex items-center gap-2 border border-dashed border-green-300 rounded px-3 py-2 cursor-pointer hover:bg-green-50 text-xs text-green-700">
              <Upload className="w-3.5 h-3.5" />
              <span className="truncate">{file ? file.name : 'Choose file (PDF / DOC / TXT)'}</span>
              <input
                type="file"
                accept=".pdf,.txt,.doc,.docx"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-[10px] font-bold uppercase tracking-widest py-2.5 rounded border border-green-300 text-green-700 hover:bg-green-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 text-[10px] font-bold uppercase tracking-widest py-2.5 rounded bg-green-700 text-white hover:bg-green-800 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('candidates');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [appsRevision, setAppsRevision] = useState(0);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/candidates', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setCandidates(data);
        if (!selectedId && data.length > 0) setSelectedId(data[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCandidates(); }, []);

  const handleLogout = () => { logout(); navigate('/'); };
  const selected = candidates.find(c => c.id === selectedId) || null;

  return (
    <div className="h-screen bg-green-50 flex flex-col overflow-hidden">
      <header className="h-14 bg-green-700 text-white flex items-center justify-between px-6 shrink-0 shadow z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white rounded flex items-center justify-center">
              <div className="w-3.5 h-3.5 bg-green-700" />
            </div>
            <span className="text-sm font-bold tracking-tight">POSTINGS REVIEWER</span>
          </div>
          {/* Nav tabs */}
          <div className="flex items-center gap-1 bg-green-800 rounded p-0.5">
            <button
              onClick={() => setView('candidates')}
              className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded transition-colors ${
                view === 'candidates' ? 'bg-white text-green-800' : 'text-green-200 hover:text-white'
              }`}
            >
              <Users className="w-3 h-3" /> Candidates
            </button>
            <button
              onClick={() => setView('applications')}
              className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded transition-colors ${
                view === 'applications' ? 'bg-white text-green-800' : 'text-green-200 hover:text-white'
              }`}
            >
              <FolderOpen className="w-3 h-3" /> Applications
            </button>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setProfileOpen(o => !o)}
            className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-sm flex items-center justify-center hover:bg-green-200 transition-colors border border-green-500"
          >
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </button>
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-10 w-52 bg-white border border-green-200 rounded shadow-lg z-50 overflow-hidden">
                <div className="p-3 border-b border-green-100 bg-green-50">
                  <p className="text-xs font-bold text-green-900 truncate">{user?.name}</p>
                  <p className="text-[10px] text-green-600 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-red-600 hover:bg-green-50"
                >
                  <LogOut className="w-3 h-3" /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {view === 'candidates' && (
          <div
            className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out ${
              sidebarOpen ? 'w-72' : 'w-0'
            }`}
          >
            <div className="w-72 h-full">
              <CandidateList
                candidates={candidates}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAdd={() => setShowAdd(true)}
                loading={loading}
              />
            </div>
          </div>
        )}

        {/* Floating tab-style toggle handle on the seam */}
        {view === 'candidates' && (
          <button
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Hide candidates' : 'Show candidates'}
            className={`group absolute top-1/2 -translate-y-1/2 z-30 transition-[left] duration-300 ease-in-out ${
              sidebarOpen ? 'left-72' : 'left-0'
            }`}
          >
            <span className="flex items-center justify-center w-5 h-16 bg-white border border-l-0 border-green-300 rounded-r-md shadow-md text-green-600 hover:w-6 hover:bg-green-700 hover:text-white hover:border-green-700 transition-all duration-200">
              {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
          </button>
        )}

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Candidates view stays mounted to preserve AI analysis results when switching tabs */}
          <div className={`flex-1 flex flex-col overflow-hidden ${view === 'candidates' ? '' : 'hidden'}`}>
            {selected ? (
              <CandidateDetail key={selected.id} candidate={selected} appsRevision={appsRevision} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-green-400 text-xs uppercase tracking-widest font-bold">
                {loading ? 'Loading...' : 'Select a candidate from the left to begin'}
              </div>
            )}
          </div>

          {/* Applications view remounts each visit so it always shows fresh DB state */}
          {view === 'applications' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <ApplicationsView onDeleted={() => setAppsRevision(r => r + 1)} />
            </div>
          )}
        </main>
      </div>

      {showAdd && (
        <AddCandidateModal
          onClose={() => setShowAdd(false)}
          onAdded={fetchCandidates}
        />
      )}
    </div>
  );
}
