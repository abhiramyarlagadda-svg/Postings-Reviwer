import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, RotateCcw } from 'lucide-react';
import type { Job } from '@/src/lib/aiEngine';

interface Props {
  onClose: () => void;
  onLoad: (jobs: Job[]) => void;
}

function parseRow(row: Record<string, any>, index: number): Job | null {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const val = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
      if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
    }
    return '';
  };

  const title = get('title', 'Title', 'Job Title', 'JOB TITLE', 'Position', 'Role');
  if (!title) return null;

  const rawSkills = get('skills', 'Skills', 'Required Skills', 'Technologies', 'Tech Stack');
  const skills = rawSkills ? rawSkills.split(/[,;|]/).map(s => s.trim()).filter(Boolean) : [];

  const remoteRaw = get('is_remote', 'remote', 'Remote', 'Is Remote').toLowerCase();
  const is_remote = remoteRaw === 'true' || remoteRaw === 'yes' || remoteRaw === '1';

  const postedRaw = get('posted_at', 'Posted At', 'Date Posted', 'Date', 'Posted');
  let posted_at: string | undefined;
  if (postedRaw) {
    const d = new Date(postedRaw);
    posted_at = isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  return {
    id: `upload_${Date.now()}_${index}`,
    title,
    company:          get('company', 'Company', 'Company Name', 'Employer', 'Organisation'),
    location:         get('location', 'Location', 'City', 'Place', 'Office'),
    country:          get('country', 'Country'),
    description:      get('description', 'Description', 'Job Description', 'Summary', 'Details'),
    experience_level: get('experience_level', 'Experience Level', 'Experience', 'Seniority', 'Level'),
    url:              get('url', 'URL', 'Apply Link', 'Link', 'Job URL', 'Apply URL'),
    skills,
    is_remote,
    posted_at,
  };
}

export default function UploadJobsModal({ onClose, onLoad }: Props) {
  const [preview, setPreview] = useState<Job[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const processFile = (file: File) => {
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

        const jobs = rows.map((row, i) => parseRow(row, i)).filter((j): j is Job => j !== null);

        if (jobs.length === 0) {
          setError('No valid jobs found. Make sure your file has a "title" (or "Job Title") column.');
          return;
        }
        setPreview(jobs);
      } catch (err: any) {
        setError('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-green-200 w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-green-100 shrink-0">
          <h3 className="text-sm font-bold uppercase tracking-widest text-green-800 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Upload Jobs from Excel / CSV
          </h3>
          <button onClick={onClose} className="text-green-400 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!preview ? (
          /* ── Upload UI ── */
          <div className="flex flex-col items-center justify-center gap-5 p-10">
            <label
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`w-full max-w-md flex flex-col items-center gap-3 border-2 border-dashed rounded-lg px-8 py-12 cursor-pointer transition-colors ${
                dragOver ? 'border-green-500 bg-green-50' : 'border-green-300 hover:border-green-500 hover:bg-green-50'
              }`}
            >
              <Upload className="w-8 h-8 text-green-400" />
              <span className="text-sm font-bold text-green-700">Drop file here or click to browse</span>
              <span className="text-xs text-green-500">Accepts .xlsx, .xls, .csv</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </label>

            {error && (
              <div className="w-full max-w-md text-xs text-red-700 bg-red-50 border border-red-200 px-4 py-2 rounded">
                {error}
              </div>
            )}

            <div className="w-full max-w-md bg-green-50 border border-green-100 rounded p-4">
              <p className="text-xs font-bold text-green-800 mb-2 uppercase tracking-widest">Expected column names</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-green-600">
                <span><span className="font-semibold text-green-800">title</span> — job title (required)</span>
                <span><span className="font-semibold text-green-800">company</span> — employer name</span>
                <span><span className="font-semibold text-green-800">location</span> — city / office</span>
                <span><span className="font-semibold text-green-800">experience_level</span> — e.g. Senior</span>
                <span><span className="font-semibold text-green-800">skills</span> — comma-separated</span>
                <span><span className="font-semibold text-green-800">url</span> — apply link</span>
                <span><span className="font-semibold text-green-800">description</span> — job details</span>
                <span><span className="font-semibold text-green-800">is_remote</span> — true / false</span>
              </div>
            </div>
          </div>

        ) : (
          /* ── Preview UI ── */
          <>
            <div className="flex items-center justify-between px-6 py-3 border-b border-green-100 bg-green-50/50 shrink-0">
              <span className="text-sm font-semibold text-green-800">
                {preview.length} jobs parsed from <span className="font-bold">{fileName}</span>
              </span>
              <button
                onClick={() => { setPreview(null); setFileName(''); }}
                className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-800 font-medium"
              >
                <RotateCcw className="w-3 h-3" /> Upload different file
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="bg-green-50 sticky top-0 z-10">
                  <tr className="text-left text-xs font-bold text-green-800 uppercase tracking-wider">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Experience</th>
                    <th className="px-4 py-3">Skills</th>
                    <th className="px-4 py-3">Apply URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-50">
                  {preview.map((job, i) => (
                    <tr key={job.id} className="hover:bg-green-50/40">
                      <td className="px-4 py-3 text-xs text-green-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-900">{job.title}</td>
                      <td className="px-4 py-3 text-sm font-medium text-green-700">{job.company || '—'}</td>
                      <td className="px-4 py-3 text-sm text-green-600">
                        {job.is_remote ? 'Remote' : (job.location || job.country || '—')}
                      </td>
                      <td className="px-4 py-3 text-xs text-green-600">{job.experience_level || '—'}</td>
                      <td className="px-4 py-3 text-xs text-green-500 max-w-[200px] truncate">
                        {Array.isArray(job.skills) && job.skills.length > 0 ? job.skills.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {job.url ? (
                          <a href={job.url} target="_blank" rel="noreferrer" className="text-green-600 hover:underline truncate max-w-[120px] block">
                            {job.url}
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-green-100 shrink-0">
              <span className="text-xs text-green-500">
                Review the jobs above. Click "Load Jobs" to use them for AI analysis.
              </span>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="text-xs font-bold uppercase tracking-widest px-4 py-2 rounded border border-green-300 text-green-700 hover:bg-green-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { onLoad(preview); onClose(); }}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-5 py-2 rounded bg-green-700 text-white hover:bg-green-800"
                >
                  <Upload className="w-3.5 h-3.5" /> Load {preview.length} Jobs
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
