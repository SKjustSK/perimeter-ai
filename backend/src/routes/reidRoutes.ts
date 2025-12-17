import { Router } from 'express';
import multer from 'multer';
import { searchPerson, uploadVideo } from '../controllers/reidController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/search', upload.single('image'), searchPerson);
router.post('/cameras/:cameraId/video', upload.single('video'), uploadVideo);

export default router;
