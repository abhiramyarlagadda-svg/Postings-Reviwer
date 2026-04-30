import React from 'react';
import { Plus } from 'lucide-react';
import type { Candidate } from '@/src/lib/aiEngine';

interface Props {
  candidates: Candidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  loading: boolean;
}

export default function CandidateList({ candidates, selectedId, onSelect, onAdd, loading }: Props) {
  return (
    <aside className="w-full h-full bg-white border-r border-green-100 flex flex-col">
      <div className="px-4 py-3 border-b border-green-100 flex items-center justify-between bg-green-50/50">
        <h2 className="text-xs font-bold uppercase tracking-widest text-green-800">Candidates</h2>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-white bg-green-700 px-3 py-1.5 rounded hover:bg-green-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-6 text-center text-green-500 text-sm">Loading...</div>
        )}
        {!loading && candidates.length === 0 && (
          <div className="p-6 text-center text-green-400 text-sm">
            No candidates yet.<br />Click <span className="font-bold">+ Add</span> to begin.
          </div>
        )}
        {candidates.map(c => {
          const selected = selectedId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full text-left px-4 py-3.5 border-b border-green-50 transition-colors ${
                selected
                  ? 'bg-green-50 border-l-[3px] border-l-green-700'
                  : 'hover:bg-green-50/60 border-l-[3px] border-l-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm shrink-0 border border-green-200">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-green-900 truncate">{c.name}</p>
                  <p className="text-xs text-green-600 truncate mt-0.5">
                    {c.technology} · {c.country}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
