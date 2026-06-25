import { describe, expect, it, jest } from '@jest/globals';
import {
  buildWebhookDeliveryJob,
  enqueueWebhookDeliveryToQueue,
} from '../src/services/webhooks/dispatcher.js';

describe('webhook dispatcher', () => {
  it('builds a delivery job with a unique delivery id', () => {
    const job = buildWebhookDeliveryJob({
      destination: { url: 'https://example.com/webhook' },
      event: {
        id: 'evt_1',
        type: 'lab.completed',
        occurredAt: '2026-05-31T00:00:00.000Z',
        source: 'lab-runner',
        data: { studentId: 'student_1' },
      },
      metadata: { courseId: 'course_1' },
    });

    expect(job.deliveryId).toEqual(expect.any(String));
    expect(job.destination.url).toBe('https://example.com/webhook');
    expect(job.event.type).toBe('lab.completed');
    expect(job.metadata).toEqual({ courseId: 'course_1' });
  });

  it('queues delivery jobs with BullMQ job options', async () => {
    const add = jest.fn().mockResolvedValue({ id: '1' });
    const queue = { add };

    const result = await enqueueWebhookDeliveryToQueue(queue, {
      destination: { url: 'https://example.com/webhook' },
      event: {
        id: 'evt_2',
        type: 'contract.deployed',
        occurredAt: '2026-05-31T00:00:00.000Z',
        source: 'contract-indexer',
        data: { contractId: 'contract_1' },
      },
    });

    expect(result.queue).toBe('webhook-delivery-queue');
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(
      'contract.deployed',
      expect.objectContaining({
        deliveryId: expect.any(String),
        destination: { url: 'https://example.com/webhook' },
      }),
      expect.objectContaining({
        priority: 10,
      })
    );
  });
});

