import express from 'express';
import multer from 'multer';
import { searchTarget } from '../controllers/searchController.js';

const router = express.Router();

// Store uploads in memory to forward buffers directly to Python API
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/search/target
router.post('/target', upload.single('image'), searchTarget);

export default router;