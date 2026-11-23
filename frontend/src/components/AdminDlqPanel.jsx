import React, { useState, useEffect } from 'react';
import { api } from '../api.js';
import {
  AlertTriangle,
  RotateCcw,
  Activity,
  Layers,
  Database,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export const AdminDlqPanel = ({ onInspectError }) => {
  const [dlqJobs, setDlqJobs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requeueingId, setRequeueingId] = useState(null);
  const [message, setMessage] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dlqRes, metricsRes] = await Promise.all([
        api.getDlqJobs(),
        api.getMetrics().catch(() => null),
      ]);

      if (dlqRes.success) {
        setDlqJobs(dlqRes.data || []);
      }
      if (metricsRes?.success) {
        setMetrics(metricsRes);
      }
    } catch (err) {
      console.error('Failed to load DLQ data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRequeue = async (jobId) => {
    setRequeueingId(jobId);
    setMessage(null);
    try {
      const res = await api.requeueJob(jobId, true);
      if (res.success) {
        setMessage({
          type: 'success',
          text: `Task #${jobId} successfully re-enqueued as #${res.newJobId}!`,
        });
        await fetchData();
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to re-queue task',
      });
    } finally {
      setRequeueingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span className="p-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </span>
            Dead-Letter Queue (DLQ) & Concurrency Telemetry
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Poison pill isolation and retry recovery for exhausted asynchronous tasks
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {/* Metrics Grid */}
      {metrics?.bullmq && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Active in Workers</span>
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-indigo-400">
              {metrics.bullmq.taskQueue?.active || 0}
            </div>
            <span className="text-[10px] text-slate-400">Concurrency cap: 5</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Waiting in Queue</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400">
              {metrics.bullmq.taskQueue?.waiting || 0}
            </div>
            <span className="text-[10px] text-slate-400">Scheduled backoff retries</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Completed (24h)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {metrics.bullmq.taskQueue?.completed || 0}
            </div>
            <span className="text-[10px] text-slate-400">Durable cache</span>
          </div>

          <div className="bg-slate-900 border border-rose-500/30 p-4 rounded-xl bg-rose-500/5">
            <div className="flex items-center justify-between text-xs text-rose-300 mb-1">
              <span>DLQ Poison Pills</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-400">
              {dlqJobs.length}
            </div>
            <span className="text-[10px] text-rose-400/80">Exhausted 3 retries</span>
          </div>
        </div>
      )}

      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* DLQ Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <h3 className="font-semibold text-slate-100 text-sm">Quarantined DLQ Tasks</h3>
          <p className="text-xs text-slate-400">Jobs that exceeded max retry attempts (2s, 4s, 8s backoff)</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="px-6 py-3">Task & Job ID</th>
                <th className="px-4 py-3">Failure Reason</th>
                <th className="px-4 py-3">Attempts Made</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Failed At</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-rose-400" />
                    Fetching DLQ records...
                  </td>
                </tr>
              ) : dlqJobs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                    Dead-Letter Queue is currently empty. All background tasks healthy!
                  </td>
                </tr>
              ) : (
                dlqJobs.map((job) => (
                  <tr key={job._id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-slate-200">{job.title}</div>
                      <div className="text-[10px] font-mono text-slate-400">#{job.jobId}</div>
                    </td>
                    <td className="px-4 py-3.5 max-w-sm">
                      <div className="text-rose-400 font-mono text-[11px] truncate">
                        {job.errorDetails?.message || job.stage}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono">
                      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                        {job.errorDetails?.attemptsMade || 3}/3 Attempts
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">
                      {job.userId?.email || 'N/A'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400">
                      {new Date(job.updatedAt).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onInspectError(job)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition"
                        >
                          Diagnostics
                        </button>
                        <button
                          onClick={() => handleRequeue(job.jobId)}
                          disabled={requeueingId === job.jobId}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md font-semibold flex items-center gap-1 shadow-sm transition"
                        >
                          {requeueingId === job.jobId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Re-queue
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

