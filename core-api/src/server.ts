import app from './app.js';
import redisClient from './config/redis.js';
import { initSseSubscriber } from './config/sseEmitter.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Connect to Redis queue before starting HTTP server
const startServer = async () => {
  try {
    await redisClient.connect();
    console.log('[+] Connected to Redis Queue');

    // Initialize the singleton SSE subscriber (one Redis connection shared
    // across all browser tabs — replaces per-tab createClient calls)
    await initSseSubscriber();

    app.listen(PORT, () => {
      console.log(`[+] core-api online on port ${PORT}`);
    });
  } catch (error) {
    console.error('[-] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();