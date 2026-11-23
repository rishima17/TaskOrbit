import { Router } from 'express';
import {
  createJob,
  createBatchJobs,
  streamJobProgress,
  getJobHistory,
  getJobDetails,
  getJobAsset,
} from '../controllers/jobController.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

// Publicly viewable / downloadable generated audit assets
router.get('/asset/:jobId', getJobAsset);

// All other job routes require user authentication
router.use(requireAuth);

router.post('/create', createJob);
router.post('/create-batch', createBatchJobs);
router.get('/progress/:jobId', streamJobProgress);
router.get('/history', getJobHistory);
router.get('/:jobId', getJobDetails);

export default router;

