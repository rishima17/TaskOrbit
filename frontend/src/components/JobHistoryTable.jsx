import React, { useState, useMemo } from 'react';
import { getAssetUrl } from '../api.js';
import {
  FileText,
  Mail,
  Send,
  Video,
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ExternalLink,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Eye,
  RotateCw,
  Timer,
} from 'lucide-react';

export const JobHistoryTable = ({
  jobs,
  loading,
  pagination,
  onPageChange,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  onInspectError,
  onPreviewAsset,
  onRerunJob,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const getBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Loader2 className="w-3 h-3 animate-spin" /> In Progress
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'PDF':
        return <FileText className="w-4 h-4 text-indigo-400" />;
      case 'EMAIL_BULK':
        return <Mail className="w-4 h-4 text-emerald-400" />;
      case 'WEBHOOK_SIMULATOR':
        return <Send className="w-4 h-4 text-sky-400" />;
      case 'VIDEO_TRANSCODE':
        return <Video className="w-4 h-4 text-purple-400" />;
      case 'CSV_ETL_PIPELINE':
        return <Database className="w-4 h-4 text-amber-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const getDuration = (createdAt, updatedAt, status) => {
    if (status === 'pending') return '-';
    const diff = new Date(updatedAt) - new Date(createdAt);
    if (isNaN(diff) || diff < 0) return '0.5s';
    return `${(diff / 1000).toFixed(1)}s`;
  };

  // Filter jobs by search query
  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    const q = searchQuery.toLowerCase();
    return jobs.filter(
      (j) =>
        j.title?.toLowerCase().includes(q) ||
        j.jobId?.toLowerCase().includes(q) ||
        j.stage?.toLowerCase().includes(q) ||
        j.type?.toLowerCase().includes(q)
    );
  }, [jobs, searchQuery]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
      {/* Filters & Search Bar */}
      <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-950/40">
        <div>
          <h3 className="font-semibold text-slate-100 text-sm">Execution History & Audit Log</h3>
          <p className="text-xs text-slate-400">Durable database records of all queued and completed tasks</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-indigo-500 w-44 sm:w-52"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Types</option>
            <option value="PDF">PDF Reports</option>
            <option value="EMAIL_BULK">Bulk Emails</option>
            <option value="WEBHOOK_SIMULATOR">Webhooks</option>
            <option value="VIDEO_TRANSCODE">Video Transcodes</option>
            <option value="CSV_ETL_PIPELINE">Big Data ETL</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
            <tr>
              <th className="px-6 py-3.5">Task Title & ID</th>
              <th className="px-4 py-3.5">Type</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Progress / Stage</th>
              <th className="px-3 py-3.5 text-center">Duration</th>
              <th className="px-3 py-3.5 text-center">Retries</th>
              <th className="px-4 py-3.5">Timestamp</th>
              <th className="px-6 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan="8" className="px-6 py-10 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                  Loading execution logs...
                </td>
              </tr>
            ) : filteredJobs.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-10 text-center text-slate-400">
                  No task records found matching current criteria.
                </td>
              </tr>
            ) : (
              filteredJobs.map((job) => (
                <tr key={job._id} className="hover:bg-slate-800/40 transition">
                  <td className="px-6 py-3.5">
                    <div className="font-semibold text-slate-200">{job.title}</div>
                    <div className="text-[10px] font-mono text-slate-400">ID: {job.jobId}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      {getTypeIcon(job.type)}
                      <span className="font-mono">{job.type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">{getBadge(job.status)}</td>
                  <td className="px-4 py-3.5 max-w-xs">
                    <div className="text-slate-300 font-medium">{job.progress}%</div>
                    <div className="text-[11px] text-slate-400 truncate">{job.stage}</div>
                  </td>
                  <td className="px-3 py-3.5 text-center font-mono text-slate-300">
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                      <Timer className="w-3 h-3 text-slate-400" />
                      {getDuration(job.createdAt, job.updatedAt, job.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-center font-mono">
                    {job.retryCount > 0 ? (
                      <span className="text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        {job.retryCount}/3
                      </span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-slate-400">
                    {new Date(job.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Re-run task button */}
                      {onRerunJob && (
                        <button
                          onClick={() => onRerunJob(job)}
                          title="Re-run this task with identical configuration"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Completed Asset Actions */}
                      {job.status === 'completed' && (
                        <>
                          <button
                            onClick={() => onPreviewAsset(job)}
                            className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg font-medium flex items-center gap-1 transition"
                            title="Preview asset in dashboard modal"
                          >
                            <Eye className="w-3 h-3" /> Preview
                          </button>
                          <a
                            href={getAssetUrl(job.jobId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition"
                            title="Open in full browser tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}

                      {/* Failed Diagnostic Action */}
                      {job.status === 'failed' && (
                        <button
                          onClick={() => onInspectError(job)}
                          className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-lg font-medium flex items-center gap-1 transition"
                        >
                          <AlertTriangle className="w-3 h-3" /> Inspect
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && pagination.totalPages > 1 && (
        <div className="px-6 py-3 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing Page <span className="text-slate-200 font-medium">{pagination.page}</span> of{' '}
            <span className="text-slate-200 font-medium">{pagination.totalPages}</span> ({pagination.total} total)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


