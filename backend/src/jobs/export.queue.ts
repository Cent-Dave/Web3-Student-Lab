import { Queue } from 'bullmq';
import { redisConnection } from '../utils/redis.js';

export const EXPORT_QUEUE_NAME = 'export-queue';

const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');

export const exportQueue = new Queue(EXPORT_QUEUE_NAME, {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port) || 6379,
    password: redisUrl.password || undefined,
    maxRetriesPerRequest: null,
  },
});

