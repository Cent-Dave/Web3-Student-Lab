import { randomUUID } from 'crypto';
import type { JobsOptions } from 'bullmq';
import logger from '../../utils/logger.js';
import {
  webhookDeliveryQueue,
  WEBHOOK_DELIVERY_QUEUE_NAME,
} from './queue.js';
import type {
  WebhookDeliveryJobData,
  WebhookDeliveryRequest,
  WebhookDestination,
  WebhookEventPayload,
} from './types.js';

export const buildWebhookDeliveryJob = (request: WebhookDeliveryRequest): WebhookDeliveryJobData => {
  return {
    deliveryId: randomUUID(),
    destination: request.destination,
    event: request.event,
    metadata: request.metadata,
  };
};

export const buildWebhookJobOptions = (overrides: Partial<JobsOptions> = {}): JobsOptions => {
  return {
    priority: 10,
    ...overrides,
  };
};

export const enqueueWebhookDelivery = async (
  request: WebhookDeliveryRequest,
  overrides: Partial<JobsOptions> = {}
): Promise<{ deliveryId: string; queue: string }> => {
  return enqueueWebhookDeliveryToQueue(webhookDeliveryQueue, request, overrides);
};

export const enqueueWebhookDeliveryToQueue = async (
  queue: Pick<typeof webhookDeliveryQueue, 'add'>,
  request: WebhookDeliveryRequest,
  overrides: Partial<JobsOptions> = {}
): Promise<{ deliveryId: string; queue: string }> => {
  const job = buildWebhookDeliveryJob(request);
  await queue.add(job.event.type, job, buildWebhookJobOptions(overrides));

  logger.info(`Queued webhook delivery ${job.deliveryId} for ${job.destination.url}`);

  return {
    deliveryId: job.deliveryId,
    queue: WEBHOOK_DELIVERY_QUEUE_NAME,
  };
};

export const enqueueWebhookDeliveries = async (
  event: WebhookEventPayload,
  destinations: WebhookDestination[],
  metadata: Record<string, unknown> = {}
): Promise<Array<{ deliveryId: string; queue: string }>> => {
  const jobs = destinations.map((destination) =>
    enqueueWebhookDelivery({
      destination,
      event,
      metadata,
    })
  );

  return Promise.all(jobs);
};
