import { Worker } from 'bullmq';
import { getRedisConnectionOptions } from '../config/redis.js';
import { dlqQueue } from '../queues/taskQueue.js';
import { JobLog } from '../models/JobLog.js';

const connection = getRedisConnectionOptions();

// Helper sleep function for simulating processing delays
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Task Processor implementation.
 * Simulates heavy I/O and CPU operations across different task types.
 */
export const processTaskJob = async (job) => {
  const { type, title, payload } = job.data;
  console.log(`[Worker] Started processing Job ${job.id} [${type}] - Attempt ${job.attemptsMade + 1}/${job.opts.attempts}`);

  // Test intentionally failing the job if requested
  if (payload?.shouldFail) {
    // If failUntilAttempt is specified, we can optionally succeed on subsequent attempts
    const failUntilAttempt = payload?.failUntilAttempt || 999;
    if (job.attemptsMade + 1 <= failUntilAttempt) {
      await sleep(1000);
      throw new Error(`[SIMULATED_FAILURE] 3rd-party webhook endpoint timeout / remote gateway error (HTTP 504) on attempt ${job.attemptsMade + 1}`);
    }
  }

  let resultUrl = null;
  let resultData = null;

  switch (type) {
    case 'PDF': {
      // Step 1: 20%
      await sleep(1500);
      await job.updateProgress({
        percent: 20,
        stage: 'Aggregating financial ledger data from transactions database',
        details: 'Fetched 14,820 ledger records across 12 quarters.',
      });

      // Step 2: 50%
      await sleep(1800);
      await job.updateProgress({
        percent: 50,
        stage: 'Rendering SVG vector charts & compiling multi-column tables',
        details: 'Compiled 50 document pages using headless Chromium render engine.',
      });

      // Step 3: 80%
      await sleep(1500);
      await job.updateProgress({
        percent: 80,
        stage: 'Compressing assets, generating SHA-256 watermark & digital signature',
        details: 'Applied RSA-2048 enterprise corporate stamp.',
      });

      // Step 4: 100%
      await sleep(1000);
      resultUrl = `/api/jobs/asset/${job.id}`;
      resultData = {
        pageCount: payload?.pageCount || 50,
        fileSizeMb: '4.85 MB',
        generatedAt: new Date().toISOString(),
        checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      };
      await job.updateProgress({
        percent: 100,
        stage: 'PDF compilation completed and published to CDN',
        details: 'Ready for client download.',
      });
      break;
    }

    case 'EMAIL_BULK': {
      const totalRecipients = payload?.count || 5000;
      // Step 1: 20%
      await sleep(1200);
      await job.updateProgress({
        percent: 20,
        stage: 'Parsing recipient list & applying bounce rate suppression filter',
        details: `Deduplicated ${totalRecipients} emails; 12 invalid addresses removed.`,
      });

      // Step 2: 50%
      await sleep(1600);
      await job.updateProgress({
        percent: 50,
        stage: 'Compiling personalized Handlebars templates and tracking pixels',
        details: `Batch 1 dispatched (${Math.floor(totalRecipients * 0.5)} / ${totalRecipients} emails sent).`,
      });

      // Step 3: 80%
      await sleep(1500);
      await job.updateProgress({
        percent: 80,
        stage: 'Streaming SMTP pipeline with DKIM signing and SPF alignment',
        details: `Batch 2 dispatched (${Math.floor(totalRecipients * 0.85)} / ${totalRecipients} emails sent).`,
      });

      // Step 4: 100%
      await sleep(1000);
      resultUrl = `/api/jobs/asset/${job.id}`;
      resultData = {
        totalSent: totalRecipients,
        deliveryRate: '99.8%',
        openTrackingId: `trk_${job.id}`,
      };
      await job.updateProgress({
        percent: 100,
        stage: 'Bulk email broadcast completed successfully',
        details: 'All recipient envelopes confirmed by SMTP relays.',
      });
      break;
    }

    case 'WEBHOOK_SIMULATOR': {
      const webhookCount = payload?.count || 2500;
      // Step 1: 20%
      await sleep(1200);
      await job.updateProgress({
        percent: 20,
        stage: 'Generating HMAC-SHA256 signature headers & validating payload JSON schemas',
        details: `Target: ${payload?.targetUrl || 'https://api.partner.io/events/webhook'}`,
      });

      // Step 2: 50%
      await sleep(1500);
      await job.updateProgress({
        percent: 50,
        stage: 'Executing concurrent HTTP/2 streams with jittered connection pooling',
        details: `Dispatched ${Math.floor(webhookCount * 0.5)} payload packets.`,
      });

      // Step 3: 80%
      await sleep(1500);
      await job.updateProgress({
        percent: 80,
        stage: 'Evaluating HTTP 200/204 ACKs & managing downstream rate-limit headers',
        details: `Dispatched ${Math.floor(webhookCount * 0.85)} payload packets.`,
      });

      // Step 4: 100%
      await sleep(1000);
      resultUrl = `/api/jobs/asset/${job.id}`;
      resultData = {
        dispatchedCount: webhookCount,
        avgLatencyMs: 42,
        statusCode: 200,
        signature: 'sha256=7d2f9b8c6e...',
      };
      await job.updateProgress({
        percent: 100,
        stage: 'All webhook events successfully acknowledged by target endpoints',
        details: '100% delivery verification logged.',
      });
      break;
    }

    case 'VIDEO_TRANSCODE': {
      const resolution = payload?.resolution || '4K UHD';
      // Step 1: 20%
      await sleep(1300);
      await job.updateProgress({
        percent: 20,
        stage: 'Probing container streams, extracting color profiles & demuxing multi-track audio',
        details: 'Analyzed ProRes 422 HQ master; extracted 5.1 surround + stereo audio channels.',
      });

      // Step 2: 50%
      await sleep(1800);
      await job.updateProgress({
        percent: 50,
        stage: 'Executing multi-pass hardware FFmpeg transcode (4K UHD, 1080p, 720p, 480p)',
        details: 'Encoded 24,000 frames with HEVC/H.265 (CRF 18) and AV1 profiles.',
      });

      // Step 3: 80%
      await sleep(1500);
      await job.updateProgress({
        percent: 80,
        stage: 'Segmenting MP4 into 6s transport chunks & compiling master.m3u8 adaptive manifest',
        details: 'Generated 480 chunks with frame-level steganographic watermark.',
      });

      // Step 4: 100%
      await sleep(1000);
      resultUrl = `/api/jobs/asset/${job.id}`;
      resultData = {
        resolution,
        chunksCount: 480,
        bitrates: ['18.5 Mbps (4K)', '6.2 Mbps (1080p)', '2.8 Mbps (720p)', '1.1 Mbps (480p)'],
        masterManifest: `master_${job.id}.m3u8`,
        codecs: 'HEVC / H.265, AV1, AAC 320k',
      };
      await job.updateProgress({
        percent: 100,
        stage: '4K HLS adaptive stream ready and propagated to global edge cache',
        details: 'Verified playback manifest on 8 CDN edge pops.',
      });
      break;
    }

    case 'CSV_ETL_PIPELINE': {
      const rowCount = payload?.rowCount || 1000000;
      // Step 1: 20%
      await sleep(1200);
      await job.updateProgress({
        percent: 20,
        stage: 'Streaming 1,000,000 raw ledger records into 32 concurrent buffer workers',
        details: `Buffer stream active: 250,000 / ${rowCount.toLocaleString()} rows ingested.`,
      });

      // Step 2: 50%
      await sleep(1600);
      await job.updateProgress({
        percent: 50,
        stage: 'Executing schema type-coercion, null-value reconciliation & deduplication',
        details: `Transformed 650,000 / ${rowCount.toLocaleString()} rows (Velocity: 84,200 rows/s).`,
      });

      // Step 3: 80%
      await sleep(1500);
      await job.updateProgress({
        percent: 80,
        stage: 'Evaluating statistical outlier model for fraud detection & structuring spikes',
        details: '920,000 rows audited; 37 suspicious high-velocity anomalies quarantined.',
      });

      // Step 4: 100%
      await sleep(1000);
      resultUrl = `/api/jobs/asset/${job.id}`;
      resultData = {
        rowCount,
        anomaliesDetected: 37,
        throughput: '84,200 rows/sec',
        compressionRatio: '78.4% (Snappy/Parquet)',
        outputParquetSize: '89.2 MB',
      };
      await job.updateProgress({
        percent: 100,
        stage: 'ETL Pipeline completed: Data lake updated and anomalies quarantined',
        details: 'All 1,000,000 records persisted to columnar Parquet store.',
      });
      break;
    }

    default:
      throw new Error(`Unsupported job type: ${type}`);
  }

  return {
    success: true,
    jobId: job.id,
    type,
    resultUrl,
    resultData,
    completedAt: new Date().toISOString(),
  };
};

