import express from 'express';
import cameraRoutes from './routes/cameraRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import searchRoutes from './routes/searchRoutes.js'

const app = express();

// CORS Middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Middleware
app.use(express.json());

// Register API routes
app.use('/api/cameras', cameraRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/search', searchRoutes);

// Basic health check route
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'core-api' });
});

export default app;