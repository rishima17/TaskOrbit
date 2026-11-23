import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

// Ensure environment variables are loaded immediately
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/task_queue_db';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] MongoDB connection failed: ${error.message}`);
    // If running in development without local mongo, log clear instructions
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[Database] Tip: Ensure MongoDB is running via `docker compose up -d mongodb` or a local MongoDB service.');
    }
    throw error;
  }
};

export const closeDB = async () => {
  await mongoose.connection.close();
  console.log('[Database] MongoDB connection closed');
};