/**
 * Creates and initializes the BullMQ Worker
 */
export const createTaskWorker = () => {
  const worker = new Worker('taskQueue', processTaskJob, {
    connection,
    concurrency: 5, // Concurrent job executions
    limiter: {
      max: 20,
      duration: 1000, // Maximum 20 jobs per second
    },
  });

  // Event: Job active in worker
  worker.on('active', async (job) => {
    console.log(`[Worker Event] Job ${job.id} (${job.name}) is ACTIVE`);
    try {
      await JobLog.findOneAndUpdate(
        { jobId: job.id },
        {
          status: 'active',
          stage: 'Processing in background worker',
          retryCount: job.attemptsMade,
        }
      );
    } catch (err) {
      console.error(`[Worker DB Sync Error] Active event:`, err.message);
    }
  });

  // Event: Progress update
  worker.on('progress', async (job, progress) => {
    console.log(`[Worker Event] Job ${job.id} PROGRESS: ${progress.percent}% - ${progress.stage}`);
    try {
      await JobLog.findOneAndUpdate(
        { jobId: job.id },
        {
          progress: progress.percent,
          stage: progress.stage,
          retryCount: job.attemptsMade,
        }
      );
    } catch (err) {
      console.error(`[Worker DB Sync Error] Progress event:`, err.message);
    }
  });

  // Event: Completed
  worker.on('completed', async (job, returnvalue) => {
    console.log(`[Worker Event] Job ${job.id} COMPLETED successfully`);
    try {
      await JobLog.findOneAndUpdate(
        { jobId: job.id },
        {
          status: 'completed',
          progress: 100,
          stage: 'Completed Successfully',
          resultUrl: returnvalue?.resultUrl || null,
          resultData: returnvalue?.resultData || null,
        }
      );
    } catch (err) {
      console.error(`[Worker DB Sync Error] Completed event:`, err.message);
    }
  });

  // Event: Failed
  worker.on('failed', async (job, err) => {
    if (!job) {
      console.error('[Worker Event] Unknown job failed:', err);
      return;
    }

    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts.attempts || 3;
    const isExhausted = attemptsMade >= maxAttempts;

    console.warn(
      `[Worker Event] Job ${job.id} FAILED (Attempt ${attemptsMade}/${maxAttempts}). Reason: ${err.message}`
    );

    try {
      if (isExhausted) {
        console.error(`[DLQ Route] Job ${job.id} exhausted all ${maxAttempts} retries. Moving to Dead-Letter Queue (DLQ)...`);

        // 1. Push into BullMQ dlqQueue
        await dlqQueue.add(
          `DLQ_${job.name}`,
          {
            originalJobId: job.id,
            type: job.data.type,
            title: job.data.title,
            payload: job.data.payload,
            userId: job.data.userId,
            failedReason: err.message,
            stacktrace: err.stack,
            attemptsMade,
            movedToDlqAt: new Date().toISOString(),
          },
          {
            removeOnComplete: false,
            removeOnFail: false,
          }
        );

        // 2. Mark in Mongo JobLog as permanently failed & flagged as DLQ
        await JobLog.findOneAndUpdate(
          { jobId: job.id },
          {
            status: 'failed',
            isDlq: true,
            stage: `Exhausted all ${maxAttempts} retry attempts -> Relocated to DLQ`,
            errorDetails: {
              message: err.message,
              stack: err.stack,
              attemptsMade,
              failedAt: new Date(),
            },
          }
        );
      } else {
        // Exponential backoff will retry this job
        const nextDelayMs = 2000 * Math.pow(2, attemptsMade - 1);
        await JobLog.findOneAndUpdate(
          { jobId: job.id },
          {
            stage: `Attempt ${attemptsMade}/${maxAttempts} failed. Exponential backoff retry in ~${nextDelayMs / 1000}s...`,
            retryCount: attemptsMade,
            errorDetails: {
              message: err.message,
              stack: err.stack,
              attemptsMade,
              failedAt: new Date(),
            },
          }
        );
      }
    } catch (dbErr) {
      console.error(`[Worker DB Sync Error] Failed event:`, dbErr.message);
    }
  });

  worker.on('error', (err) => {
    console.error('[Worker System Error]:', err);
  });

  return worker;
};

