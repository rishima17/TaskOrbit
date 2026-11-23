import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  ChevronUp,
  ChevronDown,
  Trash2,
  Activity,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
} from 'lucide-react';

export const LiveTelemetryTerminal = ({ logs = [], activeCount = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [localLogs, setLocalLogs] = useState([]);
  const logsEndRef = useRef(null);

  // Sync incoming logs
  useEffect(() => {
    if (logs && logs.length > 0) {
      setLocalLogs((prev) => {
        // Merge without duplicates
        const existingIds = new Set(prev.map((l) => l.id));
        const newOnes = logs.filter((l) => !existingIds.has(l.id));
        return [...prev, ...newOnes].slice(-250); // Keep last 250 entries
      });
    }
  }, [logs]);

  useEffect(() => {
    if (autoScroll && isOpen) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [localLogs, autoScroll, isOpen]);

  const clearLogs = () => {
    setLocalLogs([]);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {/* Floating Toggle Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900/90 backdrop-blur-md border-t border-x border-slate-800 rounded-t-2xl shadow-2xl flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-white transition"
            >
              <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                <Terminal className="w-3.5 h-3.5" />
              </div>
              <span>Live BullMQ & SSE Telemetry</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700">
                {localLogs.length} events
              </span>
            </button>

            {/* Active Worker Status */}
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
              <span className={`w-2 h-2 rounded-full ${activeCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="text-slate-400 font-mono text-[11px]">
                Worker Load: <strong className="text-slate-200">{activeCount}/5</strong> Slots Active
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOpen && (
              <>
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-2 py-1 text-[11px] font-mono rounded border transition flex items-center gap-1 ${
                    autoScroll
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                  title={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
                >
                  {autoScroll ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span className="hidden md:inline">Auto-scroll</span>
                </button>

                <button
                  onClick={clearLogs}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                  title="Clear terminal logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Terminal Panel */}
      {isOpen && (
        <div className="bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 shadow-2xl h-64 overflow-y-auto font-mono text-xs p-4 space-y-1 max-w-7xl mx-auto border-x">
          {localLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              <div className="text-center">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <div>Awaiting real-time BullMQ queue events and SSE progress streams...</div>
                <div className="text-[11px] text-slate-600 mt-1">Dispatch a task or concurrency test above to see live streams.</div>
              </div>
            </div>
          ) : (
            localLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5 hover:bg-slate-900/60 p-0.5 rounded transition">
                <span className="text-slate-500 shrink-0 select-none">[{log.time}]</span>
                <span
                  className={`break-all ${
                    log.type === 'error'
                      ? 'text-rose-400 font-semibold'
                      : log.type === 'success'
                      ? 'text-emerald-400 font-semibold'
                      : log.type === 'progress'
                      ? 'text-indigo-300'
                      : log.type === 'active'
                      ? 'text-amber-300'
                      : 'text-slate-300'
                  }`}
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
};
