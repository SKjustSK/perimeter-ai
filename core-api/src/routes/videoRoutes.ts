import { Router } from 'express';
import { getUploadUrl, processVideo, getJobStatus, getJobs, streamJobUpdates } from '../controllers/videoController.js';

const router = Router();

router.post('/upload', getUploadUrl);
router.post('/process', processVideo);
router.get('/job/:id', getJobStatus);
router.get('/stream', streamJobUpdates); // SSE endpoint — must be before GET /
router.get('/', getJobs);

export default router;