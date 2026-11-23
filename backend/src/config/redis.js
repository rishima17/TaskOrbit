import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Redis } from 'ioredis';

// Ensure environment variables are loaded immediately even when imported early
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Standard Redis connection options for BullMQ & Express.
 * Note: BullMQ strictly requires `maxRetriesPerRequest: null`.
 */
export const getRedisConnectionOptions = () => {
  if (process.env.REDIS_URL) {
    try {
      const parsedUrl = new URL(process.env.REDIS_URL);
      return {
        host: parsedUrl.hostname,
        port: parseInt(parsedUrl.port || '6379', 10),
        username: parsedUrl.username || undefined,
        password: parsedUrl.password || undefined,
        tls: parsedUrl.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => Math.min(times * 150, 3000),
      };
    } catch (e) {
      console.warn('[Redis Config] Failed to parse REDIS_URL, using defaults:', e.message);
    }
  }

  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = parseInt(process.env.REDIS_PORT || '6380', 10);
  const password = process.env.REDIS_PASSWORD || undefined;

  return {
    host,
    port,
    password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      // Exponential reconnect strategy with cap at 3000ms
      const delay = Math.min(times * 150, 3000);
      return delay;
    },
  };
};

/**
 * Factory to create dedicated Redis instances (BullMQ requires dedicated instances
 * for Queue, Worker, and QueueEvents to avoid blocking commands clashing).
 */
export const createRedisClient = (label = 'Default') => {
  const options = getRedisConnectionOptions();
  let client;

  if (process.env.REDIS_URL) {
    client = new Redis(process.env.REDIS_URL, options);
  } else {
    client = new Redis(options);
  }

  client.on('connect', () => {
    console.log(`[Redis:${label}] Connected successfully`);
  });

  client.on('error', (err) => {
    console.error(`[Redis:${label} Error]`, err.message);
  });

  client.on('close', () => {
    console.warn(`[Redis:${label}] Connection closed`);
  });

  return client;
};

// Default singleton client for simple cache/pubsub
export const defaultRedis = createRedisClient('App');

