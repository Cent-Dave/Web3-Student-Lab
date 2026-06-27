import type { PrismaClient } from '@prisma/client';
import { redisConnection } from '../utils/redis.js';
import logger from '../utils/logger.js';

export type GraphQLContext = {
  prisma: PrismaClient;
  redis: unknown;
  user?: { id: string; email: string; name: string };
};

export const createGraphQLContext = async (): Promise<GraphQLContext> => {
  const prismaModule = await import('../db/index.js');
  return {
    prisma: prismaModule.prisma as PrismaClient,
    redis: redisConnection,
    user: undefined,
  };
};
