import { Router } from 'express';
import { getUploadUrl, processVideo, getJobStatus, getJobs } from '../controllers/videoController.js';

const router = Router();

router.post('/upload', getUploadUrl);
router.post('/process', processVideo);
router.get('/job/:id', getJobStatus);
router.get('/', getJobs);

export default router;