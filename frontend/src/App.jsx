import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { useToast } from './context/ToastContext.jsx';
import { api } from './api.js';
import { Navbar } from './components/Navbar.jsx';
import { JobTriggerModal } from './components/JobTriggerModal.jsx';
import { ActiveJobsList } from './components/ActiveJobsList.jsx';
import { JobHistoryTable } from './components/JobHistoryTable.jsx';
import { ErrorDrawer } from './components/ErrorDrawer.jsx';
import { AdminDlqPanel } from './components/AdminDlqPanel.jsx';
import { AuthForms } from './components/AuthForms.jsx';
import { AssetPreviewModal } from './components/AssetPreviewModal.jsx';
import { LiveTelemetryTerminal } from './components/LiveTelemetryTerminal.jsx';
import {
  Layers,
  Sparkles,
  Zap,
  ShieldCheck,
  Cpu,
  RefreshCw,
  PlusCircle,
  Activity,
} from 'lucide-react';

export const DashboardContent = () => {
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isTriggerOpen, setIsTriggerOpen] = useState(false);
  const [activeJobs, setActiveJobs] = useState([]);
  const [historyJobs, setHistoryJobs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedErrorJob, setSelectedErrorJob] = useState(null);
  const [previewAssetJob, setPreviewAssetJob] = useState(null);
  const [telemetryLogs, setTelemetryLogs] = useState([]);

  // Fetch paginated job history
  const fetchHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const res = await api.getJobHistory({
        page,
        limit: 10,
        status: statusFilter,
        type: typeFilter,
      });
      if (res.success) {
        setHistoryJobs(res.data || []);
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    if (user) {
      fetchHistory(pagination.page);
    }
  }, [user, fetchHistory, pagination.page]);

  // Handler when user dispatches a new task from the modal
  const handleJobCreated = (newJob) => {
    setActiveJobs((prev) => [newJob, ...prev]);
    setTelemetryLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        time: new Date().toLocaleTimeString(),
        message: `Task #${newJob.jobId} [${newJob.type}] enqueued into BullMQ (HTTP 202 Accepted)`,
        type: 'active',
      },
    ]);
    setTimeout(() => fetchHistory(1), 1000);
  };

  // Handler when an active SSE job completes
  const handleJobCompleted = (jobId, result) => {
    addToast(`Task #${jobId} completed successfully!`, 'success', 'Task Completed');
    setTelemetryLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        time: new Date().toLocaleTimeString(),
        message: `Task #${jobId} COMPLETED. Output asset published to CDN.`,
        type: 'success',
      },
    ]);
    fetchHistory(pagination.page);
  };

  // Handler when an active SSE job fails and moves to DLQ
  const handleJobFailed = (jobId, err) => {
    addToast(`Task #${jobId} exhausted retries -> Moved to DLQ`, 'error', 'Task Failed');
    setTelemetryLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        time: new Date().toLocaleTimeString(),
        message: `Task #${jobId} FAILED: ${err?.failedReason || 'All 3 retries exhausted. Moved to Dead-Letter Queue.'}`,
        type: 'error',
      },
    ]);
    fetchHistory(pagination.page);
  };

  // Quick re-run handler from history table
  const handleRerunJob = async (job) => {
    try {
      const res = await api.createJob({
        type: job.type,
        title: `${job.title} (Re-run)`,
        payload: job.payload || {},
      });
      if (res.success && res.jobId) {
        handleJobCreated({
          jobId: res.jobId,
          title: `${job.title} (Re-run)`,
          type: job.type,
          status: 'pending',
          progress: 0,
          stage: 'Enqueued in BullMQ',
          createdAt: new Date().toISOString(),
        });
        addToast(`Re-enqueued Task #${res.jobId}`, 'info');
      }
    } catch (err) {
      addToast(err.message || 'Failed to re-run task', 'error');
    }
  };

  // Re-queue handler from DLQ
  const handleRequeue = async (jobId) => {
    try {
      const res = await api.requeueJob(jobId, true);
      if (res.success) {
        setSelectedErrorJob(null);
        handleJobCreated({
          jobId: res.newJobId,
          title: res.jobLog.title,
          type: res.jobLog.type,
          status: 'pending',
          progress: 0,
          stage: 'Re-enqueued by Admin',
          createdAt: new Date().toISOString(),
        });
        addToast(`Task #${jobId} resurrected as Task #${res.newJobId}`, 'success', 'Resurrected from DLQ');
        fetchHistory(1);
      }
    } catch (e) {
      addToast(e.message, 'error');
    }
  };

  // Direct 5x Concurrency Stress Test Trigger
  const handleTriggerDirectStressTest = async () => {
    try {
      const response = await api.createBatchJobs({ count: 5 });
      if (response.success && response.jobs) {
        response.jobs.forEach((job) => handleJobCreated(job));
        addToast(`Launched 5 concurrent background tasks across worker pool!`, 'info', '⚡ Concurrency Stress Test');
      }
    } catch (err) {
      addToast(err.message || 'Failed to dispatch stress test', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-16">
      <Navbar
        onOpenTrigger={() => setIsTriggerOpen(true)}
        onTriggerStressTest={handleTriggerDirectStressTest}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-8">
        {/* Banner Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-950/60 via-slate-900 to-purple-950/40 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="max-w-2xl relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5" />
              Real-Time Concurrency Architecture
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Decoupled Task Queue & Live Telemetry Engine
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Synchronous HTTP endpoints immediately return <span className="font-mono text-indigo-300">HTTP 202 Accepted</span>.
              Heavy workloads execute asynchronously on isolated BullMQ workers with exponential retry backoff, DLQ quarantine, and zero-latency SSE progress streaming.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsTriggerOpen(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                Dispatch Task
              </button>
              <button
                onClick={handleTriggerDirectStressTest}
                className="px-4 py-2 bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg shadow-purple-600/20"
              >
                <Zap className="w-3.5 h-3.5 fill-current text-purple-400" />
                ⚡ 5x Concurrency Test
              </button>
              <button
                onClick={() => fetchHistory(pagination.page)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                Sync History
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' ? (
          <div className="space-y-8">
            {/* Active Execution Section */}
            <ActiveJobsList
              activeJobs={activeJobs}
              onJobCompleted={handleJobCompleted}
              onJobFailed={handleJobFailed}
              onClearFinished={() => setActiveJobs((prev) => prev.filter((j) => j.status !== 'completed' && j.status !== 'failed'))}
              onPreviewAsset={(job) => setPreviewAssetJob(job)}
            />

            {/* Historical Log Section */}
            <JobHistoryTable
              jobs={historyJobs}
              loading={historyLoading}
              pagination={pagination}
              onPageChange={(newPage) => setPagination((prev) => ({ ...prev, page: newPage }))}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              typeFilter={typeFilter}
              setTypeFilter={setTypeFilter}
              onInspectError={(job) => setSelectedErrorJob(job)}
              onPreviewAsset={(job) => setPreviewAssetJob(job)}
              onRerunJob={handleRerunJob}
            />
          </div>
        ) : (
          <AdminDlqPanel onInspectError={(job) => setSelectedErrorJob(job)} />
        )}
      </main>

      {/* Global Live Telemetry Terminal HUD */}
      <LiveTelemetryTerminal
        logs={telemetryLogs}
        activeCount={activeJobs.filter((j) => j.status === 'active' || j.status === 'pending').length}
      />

      {/* Trigger Modal */}
      <JobTriggerModal
        isOpen={isTriggerOpen}
        onClose={() => setIsTriggerOpen(false)}
        onJobCreated={handleJobCreated}
      />

      {/* Error Inspector Drawer */}
      <ErrorDrawer
        isOpen={!!selectedErrorJob}
        onClose={() => setSelectedErrorJob(null)}
        job={selectedErrorJob}
        onRequeue={isAdmin ? handleRequeue : null}
      />

      {/* In-App Asset Preview Modal */}
      <AssetPreviewModal
        isOpen={!!previewAssetJob}
        onClose={() => setPreviewAssetJob(null)}
        job={previewAssetJob}
      />
    </div>
  );
};

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs">Connecting to TaskOrbit Platform...</p>
        </div>
      </div>
    );
  }

  return user ? <DashboardContent /> : <AuthForms />;
}

