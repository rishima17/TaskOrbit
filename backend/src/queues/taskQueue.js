import { Queue, QueueEvents } from 'bullmq';
import { getRedisConnectionOptions, isClusterEnabled, createRedisClient } from '../config/redis.js';

const connection = isClusterEnabled()
  ? createRedisClient('TaskQueue')
  : getRedisConnectionOptions();

const dlqConnection = isClusterEnabled()
  ? createRedisClient('DlqQueue')
  : connection;

const eventsConnection = isClusterEnabled()
  ? createRedisClient('QueueEvents')
  : connection;

/**
 * Default job options as specified:
 * - 3 retry attempts
 * - Exponential backoff starting at 2000ms (2s -> 4s -> 8s)
 * - Retain failed jobs for inspection and DLQ routing
 */
export const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000, // 2000ms base delay
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep completed jobs for 24h
    count: 1000,    // Keep last 1000 completed jobs
  },
  removeOnFail: false, // Keep failed jobs in Redis for inspection/DLQ
};

/**
 * Main Asynchronous Task Queue
 */
export const taskQueue = new Queue('taskQueue', {
  connection,
  defaultJobOptions,
});

/**
 * Dedicated Dead-Letter Queue (DLQ)
 * Jobs that exhaust all 3 retry attempts in taskQueue get pushed here.
 */
export const dlqQueue = new Queue('dlqQueue', {
  connection: dlqConnection,
  defaultJobOptions: {
    removeOnComplete: false,
    removeOnFail: false,
  },
});

/**
 * Shared BullMQ QueueEvents listener for taskQueue.
 * Used by SSE controller for real-time progress, completion, and failure streaming.
 */
export const taskQueueEvents = new QueueEvents('taskQueue', {
  connection: eventsConnection,
});

/**
 * Helper to push a new task into BullMQ
 */
export const addTaskJob = async ({ type, title, payload, userId, customOptions = {} }) => {
  const jobOptions = {
    ...defaultJobOptions,
    ...customOptions,
  };

  const job = await taskQueue.add(
    type,
    {
      type,
      title: title || `${type} Task`,
      payload: payload || {},
      userId: userId.toString(),
      createdAt: new Date().toISOString(),
    },
    jobOptions
  );

  return job;
};

