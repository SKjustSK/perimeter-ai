import { EventEmitter } from 'events';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Single shared EventEmitter — all SSE connections listen on this.
// No artificial listener cap so any number of browser tabs can connect.
export const sseEmitter = new EventEmitter();
sseEmitter.setMaxListeners(0);

// One dedicated Redis subscriber shared across the entire process.
// A subscriber client cannot run regular commands (rPush, get, etc.) so it
// is kept separate from the main redisClient in redis.ts.
export async function initSseSubscriber(): Promise<void> {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = process.env.REDIS_PORT || '6379';
  const subscriber = createClient({
    url: process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`
  });

  subscriber.on('error', (err) =>
    console.error('[-] SSE Redis subscriber error:', err)
  );

  await subscriber.connect();

  // Forward every job:updates message into the in-process EventEmitter.
  // All connected SSE handlers will receive it without any extra Redis hops.
  await subscriber.subscribe('job:updates', (message) => {
    sseEmitter.emit('job:update', message);
  });

  console.log('[+] SSE subscriber initialized — listening on job:updates');
}
