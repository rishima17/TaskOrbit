



import React, { useState } from 'react';
import { useJobSSE } from '../hooks/useJobSSE.js';
import { getAssetUrl } from '../api.js';
import {
  FileText,
  Mail,
  Send,
  Video,
  Database,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,

  
  
  
  
  
  
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Eye,
  Trash2,
} from 'lucide-react';

const JobCard = ({ job, onCompleted, onFailed, onPreviewAsset }) => {
  const [showLogs, setShowLogs] = useState(false);
  const { jobState, logs, isStreaming, connectionError } = useJobSSE(
    job.jobId,
    onCompleted,
    onFailed
  );

  const getIcon = (type) => {
    switch (type) {
      case 'PDF':
        return <FileText className="w-5 h-5 text-indigo-400" />;
      case 'EMAIL_BULK':
        return <Mail className="w-5 h-5 text-emerald-400" />;
      case 'WEBHOOK_SIMULATOR':
        return <Send className="w-5 h-5 text-sky-400" />;
      case 'VIDEO_TRANSCODE':
        return <Video className="w-5 h-5 text-purple-400" />;
      case 'CSV_ETL_PIPELINE':
        return <Database className="w-5 h-5 text-amber-400" />;
      default:
        return <FileText className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (jobState.status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Failed (DLQ)
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Queued
          </span>
        );
    }
  };

  const progressColor =
    jobState.status === 'completed'
      ? 'bg-emerald-500'
      : jobState.status === 'failed'
      ? 'bg-rose-500'
      : 'bg-indigo-500';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm transition hover:border-slate-700 space-y-4">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60">
            {getIcon(job.type)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-slate-100 text-sm">{job.title}</h4>
              <span className="text-[11px] font-mono text-slate-400">#{job.jobId.slice(0, 8)}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{jobState.stage}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {jobState.attemptsMade > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
              Attempt {jobState.attemptsMade}/3
            </span>
          )}
          {getStatusBadge()}
        </div>
      </div>

      {/* Dynamic Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
          <span className="text-slate-400 flex items-center gap-1.5">
            {isStreaming && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />}
            SSE Stream Telemetry
          </span>
          <span className="font-bold text-slate-200">{jobState.progress}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out rounded-full ${progressColor}`}
            style={{ width: `${jobState.progress}%` }}
          />
        </div>
      </div>

      {/* Completion Output Preview */}
      {jobState.status === 'completed' && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
          <div className="text-xs text-emerald-300">
            <span className="font-semibold">Output Asset Ready:</span> Generated Audit Document
          </div>
          <div className="flex items-center gap-2">
            {onPreviewAsset && (
              <button
                onClick={() => onPreviewAsset({ ...job, ...jobState })}
                className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <Eye className="w-3.5 h-3.5" /> Preview Asset
              </button>
            )}
            <a
              href={getAssetUrl(job.jobId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium underline shrink-0"
            >
              Full Tab <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Failure Info */}
      {jobState.status === 'failed' && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
          <span className="font-semibold">Failure Diagnostic:</span>{' '}
          {jobState.errorDetails?.failedReason || jobState.errorDetails?.message || 'Retries exhausted, relocated to DLQ'}
        </div>
      )}

      {/* Logs Drawer Toggle */}
      <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
        >
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <span>Real-Time Event Stream ({logs.length} events)</span>
          {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <span className="text-[11px] text-slate-400">
          Enqueued {new Date(job.createdAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Collapsible Real-Time Logs Terminal */}
      {showLogs && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[11px] max-h-40 overflow-y-auto space-y-1">
          {logs.length === 0 ? (
            <div className="text-slate-400">Waiting for events from BullMQ QueueEvents...</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-slate-300">
                <span className="text-slate-400 shrink-0">[{log.time}]</span>
                <span
                  className={
                    log.type === 'error'
                      ? 'text-rose-400 font-semibold'
                      : log.type === 'success'
                      ? 'text-emerald-400 font-semibold'
                      : log.type === 'progress'
                      ? 'text-indigo-300'
                      : 'text-slate-300'
                  }
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const ActiveJobsList = ({ activeJobs, onJobCompleted, onJobFailed, onClearFinished, onPreviewAsset }) => {
  if (!activeJobs || activeJobs.length === 0) {
    return (
      <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto mb-3 text-slate-400 border border-slate-700/40">
          <Terminal className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-slate-300">No Active Real-Time Tasks</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Dispatch a PDF, Video, ETL, Email Broadcast, or Webhook task above to observe live BullMQ execution and SSE streaming.
        </p>
      </div>
    );
  }

  const finishedCount = activeJobs.filter((j) => j.status === 'completed' || j.status === 'failed').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          Active Execution Monitor ({activeJobs.length})
        </h3>
        <div className="flex items-center gap-3">
          {finishedCount > 0 && onClearFinished && (
            <button
              onClick={onClearFinished}
              className="text-xs text-slate-400 hover:text-rose-300 flex items-center gap-1 transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear {finishedCount} Finished
            </button>
          )}
          <span className="text-xs text-slate-400">Live SSE EventStream Connected</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {activeJobs.map((job) => (
          <JobCard
            key={job.jobId}
            job={job}
            onCompleted={(res) => onJobCompleted(job.jobId, res)}
            onFailed={(err) => onJobFailed(job.jobId, err)}
            onPreviewAsset={onPreviewAsset}
          />
        ))}
      </div>
    </div>
  );
};

