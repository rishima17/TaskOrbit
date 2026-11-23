import { Router } from 'express';
import { getDlqJobs, requeueJob, getQueueMetrics } from '../controllers/adminController.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';

const router = Router();

// Protect all admin endpoints with authentication & Admin RBAC check
router.use(requireAuth, requireAdmin);

router.get('/dlq', getDlqJobs);
router.post('/requeue/:jobId', requeueJob);
router.get('/metrics', getQueueMetrics);

export default router;

