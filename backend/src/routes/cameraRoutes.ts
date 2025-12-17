import { Router } from 'express';
import { createCamera, getCameras } from '../controllers/cameraController.js';

const router = Router();

router.post('/', createCamera);
router.get('/', getCameras);

export default router;
