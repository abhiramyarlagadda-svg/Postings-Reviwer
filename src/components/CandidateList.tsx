import React, { useState } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import type { Candidate } from '@/src/lib/aiEngine';

interface Props {
  candidates: Candidate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete?: (id: string) => void;
  loading: boolean;
}

export default function CandidateList({ candidates, selectedId, onSelect, onAdd, onDelete, loading }: Props) {
  const [search, setSearch] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const filtered = search.trim()
    ? candidates.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.technology.toLowerCase().includes(search.toLowerCase())
      )
    : candidates;

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmingId === id) {
      onDelete?.(id);
      setConfirmingId(null);
    } else {
      setConfirmingId(id);
    }
  };

  const cancelConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingId(null);
  };

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

      {/* Search */}
      <div className="px-3 py-2 border-b border-green-50">
        <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded px-2 py-1.5">
          <Search className="w-3 h-3 text-green-400 shrink-0" />
          <input
            type="text"
            placeholder="Search candidates..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs text-green-800 outline-none bg-transparent w-full placeholder:text-green-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-green-400 hover:text-green-700">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
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
        {!loading && candidates.length > 0 && filtered.length === 0 && (
          <div className="p-6 text-center text-green-400 text-sm">No candidates match your search.</div>
        )}
        {filtered.map(c => {
          const selected = selectedId === c.id;
          const confirming = confirmingId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => { setConfirmingId(null); onSelect(c.id); }}
              className={`w-full text-left px-4 py-3.5 border-b border-green-50 transition-colors group ${
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
                {onDelete && (
                  <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {confirming ? (
                      <>
                        <button
                          onClick={e => handleDelete(e, c.id)}
                          title="Confirm delete"
                          className="p-1 rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={cancelConfirm}
                          title="Cancel"
                          className="p-1 rounded text-green-500 hover:text-green-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={e => handleDelete(e, c.id)}
                        title="Delete candidate"
                        className="p-1 rounded text-green-300 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
