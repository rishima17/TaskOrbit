import { JobLog } from '../models/JobLog.js';
import { taskQueue, dlqQueue, defaultJobOptions } from '../queues/taskQueue.js';

/**
 * GET /api/admin/dlq
 * Returns all jobs that exhausted retries and were moved to the Dead-Letter Queue.
 */
export const getDlqJobs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;

    // Fetch jobs flagged as DLQ or status: 'failed'
    const filter = {
      $or: [{ isDlq: true }, { status: 'failed' }],
    };

    const [dlqLogs, total] = await Promise.all([
      JobLog.find(filter)
        .populate('userId', 'name email')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      JobLog.countDocuments(filter),
    ]);

    // Also get raw jobs from BullMQ dlqQueue for cross-inspection
    const rawDlqJobs = await dlqQueue.getJobs(['waiting', 'completed', 'failed'], 0, 50);

    res.status(200).json({
      success: true,
      data: dlqLogs,
      rawDlqCount: rawDlqJobs.length,
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
 * POST /api/admin/requeue/:jobId
 * Re-queues a failed DLQ job back into taskQueue with fresh attempts.
 */
export const requeueJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const jobLog = await JobLog.findOne({ jobId });
    if (!jobLog) {
      return res.status(404).json({ success: false, message: 'DLQ Job record not found' });
    }

    // Prepare fresh payload (disable shouldFail if requested so it can succeed)
    const newPayload = { ...jobLog.payload };
    if (req.body.clearFailureFlag) {
      delete newPayload.shouldFail;
    }

    // Add new job to taskQueue
    const newJob = await taskQueue.add(
      jobLog.type,
      {
        type: jobLog.type,
        title: `${jobLog.title} (Re-queued)`,
        payload: newPayload,
        userId: jobLog.userId.toString(),
        requeuedFrom: jobId,
        requeuedAt: new Date().toISOString(),
      },
      defaultJobOptions
    );

    // Update original JobLog or create fresh one linked to original
    jobLog.jobId = newJob.id;
    jobLog.status = 'pending';
    jobLog.progress = 0;
    jobLog.isDlq = false;
    jobLog.stage = 'Re-queued by Administrator';
    jobLog.retryCount = 0;
    jobLog.payload = newPayload;
    jobLog.errorDetails = {
      message: null,
      stack: null,
      attemptsMade: 0,
      failedAt: null,
    };
    await jobLog.save();

    res.status(200).json({
      success: true,
      message: `Job ${jobId} successfully re-enqueued as Job ${newJob.id}`,
      newJobId: newJob.id,
      jobLog,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/metrics
 * System-wide queue concurrency & health metrics.
 */
export const getQueueMetrics = async (req, res, next) => {
  try {
    const [taskCounts, dlqCounts] = await Promise.all([
      taskQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused'),
      dlqQueue.getJobCounts('waiting', 'completed', 'failed'),
    ]);

    const dbSummary = await JobLog.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      bullmq: {
        taskQueue: taskCounts,
        dlqQueue: dlqCounts,
      },
      database: dbSummary.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
    });
  } catch (error) {
    next(error);
  }
};

