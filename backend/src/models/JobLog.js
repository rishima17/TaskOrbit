import mongoose from 'mongoose';

const jobLogSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['PDF', 'EMAIL_BULK', 'WEBHOOK_SIMULATOR', 'VIDEO_TRANSCODE', 'CSV_ETL_PIPELINE'],
      required: true,
    },
    title: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    stage: {
      type: String,
      default: 'Queued',
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    resultUrl: {
      type: String,
      default: null,
    },
    resultData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    errorDetails: {
      message: { type: String, default: null },
      stack: { type: String, default: null },
      attemptsMade: { type: Number, default: 0 },
      failedAt: { type: Date, default: null },
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    isDlq: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying user jobs sorted by creation date
jobLogSchema.index({ userId: 1, createdAt: -1 });

export const JobLog = mongoose.model('JobLog', jobLogSchema);

