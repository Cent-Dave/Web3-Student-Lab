export type WebhookEventName =
  | 'lab.completed'
  | 'contract.deployed'
  | 'certificate.minted'
  | 'onchain.event'
  | (string & {});

export interface WebhookEventPayload {
  id: string;
  type: WebhookEventName;
  occurredAt: string;
  source: string;
  data: Record<string, unknown>;
}

export interface WebhookDestination {
  id?: string;
  url: string;
  secret?: string;
  headers?: Record<string, string>;
}

export interface WebhookDeliveryRequest {
  destination: WebhookDestination;
  event: WebhookEventPayload;
  metadata?: Record<string, unknown>;
}

export interface WebhookDeliveryJobData extends WebhookDeliveryRequest {
  deliveryId: string;
}

export interface DeadLetterWebhookJob extends WebhookDeliveryJobData {
  failedAt: string;
  error: string;
  statusCode?: number;
}

export interface SignedWebhookHeaders {
  'content-type': 'application/json';
  'x-webhook-delivery-id': string;
  'x-webhook-event': string;
  'x-webhook-signature': string;
  'x-webhook-timestamp': string;
}

