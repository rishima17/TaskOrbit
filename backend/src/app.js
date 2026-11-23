import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { defaultRedis } from './config/redis.js';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createApp = () => {
  const app = express();

  // CORS Configuration for React Frontend with HttpOnly Cookies
  const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, true); // Dev convenience
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Core Parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Logging
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Health check endpoint (accessible via /health or /api/health)
  app.get(['/health', '/api/health'], async (req, res) => {
    let mongoStatus = 'disconnected';
    let redisStatus = 'disconnected';

    try {
      if (mongoose.connection.readyState === 1) {
        mongoStatus = 'connected';
      } else if (mongoose.connection.readyState === 2) {
        mongoStatus = 'connecting';
      }
    } catch (e) {
      mongoStatus = 'disconnected';
    }

    try {
      const ping = await Promise.race([
        defaultRedis.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
      ]);
      if (ping === 'PONG') redisStatus = 'connected';
    } catch (e) {
      redisStatus = 'disconnected';
    }

    res.status(200).json({
      status: 'ok',
      service: 'task-queue-api',
      timestamp: new Date().toISOString(),
      dependencies: {
        mongodb: mongoStatus,
        redis: redisStatus,
      },
    });
  });

  // Root API Landing endpoint
  app.get('/', (req, res) => {
    res.status(200).json({
      status: 'online',
      service: 'TaskOrbit - Distributed Asynchronous Task Queue & Telemetry Platform API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        jobs: '/api/jobs',
        admin: '/api/admin',
      },
      client: process.env.CLIENT_URL || 'Deploy frontend on Vercel',
    });
  });

  // Mount Application Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/admin', adminRoutes);

  // Serve Frontend Static Bundle if present (Single-service / Monorepo deployment)
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    console.log(`[API Server] Serving static frontend from: ${frontendDist}`);
    app.use(express.static(frontendDist));
    app.get('*', (req, res, next) => {
      // Exclude API or health endpoints from falling back to index.html
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  // 404 handler for unmatched API requests
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: `Resource not found on endpoint: ${req.originalUrl}`,
    });
  });

  // Central Error Handler
  app.use(errorHandler);

  return app;
};

