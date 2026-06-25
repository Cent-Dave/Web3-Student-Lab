import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { PermanentWebhookDeliveryError, deliverWebhook } from '../src/services/webhooks/worker.js';

describe('webhook worker', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('delivers signed payloads to the destination endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(''),
    });

    const job = {
      data: {
        deliveryId: 'delivery_1',
        destination: {
          url: 'https://example.com/webhook',
          secret: 'destination-secret',
          headers: { 'x-custom-header': 'value' },
        },
        event: {
          id: 'evt_3',
          type: 'certificate.minted',
          occurredAt: '2026-05-31T00:00:00.000Z',
          source: 'certificate-service',
          data: { certificateId: 'cert_1' },
        },
        metadata: { workspaceId: 'workspace_1' },
      },
    } as any;

    const result = await deliverWebhook(job);

    expect(result).toEqual({
      statusCode: 200,
      deliveryId: 'delivery_1',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"deliveryId":"delivery_1"'),
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-webhook-delivery-id': 'delivery_1',
          'x-webhook-event': 'certificate.minted',
          'x-webhook-signature': expect.stringMatching(/^sha256=/),
          'x-webhook-timestamp': expect.any(String),
          'x-custom-header': 'value',
        }),
      })
    );
  });

  it('throws a retryable error for transient failures', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: jest.fn().mockResolvedValue('retry later'),
    });

    const job = {
      data: {
        deliveryId: 'delivery_2',
        destination: { url: 'https://example.com/webhook' },
        event: {
          id: 'evt_4',
          type: 'lab.completed',
          occurredAt: '2026-05-31T00:00:00.000Z',
          source: 'lab-runner',
          data: {},
        },
      },
    } as any;

    await expect(deliverWebhook(job)).rejects.toThrow('Retryable webhook delivery failure');
  });

  it('raises a permanent error for non-retryable failures', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: jest.fn().mockResolvedValue('bad payload'),
    });

    const job = {
      data: {
        deliveryId: 'delivery_3',
        destination: { url: 'https://example.com/webhook' },
        event: {
          id: 'evt_5',
          type: 'lab.completed',
          occurredAt: '2026-05-31T00:00:00.000Z',
          source: 'lab-runner',
          data: {},
        },
      },
    } as any;

    await expect(deliverWebhook(job)).rejects.toBeInstanceOf(PermanentWebhookDeliveryError);
  });
});

