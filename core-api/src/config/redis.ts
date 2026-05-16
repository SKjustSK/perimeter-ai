import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Redis client
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || '6379';
const redisClient = createClient({ url: process.env.REDIS_URL || `redis://${redisHost}:${redisPort}` });

redisClient.on('error', (err) => console.error('[-] Redis Client Error', err));

export default redisClient;