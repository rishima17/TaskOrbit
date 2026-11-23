import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables relative to backend root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDB, closeDB } from '../config/db.js';
import { createTaskWorker } from './taskWorker.js';

console.log('====================================================');
console.log('⚡  DISTRIBUTED TASK QUEUE WORKER NODE INITIALIZING');
console.log('====================================================');

let workerInstance = null;

const startWorkerProcess = async () => {
  try {
    // 1. Establish MongoDB connection for state persistence
    await connectDB();

    // 2. Instantiate and launch the BullMQ Worker
    workerInstance = createTaskWorker();
    console.log('[Worker Process] Listening for jobs on "taskQueue" [Concurrency: 5]...');

    // 3. Graceful shutdown handler
    const gracefulShutdown = async (signal) => {
      console.log(`\n[Worker Process] Received ${signal}. Commencing graceful drain & shutdown...`);
      try {
        if (workerInstance) {
          console.log('[Worker Process] Closing BullMQ worker instance (allowing running jobs to finish)...');
          await workerInstance.close();
        }
        await closeDB();
        console.log('[Worker Process] Shutdown complete. Exiting.');
        process.exit(0);
      } catch (err) {
        console.error('[Worker Process] Error during shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    console.error('[Worker Process] Fatal error starting worker:', error);
    process.exit(1);
  }
};

startWorkerProcess();

