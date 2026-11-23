import { useState, useEffect, useRef } from 'react';
import { API_BASE, getAuthToken } from '../api.js';

/**
 * Custom React hook to stream BullMQ job progress via native Server-Sent Events (SSE).
 * Automatically handles snapshot hydration, live progress, completion, failure, and cleanup.
 */
export const useJobSSE = (jobId, onJobCompleted = null, onJobFailed = null) => {
  const [jobState, setJobState] = useState({
    jobId,
    status: 'pending',
    progress: 0,
    stage: 'Connecting to real-time telemetry...',
    attemptsMade: 0,
    resultUrl: null,
    errorDetails: null,
  });

  const [logs, setLogs] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const eventSourceRef = useRef(null);

  const addLog = (message, type = 'info') => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        time: new Date().toLocaleTimeString(),
        message,
        type,
      },
    ]);
  };

  useEffect(() => {
    if (!jobId) return;

    setIsStreaming(true);
    setConnectionError(null);

    // Native EventSource with credentials and optional token param for cross-domain auth
    const token = getAuthToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const url = `${API_BASE}/jobs/progress/${jobId}${tokenQuery}`;
    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    addLog(`Initialized SSE connection to ${url}`, 'system');

    // 1. Initial snapshot from DB / BullMQ
    es.addEventListener('snapshot', (e) => {
      try {
        const data = JSON.parse(e.data);
        setJobState((prev) => ({ ...prev, ...data }));
        addLog(`Snapshot received: Status [${data.status.toUpperCase()}], Progress ${data.progress}%`, 'info');

        if (data.status === 'completed' || data.status === 'failed') {
          es.close();
          setIsStreaming(false);
        }
      } catch (err) {
        console.error('Snapshot parse error:', err);
      }
    });

    // 2. Worker active event
    es.addEventListener('active', (e) => {
      try {
        const data = JSON.parse(e.data);
        setJobState((prev) => ({
          ...prev,
          status: 'active',
          stage: data.stage || 'Worker active - processing task',
        }));
        addLog('Worker picked up job from taskQueue', 'active');
      } catch (err) {
        console.error('Active event parse error:', err);
      }
    });

    // 3. Incremental progress updates (20%, 50%, 80%, 100%)
    es.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        setJobState((prev) => ({
          ...prev,
          progress: data.percent,
          stage: data.stage,
        }));
        addLog(`[${data.percent}%] ${data.stage} ${data.details ? `— ${data.details}` : ''}`, 'progress');
      } catch (err) {
        console.error('Progress event parse error:', err);
      }
    });

    // 4. Job completed event
    es.addEventListener('completed', (e) => {
      try {
        const data = JSON.parse(e.data);
        setJobState((prev) => ({
          ...prev,
          status: 'completed',
          progress: 100,
          stage: 'Completed Successfully',
          resultUrl: data.resultUrl,
          resultData: data.resultData,
        }));
        addLog(`Task completed! Output ready: ${data.resultUrl || 'Completed'}`, 'success');
        es.close();
        setIsStreaming(false);
        if (onJobCompleted) onJobCompleted(data);
      } catch (err) {
        console.error('Completed event parse error:', err);
      }
    });

    // 5. Job failed / retry event
    es.addEventListener('failed', (e) => {
      try {
        const data = JSON.parse(e.data);
        setJobState((prev) => ({
          ...prev,
          status: 'failed',
          stage: 'Execution Failed',
          errorDetails: data,
        }));
        addLog(`Failure: ${data.failedReason || data.message || 'Worker execution failed'}`, 'error');
        es.close();
        setIsStreaming(false);
        if (onJobFailed) onJobFailed(data);
      } catch (err) {
        console.error('Failed event parse error:', err);
      }
    });

    // Native connection error
    es.onerror = (err) => {
      // EventSource fires onerror when stream closes normally too
      if (es.readyState === EventSource.CLOSED) {
        setIsStreaming(false);
      } else {
        console.warn('SSE stream error or reconnecting...', err);
        setConnectionError('SSE Stream disconnected or reconnecting');
      }
    };

    // Cleanup on unmount or when jobId changes
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setIsStreaming(false);
      }
    };
  }, [jobId]);

  const closeStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsStreaming(false);
      addLog('SSE connection manually closed', 'system');
    }
  };

  return {
    jobState,
    logs,
    isStreaming,
    connectionError,
    closeStream,
  };
};

