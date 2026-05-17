import { Router } from 'express';
import { createCamera, getCameras, resetDatabase } from '../controllers/cameraController.js';

const router = Router();

router.post('/', createCamera);
router.get('/', getCameras);
router.post('/reset', resetDatabase);

export default router;