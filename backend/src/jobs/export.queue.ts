import { Queue } from 'bullmq';

export const EXPORT_QUEUE_NAME = 'export-queue';

const redisUrl = new URL(process.env.REDIS_URL || (() => {
  throw new Error('REDIS_URL environment variable is required');
})());

export const exportQueue = new Queue(EXPORT_QUEUE_NAME, {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port) || 6379,
    password: redisUrl.password || undefined,
    maxRetriesPerRequest: null,
  },
});
