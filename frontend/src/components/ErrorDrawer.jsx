import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Copy,
  Check,
  Clock,
  Layers,
  RotateCcw,
} from 'lucide-react';

export const ErrorDrawer = ({ isOpen, onClose, job, onRequeue }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !job) return null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const errorDetails = job.errorDetails || {};

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100 text-sm">Failure Diagnostics & Stacktrace</h3>
                <span className="text-xs font-mono text-slate-400">Job #{job.jobId}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 flex-1 overflow-y-auto">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Retry Attempts</span>
                <span className="text-sm font-bold text-amber-400 font-mono">
                  {errorDetails.attemptsMade || job.retryCount || 3} / 3 Attempts Exhausted
                </span>
              </div>
              <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">DLQ Status</span>
                <span className="text-sm font-bold text-rose-400 font-mono">
                  {job.isDlq ? 'Relocated to DLQ' : 'Failed'}
                </span>
              </div>
            </div>

            {/* Error Message Banner */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Error Message</label>
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 font-mono text-xs break-all">
                {errorDetails.message || 'Worker task processing encountered an unhandled error.'}
              </div>
            </div>

            {/* Stack Trace */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Execution Stacktrace</label>
                <button
                  onClick={() => copyToClipboard(errorDetails.stack || errorDetails.message || '')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Stacktrace'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56 whitespace-pre-wrap leading-relaxed">
                {errorDetails.stack || 'No detailed stack trace available.'}
              </pre>
            </div>

            {/* Job Input Payload */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Original Task Payload</label>
              <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-indigo-300 overflow-x-auto">
                {JSON.stringify(job.payload || {}, null, 2)}
              </pre>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Failed At:{' '}
              {errorDetails.failedAt
                ? new Date(errorDetails.failedAt).toLocaleString()
                : new Date(job.updatedAt).toLocaleString()}
            </span>
            {onRequeue && (
              <button
                onClick={() => onRequeue(job.jobId)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Re-queue Task
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

