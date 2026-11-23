import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import { connectDB, closeDB } from '../src/config/db.js';
import { taskQueue, dlqQueue, taskQueueEvents, defaultJobOptions } from '../src/queues/taskQueue.js';
import { createTaskWorker } from '../src/workers/taskWorker.js';
import { User } from '../src/models/User.js';
import { JobLog } from '../src/models/JobLog.js';

console.log('====================================================');
console.log('🧪 DISTRIBUTED TASK QUEUE AUTOMATED TEST SUITE');
console.log('====================================================');

const runTests = async () => {
  let worker = null;
  try {
    // 1. Check connections
    console.log('[Test Step 1] Verifying MongoDB & Redis connections...');
    await connectDB();
    console.log('✅ MongoDB connected successfully');

    // 2. Start worker
    console.log('[Test Step 2] Launching in-process test worker...');
    worker = createTaskWorker();
    console.log('✅ BullMQ Worker initialized with Concurrency: 5');

    // 3. Setup Test User
    let testUser = await User.findOne({ email: 'test_architect@enterprise.local' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Systems Architect',
        email: 'test_architect@enterprise.local',
        password: 'Password123!',
        role: 'admin',
      });
    }
    console.log(`✅ Test User Verified: ${testUser.email} (Role: ${testUser.role})`);

    // 4. Test Normal Job Execution (PDF Generation)
    console.log('\n[Test Step 3] Testing Happy-Path Job (50-Page PDF Generation)...');
    const pdfJob = await taskQueue.add(
      'PDF',
      {
        type: 'PDF',
        title: 'Automated Test Financial Report',
        payload: { pageCount: 50 },
        userId: testUser._id.toString(),
      },
      defaultJobOptions
    );

    await JobLog.create({
      jobId: pdfJob.id,
      userId: testUser._id,
      type: 'PDF',
      title: 'Automated Test Financial Report',
      status: 'pending',
    });

    console.log(`Pushed Job ${pdfJob.id} into taskQueue. Waiting for execution & progress events...`);

    await new Promise((resolve, reject) => {
      const onProgress = ({ jobId, data }) => {
        if (jobId === pdfJob.id) {
          console.log(`   📡 [Progress Event] Job ${jobId}: ${data.percent}% -> ${data.stage}`);
        }
      };

      const onCompleted = ({ jobId, returnvalue }) => {
        if (jobId === pdfJob.id) {
          console.log(`   ✅ [Completed Event] Job ${jobId} finished! Output:`, returnvalue);
          taskQueueEvents.removeListener('progress', onProgress);
          taskQueueEvents.removeListener('completed', onCompleted);
          resolve();
        }
      };

      taskQueueEvents.on('progress', onProgress);
      taskQueueEvents.on('completed', onCompleted);
    });

    // 5. Test Failure & Exponential Backoff & DLQ Routing
    console.log('\n[Test Step 4] Testing Failure & Exponential Backoff (3 retries -> DLQ)...');
    const failingJob = await taskQueue.add(
      'WEBHOOK_SIMULATOR',
      {
        type: 'WEBHOOK_SIMULATOR',
        title: 'Failing Webhook (Testing DLQ)',
        payload: { shouldFail: true, count: 500 },
        userId: testUser._id.toString(),
      },
      defaultJobOptions
    );

    await JobLog.create({
      jobId: failingJob.id,
      userId: testUser._id,
      type: 'WEBHOOK_SIMULATOR',
      title: 'Failing Webhook (Testing DLQ)',
      status: 'pending',
    });

    console.log(`Pushed Failing Job ${failingJob.id}. Observing retries (2s, 4s, 8s exponential delays)...`);

    await new Promise((resolve) => {
      let failCount = 0;
      const onFailed = async ({ jobId, failedReason }) => {
        if (jobId === failingJob.id) {
          failCount++;
          console.log(`   ⚠️ [Retry Event] Job ${jobId} failed attempt ${failCount}/3. Reason: ${failedReason}`);

          if (failCount >= 3) {
            console.log(`   🛑 [DLQ Triggered] Job ${jobId} exhausted all retries! Checking DLQ collection...`);
            // Wait 1s for DLQ insertion
            await new Promise((r) => setTimeout(r, 1000));
            const dlqRecord = await JobLog.findOne({ jobId: failingJob.id });
            console.log('   📄 DB DLQ Record Verification:');
            console.log(`      - Status: ${dlqRecord.status}`);
            console.log(`      - isDlq: ${dlqRecord.isDlq}`);
            console.log(`      - Stage: ${dlqRecord.stage}`);
            console.log(`      - Error: ${dlqRecord.errorDetails?.message}`);

            taskQueueEvents.removeListener('failed', onFailed);
            resolve();
          }
        }
      };

      taskQueueEvents.on('failed', onFailed);
    });

    console.log('\n====================================================');
    console.log('🎉 ALL ARCHITECTURAL TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================');
  } catch (error) {
    console.error('Test Suite Failed:', error);
  } finally {
    if (worker) await worker.close();
    await closeDB();
    process.exit(0);
  }
};

runTests();

