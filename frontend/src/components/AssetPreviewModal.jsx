import React, { useState } from 'react';
import { getAssetUrl } from '../api.js';
import {
  X,
  ExternalLink,
  Printer,
  Copy,
  Check,
  Code,
  FileText,
  Download,
  Maximize2,
} from 'lucide-react';

export const AssetPreviewModal = ({ isOpen, onClose, job }) => {
  const [activeTab, setActiveTab] = useState('preview');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !job) return null;

  const assetUrl = getAssetUrl(job.jobId);

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(job.resultData || job, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-sm">{job.title}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  COMPLETED
                </span>
              </div>
              <p className="text-xs text-slate-400">Task #{job.jobId} • Output Asset Inspector</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="bg-slate-800/80 p-0.5 rounded-lg border border-slate-700 flex text-xs">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 font-medium rounded-md transition ${
                  activeTab === 'preview' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Rendered View
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`flex items-center gap-1 px-3 py-1 font-medium rounded-md transition ${
                  activeTab === 'json' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code className="w-3.5 h-3.5" /> Raw JSON
              </button>
            </div>

            {/* Open in new tab button */}
            <a
              href={assetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-800 transition"
              title="Open full page in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 bg-slate-950 p-2 sm:p-4 overflow-hidden relative">
          {activeTab === 'preview' ? (
            <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-800 bg-white">
              <iframe
                src={assetUrl}
                title="Asset Document Preview"
                className="w-full h-full border-0"
              />
            </div>
          ) : (
            <div className="w-full h-full rounded-2xl border border-slate-800 bg-slate-900 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                <span className="text-xs font-mono text-slate-400">Payload & Result Metadata</span>
                <button
                  onClick={copyJson}
                  className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre className="font-mono text-xs text-indigo-300 leading-relaxed overflow-x-auto">
                {JSON.stringify(
                  {
                    jobId: job.jobId,
                    type: job.type,
                    title: job.title,
                    status: job.status,
                    progress: job.progress,
                    createdAt: job.createdAt,
                    completedAt: job.updatedAt,
                    resultData: job.resultData,
                    payload: job.payload,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>Verified cryptographic receipt generated via BullMQ Worker</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={assetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium flex items-center gap-1.5 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Full Tab View
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
