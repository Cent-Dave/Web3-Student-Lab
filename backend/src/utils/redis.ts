import { Redis } from 'ioredis';
import { getEnvVar } from './checkEnv.js';
import logger from './logger.js';

const redisUrl = getEnvVar('REDIS_URL', 'redis://localhost:6379');

if (!process.env.REDIS_URL) {
  logger.warn('⚠️  REDIS_URL is not set, defaulting to redis://localhost:6379. Cache will not work if Redis is not running locally.');
}

const createTestRedisClient = () => {
  const memoryStore = new Map<string, string>();

  return {
    connect: async () => undefined,
    disconnect: async () => undefined,
    quit: async () => undefined,
    ping: async () => 'PONG',
    info: async () => 'test-redis',
    on: () => undefined,
    off: () => undefined,
    get: async (key: string) => memoryStore.get(key) ?? null,
    set: async (key: string, value: string) => {
      memoryStore.set(key, value);
      return 'OK';
    },
    setex: async (key: string, _ttl: number, value: string) => {
      memoryStore.set(key, value);
      return 'OK';
    },
    del: async (...keys: string[]) => {
      keys.forEach((key) => memoryStore.delete(key));
      return keys.length;
    },
    lpush: async (_key: string, ...values: string[]) => values.length,
    brpop: async () => null,
    publish: async (_channel: string, _message: string) => 0,
    subscribe: (..._args: any[]) => undefined,
  };
};

const createRedisClient = () => {
  if (process.env.NODE_ENV === 'test') {
    return createTestRedisClient() as unknown as Redis;
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  client.on('error', (err) => {
    console.warn(`Redis connection error: ${err.message}`);
  });

  return client;
};

export const redisConnection: any = createRedisClient();

export const pubClient: any = createRedisClient();

export const subClient: any = createRedisClient();

export default redisConnection;
