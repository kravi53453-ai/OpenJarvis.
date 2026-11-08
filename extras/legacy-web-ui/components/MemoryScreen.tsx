import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  HardDrive,
  Trash2,
  Search,
  Sparkles,
  Clock,
  Check,
} from 'lucide-react';
import { memoryService, MAX_MEMORY_BYTES } from '../services/memory';
import { MemoryRecord } from '../types/jarvis';

interface MemoryScreenProps {
  onBack: () => void;
}

export const MemoryScreen: React.FC<MemoryScreenProps> = ({ onBack }) => {
  const [sizeInBytes, setSizeInBytes] = useState<number>(0);
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);

  const refresh = () => {
    setSizeInBytes(memoryService.getSizeInBytes());
    setRecords(memoryService.getAll());
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all OpenJarvis persistent memory?')) {
      memoryService.clear();
      refresh();
      setSearchResult(null);
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResult(null);
      return;
    }
    const res = memoryService.search(searchQuery.trim());
    setSearchResult(res || 'Nothing found matching query in memory.');
  };

  const usedMB = sizeInBytes / (1024 * 1024);
  const usedGB = sizeInBytes / (1024 * 1024 * 1024);
  const progressPercent = Math.min(100, Math.max(0.1, (sizeInBytes / MAX_MEMORY_BYTES) * 100));

  return (
    <div className="w-full min-h-screen bg-[#020817] text-white p-6 md:p-8 flex flex-col max-w-2xl mx-auto">
      {/* Top Bar matching Page composable */}
      <div className="flex items-center gap-3 pb-4 border-b border-[#1E5BFF]/30">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Memory (1 GB)</span>
          </h2>
          <p className="text-xs text-[#22D3FF]">
            Long-term persistent context buffer
          </p>
        </div>
      </div>

      <div className="space-y-6 mt-6 flex-1 flex flex-col">
        {/* Storage Bar Card */}
        <div className="p-5 bg-[#0A1A3A] rounded-2xl border border-[#1E5BFF]/30 shadow-lg">
          <div className="flex items-center justify-between text-sm font-bold text-white mb-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#22D3FF]" />
              <span>
                {usedGB >= 0.01 ? `${usedGB.toFixed(3)} GB` : `${usedMB.toFixed(2)} MB`} / 1.00 GB
              </span>
            </div>
            <span className="text-xs text-[#22D3FF] font-mono">
              {progressPercent < 0.1 ? '<0.1' : progressPercent.toFixed(1)}% full
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-[#020817] rounded-full overflow-hidden border border-white/10 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-[#1E5BFF] to-[#22D3FF] rounded-full transition-all duration-500 shadow-[0_0_10px_#22D3FF]"
              style={{ width: `${Math.max(2, progressPercent)}%` }}
            />
          </div>

          <p className="text-xs text-[#9FB4D9] mt-3 leading-relaxed">
            Saari baatein text format me store hoti hain. Memory full hone par sabse purani aadhi baatein automatic prune ho jati hain.
          </p>
        </div>

        {/* Search Memory Bar */}
        <div className="p-4 bg-[#07122B] rounded-2xl border border-white/10">
          <h3 className="text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
            Search Memory Store
          </h3>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Query memory (e.g. coffee, preferences, Tony Stark)..."
                className="w-full bg-[#020817] border border-white/10 focus:border-[#22D3FF] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-[#1E5BFF] text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition-colors flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>
          </div>

          {searchResult && (
            <div className="mt-3 p-3 bg-black/40 rounded-xl border border-[#22D3FF]/30 text-xs font-mono text-cyan-200 whitespace-pre-wrap">
              {searchResult}
            </div>
          )}
        </div>

        {/* Live Memory Log Stream */}
        <div className="flex-1 flex flex-col bg-[#07122B] rounded-2xl border border-white/10 p-4 overflow-hidden">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Recorded Memories ({records.length})
            </span>
            <button
              onClick={handleClear}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear memory</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs">
            {records.length === 0 ? (
              <div className="text-slate-500 py-6 text-center">
                Abhi koi memory recorded nahi hai. OpenJarvis se baatein karein ya "Remember this..." kahein!
              </div>
            ) : (
              records.slice().reverse().map((rec) => (
                <div
                  key={rec.id}
                  className="p-2.5 rounded-xl bg-[#020817] border border-white/5 hover:border-[#1E5BFF]/30 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-slate-500">{rec.timestamp}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        rec.who === 'USER'
                          ? 'bg-blue-500/20 text-blue-400'
                          : rec.who === 'JARVIS'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {rec.who}
                    </span>
                  </div>
                  <p className="text-slate-200 leading-relaxed font-sans text-xs">
                    {rec.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
