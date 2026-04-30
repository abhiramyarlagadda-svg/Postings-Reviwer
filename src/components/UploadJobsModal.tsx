import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, RotateCcw } from 'lucide-react';
import type { Job } from '@/src/lib/aiEngine';

interface Props {
  onClose: () => void;
  onLoad: (jobs: Job[]) => void;
}

function parseDate(val: any): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val.toISOString();
  const s = String(val).trim();
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[\s_\-/]+/g, '');
}

// Returns the value for first matching alias key from the row object
function get(row: Record<string, any>, ...aliases: string[]): string {
  const normRow: Record<string, any> = {};
  for (const k of Object.keys(row)) normRow[normalizeKey(k)] = row[k];

  for (const alias of aliases) {
    const v = normRow[normalizeKey(alias)];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function parseRow(row: Record<string, any>, index: number): Job | null {
  // Title: support "title", "role", "job title", "job role", "position"
  const title = get(row, 'title', 'role', 'jobtitle', 'jobrole', 'position', 'jobposition');
  if (!title) return null;

  const company = get(row, 'company', 'companyname', 'employer', 'organisation', 'organization', 'hiringcompany');
  const location = get(row, 'location', 'city', 'place', 'office', 'joblocation');
  const country = get(row, 'country');
  const description = get(row, 'description', 'jobdescription', 'summary', 'details', 'jobdetails');
  const experience_level = get(row, 'experiencelevel', 'experience', 'seniority', 'level', 'expLevel');
  const urlRaw = get(row, 'url', 'applylink', 'link', 'joburl', 'applyurl', 'applicationlink', 'joblink', 'applyhere');

  const rawSkills = get(row, 'skills', 'requiredskills', 'technologies', 'techstack', 'techskills');
  const skills = rawSkills ? rawSkills.split(/[,;|]/).map((s: string) => s.trim()).filter(Boolean) : [];

  const remoteRaw = get(row, 'isremote', 'remote').toLowerCase();
  const is_remote = remoteRaw === 'true' || remoteRaw === 'yes' || remoteRaw === '1';

  // Date: raw value may be Date object (cellDates:true), string, or number
  const dateRawKey = ['postedat', 'date', 'dateposted', 'postingdate', 'posted'];
  let postedRaw: any = '';
  const normRow: Record<string, any> = {};
  for (const k of Object.keys(row)) normRow[normalizeKey(k)] = row[k];
  for (const k of dateRawKey) { if (normRow[k] !== undefined && normRow[k] !== null) { postedRaw = normRow[k]; break; } }

  const posted_at = parseDate(postedRaw);

  return {
    id: `upload_${Date.now()}_${index}`,
    title,
    company,
    location,
    country,
    description,
    experience_level,
    url: urlRaw,
    skills,
    is_remote,
    posted_at,
  };
}

// Scan first 5 rows to find the row that looks like column headers
function detectHeaderRow(rawRows: any[][]): number {
  const signals = ['title', 'role', 'company', 'date', 'url', 'position', 'name', 'location', 'status'];
  for (let i = 0; i < Math.min(rawRows.length, 6); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;
    const cells = row.map(c => String(c ?? '').toLowerCase().trim());
    const hits = signals.filter(s => cells.some(cell => cell.includes(s)));
    if (hits.length >= 2) return i;
  }
  return 0;
}

export default function UploadJobsModal({ onClose, onLoad }: Props) {
  const [preview, setPreview] = useState<Job[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);

  const processFile = (file: File) => {
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        // Get all rows as arrays first so we can detect the real header row
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rawRows.length < 2) {
          setError('File appears to be empty or has only one row.');
          return;
        }

        const headerIdx = detectHeaderRow(rawRows);
        const headers = rawRows[headerIdx].map((h: any) => String(h ?? '').trim());
        setDetectedHeaders(headers.filter(Boolean));

        const dataRows = rawRows.slice(headerIdx + 1).filter(row =>
          row.some((cell: any) => cell !== '' && cell !== null && cell !== undefined)
        );

        // Build keyed objects
        const objects: Record<string, any>[] = dataRows.map(row => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
          return obj;
        });

        const jobs = objects.map((row, i) => parseRow(row, i)).filter((j): j is Job => j !== null);

        if (jobs.length === 0) {
          setError(
            `No valid jobs found. Detected columns: [${headers.filter(Boolean).join(', ')}]. ` +
            `Make sure there's a column for job title (e.g. "title", "role", "position") and ` +
            `the file has data rows below the headers.`
          );
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
    e.target.value = '';
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
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
            </label>

            {error && (
              <div className="w-full max-w-md text-xs text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded leading-relaxed">
                {error}
              </div>
            )}

            <div className="w-full max-w-md bg-green-50 border border-green-100 rounded p-4">
              <p className="text-xs font-bold text-green-800 mb-2 uppercase tracking-widest">Recognised column names (any format)</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-green-600">
                <span><span className="font-semibold text-green-800">title / role / position</span> — job title (required)</span>
                <span><span className="font-semibold text-green-800">company / company name</span> — employer</span>
                <span><span className="font-semibold text-green-800">date / posted at</span> — posting date</span>
                <span><span className="font-semibold text-green-800">url / apply link</span> — job link</span>
                <span><span className="font-semibold text-green-800">location / city</span> — city / office</span>
                <span><span className="font-semibold text-green-800">experience level</span> — seniority</span>
                <span><span className="font-semibold text-green-800">skills / tech stack</span> — comma-separated</span>
                <span><span className="font-semibold text-green-800">description</span> — job details</span>
              </div>
              <p className="text-xs text-green-500 mt-2 italic">
                Banner rows above headers (e.g. merged title rows) are automatically skipped.
              </p>
            </div>
          </div>

        ) : (
          <>
            <div className="flex items-center justify-between px-6 py-3 border-b border-green-100 bg-green-50/50 shrink-0">
              <div>
                <span className="text-sm font-semibold text-green-800">
                  {preview.length} jobs parsed from <span className="font-bold">{fileName}</span>
                </span>
                {detectedHeaders.length > 0 && (
                  <span className="ml-3 text-xs text-green-500">
                    Columns: {detectedHeaders.join(', ')}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setPreview(null); setFileName(''); setDetectedHeaders([]); }}
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
                    <th className="px-4 py-3">Posted</th>
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
                      <td className="px-4 py-3 text-xs text-green-500">
                        {job.posted_at ? new Date(job.posted_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {job.url ? (
                          <a href={job.url} target="_blank" rel="noreferrer" className="text-green-600 hover:underline truncate max-w-[140px] block">
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
                Review the jobs above then click "Load Jobs" to run AI analysis.
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
