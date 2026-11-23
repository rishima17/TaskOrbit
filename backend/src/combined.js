import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { createApp } from './app.js';
import { connectDB, closeDB } from './config/db.js';
import { createTaskWorker } from './workers/taskWorker.js';

console.log('====================================================');
console.log('🚀  TASKORBIT COMBINED PRODUCTION CLUSTER STARTING');
console.log('    (API Ingestion Server + Background Worker Process)');
console.log('====================================================');

const PORT = process.env.PORT || 5000;

const startCluster = async () => {
  try {
    // 1. Connect MongoDB
    await connectDB();

    // 2. Initialize and start BullMQ Worker Node
    const workerInstance = createTaskWorker();
    console.log('[Worker Process] Listening for jobs on "taskQueue" [Concurrency: 5]...');

    // 3. Initialize and start Express API Web Server
    const app = createApp();
    const server = app.listen(PORT, () => {
      console.log(`[API Server] Running on port ${PORT}`);
      console.log(`[API Server] Health Check: /health`);
      console.log(`[API Server] Telemetry SSE: /api/jobs/progress/:jobId`);
      console.log('====================================================');
    });

    // 4. Graceful shutdown handler
    const gracefulShutdown = async (signal) => {
      console.log(`\n[Cluster] Received ${signal}. Initiating graceful drain & shutdown...`);
      server.close(async () => {
        try {
          if (workerInstance) {
            console.log('[Cluster] Closing BullMQ worker instance...');
            await workerInstance.close();
          }
          await closeDB();
          console.log('[Cluster] Graceful shutdown completed. Exiting.');
          process.exit(0);
        } catch (err) {
          console.error('[Cluster] Error during shutdown:', err);
          process.exit(1);
        }
      });

      // Force exit after 10s if tasks hang
      setTimeout(() => {
        console.error('[Cluster] Forcefully terminating after shutdown timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    console.error('[Cluster] Failed to initialize cluster:', error);
    process.exit(1);
  }
};

startCluster();

