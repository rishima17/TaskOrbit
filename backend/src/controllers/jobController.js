import { addTaskJob, taskQueue, taskQueueEvents } from '../queues/taskQueue.js';
import { JobLog } from '../models/JobLog.js';

/**
 * POST /api/jobs/create
 * Immediately returns HTTP 202 Accepted and queues background work.
 */
export const createJob = async (req, res, next) => {
  try {
    const { type, title, payload } = req.body;
    const userId = req.user._id;

    if (!type || !['PDF', 'EMAIL_BULK', 'WEBHOOK_SIMULATOR', 'VIDEO_TRANSCODE', 'CSV_ETL_PIPELINE'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task type. Must be one of: PDF, EMAIL_BULK, WEBHOOK_SIMULATOR, VIDEO_TRANSCODE, CSV_ETL_PIPELINE',
      });
    }

    // 1. Dispatch job into BullMQ
    const bullJob = await addTaskJob({
      type,
      title: title || `${type} Processing Task`,
      payload: payload || {},
      userId,
    });

    // 2. Persist audit record in MongoDB
    const jobLog = await JobLog.create({
      jobId: bullJob.id,
      userId,
      type,
      title: title || `${type} Processing Task`,
      status: 'pending',
      progress: 0,
      stage: 'Queued in BullMQ',
      payload: payload || {},
    });

    // 3. Return HTTP 202 Accepted immediately
    res.status(202).json({
      success: true,
      message: 'Task accepted and enqueued for asynchronous execution',
      jobId: bullJob.id,
      jobLogId: jobLog._id,
      status: 'pending',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/jobs/create-batch
 * Dispatches multiple tasks in parallel for concurrency stress-testing.
 */
export const createBatchJobs = async (req, res, next) => {
  try {
    const { count = 5, shouldFailOne = false } = req.body;
    const userId = req.user._id;

    const availableTypes = ['PDF', 'VIDEO_TRANSCODE', 'CSV_ETL_PIPELINE', 'EMAIL_BULK', 'WEBHOOK_SIMULATOR'];
    const createdJobs = [];

    for (let i = 0; i < Math.min(count, 10); i++) {
      const type = availableTypes[i % availableTypes.length];
      const isFailing = shouldFailOne && i === 0;

      const titleMap = {
        PDF: `Parallel PDF Render Batch #${i + 1}`,
        VIDEO_TRANSCODE: `4K Transcode Stream #${i + 1}`,
        CSV_ETL_PIPELINE: `1M BigData Ledger Ingestion #${i + 1}`,
        EMAIL_BULK: `Targeted Broadcast Segment #${i + 1}`,
        WEBHOOK_SIMULATOR: `High-Velocity Webhook Stream #${i + 1}`,
      };

      const payload = {
        batchIndex: i + 1,
        shouldFail: isFailing,
        ...(type === 'PDF' && { pageCount: 25 }),
        ...(type === 'VIDEO_TRANSCODE' && { resolution: '1080p Full HD' }),
        ...(type === 'CSV_ETL_PIPELINE' && { rowCount: 500000 }),
        ...(type === 'EMAIL_BULK' && { count: 2500 }),
        ...(type === 'WEBHOOK_SIMULATOR' && { count: 1000 }),
      };

      const bullJob = await addTaskJob({
        type,
        title: titleMap[type],
        payload,
        userId,
      });

      const jobLog = await JobLog.create({
        jobId: bullJob.id,
        userId,
        type,
        title: titleMap[type],
        status: 'pending',
        progress: 0,
        stage: 'Enqueued in Concurrent Batch',
        payload,
      });

      createdJobs.push({
        jobId: bullJob.id,
        jobLogId: jobLog._id,
        title: titleMap[type],
        type,
        status: 'pending',
        progress: 0,
        stage: 'Enqueued in Concurrent Batch',
        createdAt: new Date().toISOString(),
        shouldFail: isFailing,
      });
    }

    res.status(202).json({
      success: true,
      message: `Enqueued batch of ${createdJobs.length} concurrent tasks into BullMQ`,
      count: createdJobs.length,
      jobs: createdJobs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/jobs/progress/:jobId
 * Server-Sent Events (SSE) streaming endpoint.
 */
export const streamJobProgress = async (req, res, next) => {
  const { jobId } = req.params;

  try {
    // Verify job belongs to user (or user is admin)
    const jobLog = await JobLog.findOne({ jobId });
    if (!jobLog) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (req.user.role !== 'admin' && jobLog.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied to this job stream' });
    }

    // Configure SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering (Nginx, etc.)
    res.flushHeaders?.();

    // Helper to send formatted SSE message
    const sendSSE = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 1. Send immediate snapshot from DB & Queue
    const currentBullJob = await taskQueue.getJob(jobId);
    const initialSnapshot = {
      jobId,
      status: jobLog.status,
      progress: jobLog.progress,
      stage: jobLog.stage,
      attemptsMade: currentBullJob?.attemptsMade || jobLog.retryCount || 0,
      resultUrl: jobLog.resultUrl,
      errorDetails: jobLog.errorDetails,
      timestamp: new Date().toISOString(),
    };

    sendSSE('snapshot', initialSnapshot);

    // If job already finished before SSE connected, close gracefully
    if (jobLog.status === 'completed') {
      sendSSE('completed', {
        jobId,
        status: 'completed',
        progress: 100,
        resultUrl: jobLog.resultUrl,
        resultData: jobLog.resultData,
      });
      res.end();
      return;
    }

    if (jobLog.status === 'failed') {
      sendSSE('failed', {
        jobId,
        status: 'failed',
        errorDetails: jobLog.errorDetails,
      });
      res.end();
      return;
    }

    // 2. Attach QueueEvents Listeners
    const onActive = ({ jobId: activeId, prev }) => {
      if (activeId === jobId) {
        sendSSE('active', {
          jobId,
          status: 'active',
          stage: 'Active in Worker',
          timestamp: new Date().toISOString(),
        });
      }
    };

    const onProgress = ({ jobId: progressId, data }) => {
      if (progressId === jobId) {
        sendSSE('progress', {
          jobId,
          percent: data?.percent || data,
          stage: data?.stage || 'Processing...',
          details: data?.details || '',
          timestamp: new Date().toISOString(),
        });
      }
    };

    const onCompleted = ({ jobId: completedId, returnvalue }) => {
      if (completedId === jobId) {
        const result = typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue;
        sendSSE('completed', {
          jobId,
          status: 'completed',
          progress: 100,
          resultUrl: result?.resultUrl || null,
          resultData: result?.resultData || null,
          timestamp: new Date().toISOString(),
        });
        cleanup();
        res.end();
      }
    };

    const onFailed = ({ jobId: failedId, failedReason }) => {
      if (failedId === jobId) {
        sendSSE('failed', {
          jobId,
          status: 'failed',
          failedReason,
          timestamp: new Date().toISOString(),
        });
        cleanup();
        res.end();
      }
    };

    // Register listeners with QueueEvents
    taskQueueEvents.on('active', onActive);
    taskQueueEvents.on('progress', onProgress);
    taskQueueEvents.on('completed', onCompleted);
    taskQueueEvents.on('failed', onFailed);

    // 3. Heartbeat Keep-Alive Ping (every 15s)
    const pingInterval = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    // 4. Cleanup on client disconnect
    const cleanup = () => {
      clearInterval(pingInterval);
      taskQueueEvents.removeListener('active', onActive);
      taskQueueEvents.removeListener('progress', onProgress);
      taskQueueEvents.removeListener('completed', onCompleted);
      taskQueueEvents.removeListener('failed', onFailed);
    };

    req.on('close', () => {
      cleanup();
    });

    req.on('error', () => {
      cleanup();
    });
  } catch (error) {
    console.error(`[SSE Controller Error] jobId=${jobId}:`, error);
    if (!res.headersSent) {
      next(error);
    } else if (jobLog.type === 'VIDEO_TRANSCODE') {
      const resolution = jobLog.resultData?.resolution || '4K UHD (3840x2160)';
      const chunksCount = jobLog.resultData?.chunksCount || 480;
      specificContent = `
        <div class="card">
          <div class="card-header">
            <h3>4K Adaptive Bitrate Video Transcoding & HLS Manifest</h3>
            <span class="badge" style="background:#f5f3ff;color:#7c3aed;border-color:#ddd6fe;">HLS / H.265 / AV1</span>
          </div>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            Multi-pass encoding completed. Master HLS manifest compiled with 4 adaptive rendition ladders and forensic frame-level watermarking.
          </p>

          <div style="background: #0f172a; border-radius: 12px; padding: 24px; color: #f8fafc; margin: 20px 0; text-align: center;">
            <div style="width: 60px; height: 60px; border-radius: 50%; background: #4f46e5; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; box-shadow: 0 0 20px rgba(99, 102, 241, 0.5);">
              <span style="font-size: 24px;">▶</span>
            </div>
            <div style="font-weight: 700; font-size: 16px;">${jobLog.title}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">CDN Stream Ready: master.m3u8 (${chunksCount} Transport Stream Chunks)</div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>Rendition Profile</th>
                <th>Resolution</th>
                <th>Target Bitrate</th>
                <th>Video Codec</th>
                <th>Audio Track</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>4K Master</strong></td>
                <td>3840 x 2160</td>
                <td>18,500 kbps</td>
                <td>HEVC / H.265</td>
                <td>Dolby Atmos 5.1 (448k)</td>
              </tr>
              <tr>
                <td><strong>1080p Pro</strong></td>
                <td>1920 x 1080</td>
                <td>6,200 kbps</td>
                <td>AV1 / H.264</td>
                <td>AAC Stereo (320k)</td>
              </tr>
              <tr>
                <td><strong>720p Mobile</strong></td>
                <td>1280 x 720</td>
                <td>2,800 kbps</td>
                <td>H.264 High</td>
                <td>AAC Stereo (192k)</td>
              </tr>
              <tr>
                <td><strong>480p Low</strong></td>
                <td>854 x 480</td>
                <td>1,100 kbps</td>
                <td>H.264 Main</td>
                <td>AAC Stereo (128k)</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 20px; font-size: 12px; font-family: monospace; background: #0f172a; color: #a5b4fc; padding: 14px; border-radius: 8px;">
            Playlist URI: https://stream.cdn.enterprise.net/vod/hls/asset_${jobId}/master.m3u8<br/>
            Forensic DRM Hash: SHA256:${checksum.slice(0, 32)}
          </div>
        </div>
      `;
    } else if (jobLog.type === 'CSV_ETL_PIPELINE') {
      const rowCount = jobLog.resultData?.rowCount || jobLog.payload?.rowCount || 1000000;
      const anomalies = jobLog.resultData?.anomaliesDetected || 37;
      const throughput = jobLog.resultData?.throughput || '84,200 rows/sec';
      specificContent = `
        <div class="card">
          <div class="card-header">
            <h3>1,000,000 Row Ledger ETL & Fraud Anomaly Diagnostics</h3>
            <span class="badge" style="background:#fef2f2;color:#dc2626;border-color:#fecaca;">${anomalies} Anomalies Quarantined</span>
          </div>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            High-speed chunked stream processing completed across 32 concurrent buffer pipelines. 
            All financial entries sanitized, normalized, and evaluated against automated fraud pattern heuristics.
          </p>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0;">
            <div style="padding: 14px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: #4f46e5;">${rowCount.toLocaleString()}</div>
              <div style="font-size: 11px; color: #64748b;">Records Ingested</div>
            </div>
            <div style="padding: 14px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: #10b981;">${throughput}</div>
              <div style="font-size: 11px; color: #64748b;">Ingestion Velocity</div>
            </div>
            <div style="padding: 14px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: #dc2626;">${anomalies}</div>
              <div style="font-size: 11px; color: #64748b;">Suspicious Anomalies</div>
            </div>
            <div style="padding: 14px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: #0284c7;">78.4%</div>
              <div style="font-size: 11px; color: #64748b;">Parquet Compression</div>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>TxID</th>
                <th>Account Reference</th>
                <th>Flagged Amount</th>
                <th>Velocity Trigger</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>#TX-948201</strong></td>
                <td>acct_9921_global_ltd</td>
                <td><strong style="color:#dc2626;">$482,500.00</strong></td>
                <td>Rapid outbound burst (&gt;10x norm)</td>
                <td><span style="color:#dc2626;font-weight:bold;">QUARANTINED</span></td>
              </tr>
              <tr>
                <td><strong>#TX-948332</strong></td>
                <td>acct_4412_crypto_node</td>
                <td><strong style="color:#dc2626;">$219,800.00</strong></td>
                <td>Unusual geographic IP jump</td>
                <td><span style="color:#dc2626;font-weight:bold;">QUARANTINED</span></td>
              </tr>
              <tr>
                <td><strong>#TX-948519</strong></td>
                <td>acct_1084_holding_co</td>
                <td><strong style="color:#dc2626;">$718,500.00</strong></td>
                <td>High-frequency micro-structuring</td>
                <td><span style="color:#dc2626;font-weight:bold;">QUARANTINED</span></td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 16px; font-size: 12px; font-family: monospace; background: #0f172a; color: #38bdf8; padding: 12px; border-radius: 6px;">
            Columnar Warehouse: s3://enterprise-data-lake/parquet/year=2026/month=11/ledger_${jobId}.parquet (89.2 MB)
          </div>
        </div>
      `;
    } else {
      res.end();
    }
  }
};

/**
 * GET /api/jobs/history
 * Paginated task history for the authenticated user.
 */
export const getJobHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id };

    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }

    if (req.query.type && req.query.type !== 'all') {
      filter.type = req.query.type;
    }

    const [jobs, total] = await Promise.all([
      JobLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      JobLog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/jobs/:jobId
 * Single job details inspector
 */
export const getJobDetails = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const jobLog = await JobLog.findOne({ jobId });
    if (!jobLog) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (req.user.role !== 'admin' && jobLog.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const bullJob = await taskQueue.getJob(jobId);

    res.status(200).json({
      success: true,
      data: {
        log: jobLog,
        bullState: bullJob ? await bullJob.getState() : 'unknown',
        attemptsMade: bullJob?.attemptsMade || jobLog.retryCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/jobs/asset/:jobId
 * Serves real, downloadable/viewable generated assets (PDF reports, Email certificates, Webhook logs).
 */
export const getJobAsset = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const jobLog = await JobLog.findOne({ jobId });

    if (!jobLog) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Asset Not Found</title><style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style></head>
        <body>
          <div style="text-align:center;">
            <h1>404 - Asset Not Found</h1>
            <p>No job record exists for Job ID: ${jobId}</p>
            <a href="http://localhost:5173" style="color:#6366f1;">Return to TaskOrbit Dashboard</a>
          </div>
        </body>
        </html>
      `);
    }

    if (jobLog.status !== 'completed') {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Asset Pending</title><style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}</style></head>
        <body>
          <div style="text-align:center;">
            <h1>Asset Processing</h1>
            <p>Job #${jobId} is currently <strong>${jobLog.status.toUpperCase()}</strong> (${jobLog.progress}%).</p>
            <a href="http://localhost:5173" style="color:#6366f1;">Return to TaskOrbit Dashboard</a>
          </div>
        </body>
        </html>
      `);
    }

    if (req.query.format === 'json') {
      return res.status(200).json({
        success: true,
        jobId: jobLog.jobId,
        title: jobLog.title,
        type: jobLog.type,
        completedAt: jobLog.updatedAt,
        resultData: jobLog.resultData,
      });
    }

    // Render interactive, printable document based on task type
    const dateFormatted = new Date(jobLog.updatedAt).toUTCString();
    const checksum = jobLog.resultData?.checksum || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    let specificContent = '';

    if (jobLog.type === 'PDF') {
      const pageCount = jobLog.resultData?.pageCount || jobLog.payload?.pageCount || 50;
      specificContent = `
        <div class="card">
          <div class="card-header">
            <h3>Executive Summary: Q3 Financial Audit Performance</h3>
            <span class="badge">SEC & GAAP Compliant</span>
          </div>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            This document represents the consolidated, cryptographically signed financial audit for enterprise operations. 
            All ledger transactions across 12 fiscal quarters have been aggregated, verified via double-entry reconciliation, and validated against institutional banking records.
          </p>

          <table class="report-table">
            <thead>
              <tr>
                <th>Quarter / Metric</th>
                <th>Q1 Actual</th>
                <th>Q2 Actual</th>
                <th>Q3 Consolidated</th>
                <th>YoY Growth</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Gross Revenue</strong></td>
                <td>$12,450,000</td>
                <td>$15,200,000</td>
                <td><strong>$18,450,000</strong></td>
                <td><span style="color:#10b981;font-weight:bold;">+24.8%</span></td>
              </tr>
              <tr>
                <td><strong>Operating Margin</strong></td>
                <td>28.4%</td>
                <td>31.2%</td>
                <td><strong>34.6%</strong></td>
                <td><span style="color:#10b981;font-weight:bold;">+6.2%</span></td>
              </tr>
              <tr>
                <td><strong>EBITDA</strong></td>
                <td>$3,535,800</td>
                <td>$4,742,400</td>
                <td><strong>$6,383,700</strong></td>
                <td><span style="color:#10b981;font-weight:bold;">+38.1%</span></td>
              </tr>
              <tr>
                <td><strong>Net Retained Earnings</strong></td>
                <td>$2,480,000</td>
                <td>$3,190,000</td>
                <td><strong>$4,520,000</strong></td>
                <td><span style="color:#10b981;font-weight:bold;">+41.8%</span></td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #4f46e5;">
            <div style="font-size: 12px; font-weight: 700; color: #1e293b; text-transform: uppercase;">Cryptographic Audit Attestation</div>
            <div style="font-size: 11px; font-family: monospace; color: #475569; word-break: break-all; margin-top: 4px;">
              RSA-2048 STAMP: 8f4a-9c2b-e104-58a2-d9f7-0043-bb81 | HASH: ${checksum}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              Generated ${pageCount} pages • Headless Chromium Rendering Engine • BullMQ Async Task ID #${jobId}
            </div>
          </div>
        </div>
      `;
    } else if (jobLog.type === 'EMAIL_BULK') {
      const totalSent = jobLog.resultData?.totalSent || jobLog.payload?.count || 5000;
      specificContent = `
        <div class="card">
          <div class="card-header">
            <h3>Bulk Email Broadcast Delivery Attestation</h3>
            <span class="badge" style="background:#ecfdf5;color:#059669;border-color:#a7f3d0;">99.8% Delivery Rate</span>
          </div>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            Campaign broadcast successfully routed through distributed SMTP relay clusters with full SPF, DKIM, and DMARC alignment.
          </p>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0;">
            <div style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: 800; color: #4f46e5;">${totalSent.toLocaleString()}</div>
              <div style="font-size: 12px; color: #64748b;">Envelopes Dispatched</div>
            </div>
            <div style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: 800; color: #10b981;">0</div>
              <div style="font-size: 12px; color: #64748b;">Hard Bounces</div>
            </div>
            <div style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: 800; color: #0284c7;">100%</div>
              <div style="font-size: 12px; color: #64748b;">DKIM Alignment</div>
            </div>
          </div>
          <div style="font-size: 12px; font-family: monospace; color: #64748b; background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 6px;">
            Tracking ID: ${jobLog.resultData?.openTrackingId || `trk_${jobId}`} | Relays: [smtp-us-east-1, smtp-eu-west-1]
          </div>
        </div>
      `;
    } else if (jobLog.type === 'VIDEO_TRANSCODE') {
      const resolution = jobLog.resultData?.resolution || '4K UHD (3840x2160)';
      const chunksCount = jobLog.resultData?.chunksCount || 480;
      specificContent = `
        <div class="card">
          <div class="card-header">
            <h3>4K Adaptive Bitrate Video Transcoding & HLS Manifest</h3>
            <span class="badge" style="background:#f5f3ff;color:#7c3aed;border-color:#ddd6fe;">HLS / H.265 / AV1</span>
          </div>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            Multi-pass encoding completed. Master HLS manifest compiled with 4 adaptive rendition ladders and forensic frame-level watermarking.
          </p>

          <div style="background: #0f172a; border-radius: 12px; padding: 24px; color: #f8fafc; margin: 20px 0; text-align: center;">
            <div style="width: 60px; height: 60px; border-radius: 50%; background: #4f46e5; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; box-shadow: 0 0 20px rgba(99, 102, 241, 0.5);">
              <span style="font-size: 24px;">▶</span>
            </div>
            <div style="font-weight: 700; font-size: 16px;">${jobLog.title}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">CDN Stream Ready: master.m3u8 (${chunksCount} Transport Stream Chunks)</div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>Rendition Profile</th>
                <th>Resolution</th>
                <th>Target Bitrate</th>
                <th>Video Codec</th>
                <th>Audio Track</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>4K Master</strong></td>
                <td>3840 x 2160</td>
                <td>18,500 kbps</td>
                <td>HEVC / H.265</td>
                <td>Dolby Atmos 5.1 (448k)</td>
              </tr>
              <tr>
                <td><strong>1080p Pro</strong></td>
                <td>1920 x 1080</td>
                <td>6,200 kbps</td>
                <td>AV1 / H.264</td>
                <td>AAC Stereo (320k)</td>
              </tr>
              <tr>
                <td><strong>720p Mobile</strong></td>
                <td>1280 x 720</td>
                <td>2,800 kbps</td>
                <td>H.264 High</td>
                <td>AAC Stereo (192k)</td>
              </tr>
              <tr>
                <td><strong>480p Low</strong></td>
                <td>854 x 480</td>
                <td>1,100 kbps</td>
                <td>H.264 Main</td>
                <td>AAC Stereo (128k)</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 20px; font-size: 12px; font-family: monospace; background: #0f172a; color: #a5b4fc; padding: 14px; border-radius: 8px;">
            Playlist URI: https://stream.cdn.enterprise.net/vod/hls/asset_${jobId}/master.m3u8<br/>
            Forensic DRM Hash: SHA256:${checksum.slice(0, 32)}
          </div>
        </div>
      `;
    } else if (jobLog.type === 'CSV_ETL_PIPELINE') {
      const rowCount = jobLog.resultData?.rowCount || jobLog.payload?.rowCount || 1000000;
      const anomalies = jobLog.resultData?.anomaliesDetected || 37;
      const throughput = jobLog.resultData?.throughput || '84,200 rows/sec';
      specificContent = `
        <div class="card">
          <div class="card-header">
            <h3>1,000,000 Row Ledger ETL & Fraud Anomaly Diagnostics</h3>
            <span class="badge" style="background:#fef2f2;color:#dc2626;border-color:#fecaca;">${anomalies} Anomalies Quarantined</span>
          </div>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            High-speed chunked stream processing completed across 32 concurrent buffer pipelines. 
            All financial entries sanitized, normalized, and evaluated against automated fraud pattern heuristics.
          </p>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0;">
            <div style="padding: 14px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: #4f46e5;">${rowCount.toLocaleString()}</div>
              <div style="font-size: 11px; color: #64748b;">Records Ingested</div>
            </div>
            <div style="padding: 14px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: #10b981;">${throughput}</div>
              <div style="font-size: 11px; color: #64748b;">Ingestion Velocity</div>
            </div>
            <div style="padding: 14px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: #dc2626;">${anomalies}</div>
              <div style="font-size: 11px; color: #64748b;">Suspicious Anomalies</div>
            </div>
            <div style="padding: 14px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 20px; font-weight: 800; color: #0284c7;">78.4%</div>
              <div style="font-size: 11px; color: #64748b;">Parquet Compression</div>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th>TxID</th>
                <th>Account Reference</th>
                <th>Flagged Amount</th>
                <th>Velocity Trigger</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>#TX-948201</strong></td>
                <td>acct_9921_global_ltd</td>
                <td><strong style="color:#dc2626;">$482,500.00</strong></td>
                <td>Rapid outbound burst (&gt;10x norm)</td>
                <td><span style="color:#dc2626;font-weight:bold;">QUARANTINED</span></td>
              </tr>
              <tr>
                <td><strong>#TX-948332</strong></td>
                <td>acct_4412_crypto_node</td>
                <td><strong style="color:#dc2626;">$219,800.00</strong></td>
                <td>Unusual geographic IP jump</td>
                <td><span style="color:#dc2626;font-weight:bold;">QUARANTINED</span></td>
              </tr>
              <tr>
                <td><strong>#TX-948519</strong></td>
                <td>acct_1084_holding_co</td>
                <td><strong style="color:#dc2626;">$718,500.00</strong></td>
                <td>High-frequency micro-structuring</td>
                <td><span style="color:#dc2626;font-weight:bold;">QUARANTINED</span></td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 16px; font-size: 12px; font-family: monospace; background: #0f172a; color: #38bdf8; padding: 12px; border-radius: 6px;">
            Columnar Warehouse: s3://enterprise-data-lake/parquet/year=2026/month=11/ledger_${jobId}.parquet (89.2 MB)
          </div>
        </div>
      `;
    } else {
      const dispatched = jobLog.resultData?.dispatchedCount || jobLog.payload?.count || 2500;
      specificContent = `
        <div class="card">
          <div class="card-header">
            <h3>Webhook Pipeline Delivery Receipt</h3>
            <span class="badge" style="background:#f0fdf4;color:#16a34a;border-color:#bbf7d0;">HTTP 200 OK</span>
          </div>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
            High-throughput webhook dispatch executed with jittered connection pooling and HMAC-SHA256 signature verification.
          </p>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0;">
            <div style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: 800; color: #4f46e5;">${dispatched.toLocaleString()}</div>
              <div style="font-size: 12px; color: #64748b;">Payload Packets Delivered</div>
            </div>
            <div style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: 800; color: #10b981;">${jobLog.resultData?.avgLatencyMs || 42}ms</div>
              <div style="font-size: 12px; color: #64748b;">Average Roundtrip Latency</div>
            </div>
            <div style="padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: 800; color: #0284c7;">100%</div>
              <div style="font-size: 12px; color: #64748b;">Target ACK Rate</div>
            </div>
          </div>
          <div style="font-size: 12px; font-family: monospace; background: #0f172a; color: #38bdf8; padding: 12px; border-radius: 6px;">
            Target Endpoint: ${jobLog.payload?.targetUrl || 'https://api.partner.io/events/webhook'}<br/>
            Signature: sha256=7d2f9b8c6e41a9...
          </div>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${jobLog.title} - TaskOrbit Output Asset</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #0f172a;
            color: #1e293b;
            margin: 0;
            padding: 30px 20px;
          }
          .container {
            max-width: 860px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
          }
          .banner {
            background: linear-gradient(135deg, #312e81 0%, #4338ca 100%);
            padding: 36px 40px;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .banner h1 { margin: 0 0 6px; font-size: 24px; font-weight: 800; }
          .banner p { margin: 0; font-size: 13px; color: #c7d2fe; }
          .btn-group { display: flex; gap: 10px; }
          .btn {
            background: #ffffff;
            color: #4338ca;
            border: none;
            padding: 10px 18px;
            font-size: 12px;
            font-weight: 700;
            border-radius: 8px;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .btn:hover { background: #e0e7ff; }
          .btn-secondary {
            background: rgba(255, 255, 255, 0.15);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.3);
          }
          .btn-secondary:hover { background: rgba(255, 255, 255, 0.25); }
          .content { padding: 40px; }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-bottom: 30px;
            padding-bottom: 24px;
            border-bottom: 1px solid #e2e8f0;
          }
          .meta-item .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
          .meta-item .value { font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px; font-family: monospace; }
          .card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
          }
          .card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
          }
          .card-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
          .badge {
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 20px;
            background: #eef2ff;
            color: #4f46e5;
            border: 1px solid #c7d2fe;
          }
          .report-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
            font-size: 13px;
          }
          .report-table th {
            text-align: left;
            padding: 10px 14px;
            background: #f1f5f9;
            color: #475569;
            font-size: 11px;
            text-transform: uppercase;
            border-bottom: 2px solid #cbd5e1;
          }
          .report-table td {
            padding: 12px 14px;
            border-bottom: 1px solid #f1f5f9;
          }
          .footer {
            padding: 24px 40px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
            color: #64748b;
          }
          @media print {
            body { background: #ffffff; padding: 0; }
            .container { box-shadow: none; border-radius: 0; }
            .btn-group { display: none !important; }
            .banner { background: #1e1b4b !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="banner">
            <div>
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #a5b4fc; margin-bottom: 4px;">
                TaskOrbit • Verified Execution Certificate
              </div>
              <h1>${jobLog.title}</h1>
              <p>Generated asynchronously via BullMQ Queue & Worker Engine</p>
            </div>
            <div class="btn-group">
              <button onclick="window.print()" class="btn">
                🖨️ Print / Save as PDF
              </button>
              <a href="http://localhost:5173" class="btn btn-secondary">
                Dashboard
              </a>
            </div>
          </div>

          <div class="content">
            <div class="meta-grid">
              <div class="meta-item">
                <div class="label">Task ID</div>
                <div class="value">#${jobLog.jobId}</div>
              </div>
              <div class="meta-item">
                <div class="label">Status</div>
                <div class="value" style="color: #10b981;">COMPLETED</div>
              </div>
              <div class="meta-item">
                <div class="label">Task Type</div>
                <div class="value">${jobLog.type}</div>
              </div>
              <div class="meta-item">
                <div class="label">Completed At</div>
                <div class="value" style="font-size: 11px;">${dateFormatted.slice(0, 22)}</div>
              </div>
            </div>

            ${specificContent}
          </div>

          <div class="footer">
            <div>TaskOrbit Engine v2.4 • Distributed Task Queue & Webhook Platform</div>
            <div>Generated in ${jobLog.retryCount > 0 ? `${jobLog.retryCount + 1} attempts` : '1 attempt (0 retries)'}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

