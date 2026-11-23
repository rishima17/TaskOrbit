import React, { useState } from 'react';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import {
  FileText,
  Mail,
  Send,
  Video,
  Database,
  AlertTriangle,
  X,
  Play,
  Cpu,
  Zap,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export const JobTriggerModal = ({ isOpen, onClose, onJobCreated }) => {
  const { addToast } = useToast();
  const [taskType, setTaskType] = useState('PDF');
  const [title, setTitle] = useState('Q3 Corporate Financial Audit Report');
  const [pageCount, setPageCount] = useState(50);
  const [recipientCount, setRecipientCount] = useState(5000);
  const [targetUrl, setTargetUrl] = useState('https://partner.enterprise.io/v1/webhook');
  const [videoResolution, setVideoResolution] = useState('4K UHD (3840x2160)');
  const [etlRowCount, setEtlRowCount] = useState(1000000);
  
  // Failure simulation toggle for testing retry & DLQ
  const [shouldFail, setShouldFail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleTypeSelect = (type) => {
    setTaskType(type);
    if (type === 'PDF') {
      setTitle('Q3 Corporate Financial Audit Report (50 Pages)');
    } else if (type === 'EMAIL_BULK') {
      setTitle('Global Security & Policy Newsletter Broadcast');
    } else if (type === 'WEBHOOK_SIMULATOR') {
      setTitle('Real-Time Webhook Pipeline Dispatch');
    } else if (type === 'VIDEO_TRANSCODE') {
      setTitle('4K ProRes Video Transcoding & HLS Adaptive Chunking');
    } else if (type === 'CSV_ETL_PIPELINE') {
      setTitle('1,000,000 Row Ledger ETL & Fraud Anomaly Detection');
    }
  };

  const handleTriggerStressTest = async () => {
    setBatchSubmitting(true);
    setError(null);
    try {
      const response = await api.createBatchJobs({
        count: 5,
        shouldFailOne: shouldFail,
      });

      if (response.success && response.jobs) {
        response.jobs.forEach((job) => {
          onJobCreated(job);
        });
        addToast(`Launched 5 concurrent background tasks across worker pool!`, 'info', '⚡ Concurrency Stress Test');
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to dispatch stress test');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let payload = { shouldFail };

    if (taskType === 'PDF') {
      payload = { ...payload, pageCount: Number(pageCount), watermark: 'CONFIDENTIAL' };
    } else if (taskType === 'EMAIL_BULK') {
      payload = { ...payload, count: Number(recipientCount), template: 'newsletter_v2' };
    } else if (taskType === 'WEBHOOK_SIMULATOR') {
      payload = { ...payload, count: 2500, targetUrl };
    } else if (taskType === 'VIDEO_TRANSCODE') {
      payload = { ...payload, resolution: videoResolution, codecs: ['HEVC', 'AV1', 'H.264'] };
    } else if (taskType === 'CSV_ETL_PIPELINE') {
      payload = { ...payload, rowCount: Number(etlRowCount), anomalyDetection: true };
    }

    try {
      const response = await api.createJob({
        type: taskType,
        title,
        payload,
      });

      if (response.success && response.jobId) {
        onJobCreated({
          jobId: response.jobId,
          title,
          type: taskType,
          status: 'pending',
          progress: 0,
          stage: 'Enqueued in BullMQ',
          createdAt: new Date().toISOString(),
          shouldFail,
        });
        addToast(`Task #${response.jobId} enqueued for processing`, 'info');
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to dispatch task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100">Dispatch Heavy Asynchronous Task</h3>
              <p className="text-xs text-slate-400">Offload CPU & I/O heavy jobs to Redis & BullMQ Worker</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Concurrency Stress Test Banner */}
        <div className="px-6 pt-5 pb-0">
          <div className="p-3.5 bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border border-indigo-500/30 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-600/30 rounded-xl text-indigo-300">
                <Zap className="w-4 h-4 fill-current text-indigo-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  Concurrency Stress Test
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    5 Parallel Jobs
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">Fire all 5 task types simultaneously across BullMQ worker slots</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleTriggerStressTest}
              disabled={batchSubmitting || submitting}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/30 transition shrink-0 flex items-center gap-1"
            >
              {batchSubmitting ? 'Firing Batch...' : '⚡ Launch 5x'}
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Task Type Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Select Task Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleTypeSelect('PDF')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  taskType === 'PDF'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800/80'
                }`}
              >
                <FileText className={`w-5 h-5 mb-2 ${taskType === 'PDF' ? 'text-indigo-400' : 'text-slate-500'}`} />
                <div>
                  <div className="text-xs font-semibold text-slate-200">PDF Generator</div>
                  <div className="text-[10px] text-slate-400">Vector render & raster</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTypeSelect('EMAIL_BULK')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  taskType === 'EMAIL_BULK'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800/80'
                }`}
              >
                <Mail className={`w-5 h-5 mb-2 ${taskType === 'EMAIL_BULK' ? 'text-indigo-400' : 'text-slate-500'}`} />
                <div>
                  <div className="text-xs font-semibold text-slate-200">Bulk Email</div>
                  <div className="text-[10px] text-slate-400">5k list & DKIM sign</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTypeSelect('WEBHOOK_SIMULATOR')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  taskType === 'WEBHOOK_SIMULATOR'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800/80'
                }`}
              >
                <Send className={`w-5 h-5 mb-2 ${taskType === 'WEBHOOK_SIMULATOR' ? 'text-indigo-400' : 'text-slate-500'}`} />
                <div>
                  <div className="text-xs font-semibold text-slate-200">Webhook Dispatch</div>
                  <div className="text-[10px] text-slate-400">Concurrent HTTP streams</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTypeSelect('VIDEO_TRANSCODE')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  taskType === 'VIDEO_TRANSCODE'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800/80'
                }`}
              >
                <Video className={`w-5 h-5 mb-2 ${taskType === 'VIDEO_TRANSCODE' ? 'text-indigo-400' : 'text-slate-500'}`} />
                <div>
                  <div className="text-xs font-semibold text-slate-200">4K Video Transcode</div>
                  <div className="text-[10px] text-slate-400">HLS adaptive chunking</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTypeSelect('CSV_ETL_PIPELINE')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  taskType === 'CSV_ETL_PIPELINE'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800/80'
                }`}
              >
                <Database className={`w-5 h-5 mb-2 ${taskType === 'CSV_ETL_PIPELINE' ? 'text-indigo-400' : 'text-slate-500'}`} />
                <div>
                  <div className="text-xs font-semibold text-slate-200">Big Data ETL Pipeline</div>
                  <div className="text-[10px] text-slate-400">1M ledger & fraud model</div>
                </div>
              </button>
            </div>
          </div>

          {/* Job Title */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Task Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Type Specific Fields */}
          {taskType === 'PDF' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Document Page Count</label>
              <input
                type="number"
                min="5"
                max="500"
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Simulates heavy multi-step compilation: Data ledger aggregation $\rightarrow$ SVG charting $\rightarrow$ Digital watermark $\rightarrow$ Cloud upload.
              </span>
            </div>
          )}

          {taskType === 'EMAIL_BULK' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Recipient Count</label>
              <input
                type="number"
                min="100"
                max="50000"
                value={recipientCount}
                onChange={(e) => setRecipientCount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Simulates recipient deduplication, bounce suppression, template compilation, and SMTP relay batches.
              </span>
            </div>
          )}

          {taskType === 'WEBHOOK_SIMULATOR' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Webhook Endpoint</label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Simulates HTTP/2 TLS handshakes, HMAC-SHA256 signature verification, and delivery acknowledgments.
              </span>
            </div>
          )}

          {taskType === 'VIDEO_TRANSCODE' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Encoding Profile</label>
              <select
                value={videoResolution}
                onChange={(e) => setVideoResolution(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="4K UHD (3840x2160)">4K UHD Master (HEVC + AV1 + 1080p Ladder)</option>
                <option value="1080p Full HD (1920x1080)">1080p Broadcast Standard (H.264 High)</option>
                <option value="8K Ultra Master (7680x4320)">8K Cinema Archival (ProRes 4444 XQ)</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Simulates multi-pass FFmpeg hardware transcoding, audio demuxing, and HLS .m3u8 adaptive stream chunking.
              </span>
            </div>
          )}

          {taskType === 'CSV_ETL_PIPELINE' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Ledger Transaction Record Count</label>
              <input
                type="number"
                min="10000"
                max="10000000"
                step="50000"
                value={etlRowCount}
                onChange={(e) => setEtlRowCount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Simulates chunked streaming of 1,000,000 rows across 32 concurrent workers, regex coercion, and statistical fraud detection.
              </span>
            </div>
          )}

          {/* Simulation Toggle: Retry & DLQ Tester */}
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={shouldFail}
                onChange={(e) => setShouldFail(e.target.checked)}
                className="mt-0.5 rounded border-amber-600 text-amber-500 focus:ring-amber-500/40 bg-slate-800"
              />
              <div>
                <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Simulate Gateway Failure (Test Exponential Backoff & DLQ)
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Worker intentionally fails with HTTP 504 on 3 attempts (waiting 2s, 4s, 8s via BullMQ backoff). After exhausting all 3 retries, the job is automatically moved to the Dead-Letter Queue (DLQ).
                </p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {submitting ? 'Enqueueing Task...' : 'Dispatch to Queue (HTTP 202)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

