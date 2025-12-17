import express from 'express';
import cors from 'cors';
import { initQdrant } from './services/qdrantService.js';
import cameraRoutes from './routes/cameraRoutes.js';
import reidRoutes from './routes/reidRoutes.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/cameras', cameraRoutes);
app.use('/api/reid', reidRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date() });
});

async function main() {
    // 1. Init Database and Vector Store Collections
    await initQdrant();

    // 2. Start Listening
    app.listen(port, () => {
        console.log(`Backend Server listening on port ${port}`);
    });
}

main().catch(err => {
    console.error('Server startup failed:', err);
});
