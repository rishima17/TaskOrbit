import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { createApp } from './app.js';
import { connectDB, closeDB } from './config/db.js';

console.log('====================================================');
console.log('🚀  DISTRIBUTED TASK QUEUE API SERVER STARTING');
console.log('====================================================');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Connect MongoDB
    await connectDB();

    // 2. Initialize Express application
    const app = createApp();

    // 3. Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`[API Server] Running on http://localhost:${PORT}`);
      console.log(`[API Server] Health Check: http://localhost:${PORT}/health`);
      console.log(`[API Server] SSE Progress: http://localhost:${PORT}/api/jobs/progress/:jobId`);
      console.log('====================================================');
    });

    // 4. Graceful termination handler
    const gracefulShutdown = async (signal) => {
      console.log(`\n[API Server] Received ${signal}. Draining HTTP requests...`);
      server.close(async () => {
        console.log('[API Server] Closed HTTP listeners.');
        await closeDB();
        console.log('[API Server] Graceful shutdown completed.');
        process.exit(0);
      });

      // Force exit after 10s if hanging
      setTimeout(() => {
        console.error('[API Server] Forcefully terminating after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    console.error('[API Server] Failed to initialize:', error);
    process.exit(1);
  }
};

startServer();

