import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Web3 Student Lab API Documentation',
      version: '1.0.0',
      description: 'API documentation for the Web3 Student Lab platform',
      contact: {
        name: 'API Support',
        url: 'https://github.com/ekelemepraise-code/Web3-Student-Lab',
      },
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Development server',
      },
      {
        url: 'https://api.web3studentlab.com', // Example production URL
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        metricsToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Metrics-Token',
          description: 'Shared secret for operational metrics endpoints (METRICS_AUTH_TOKEN).',
        },
      },
      schemas: {
        ApiFieldError: {
          type: 'object',
          description: 'A single rejected field. Never contains the submitted value.',
          required: ['field', 'message'],
          properties: {
            field: {
              type: 'string',
              description: 'Dot-separated path of the invalid field.',
              example: 'tokenId',
            },
            message: {
              type: 'string',
              description: 'Reason the field was rejected.',
              example: 'tokenId must be alphanumeric',
            },
          },
        },
        ErrorEnvelope: {
          type: 'object',
          description:
            'Single error envelope used by every handled error response. `message` is always safe for clients; full detail is logged server-side against `requestId`.',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['version', 'code', 'message', 'requestId', 'timestamp'],
              properties: {
                version: {
                  type: 'string',
                  description: 'Envelope schema version. Bumped only on breaking changes.',
                  example: '1',
                },
                code: {
                  type: 'string',
                  description: 'Stable machine-readable error code. Branch on this, not on text.',
                  enum: [
                    'BAD_REQUEST',
                    'VALIDATION_FAILED',
                    'UNAUTHORIZED',
                    'FORBIDDEN',
                    'NOT_FOUND',
                    'CONFLICT',
                    'UNPROCESSABLE_ENTITY',
                    'RATE_LIMITED',
                    'INTERNAL_ERROR',
                    'SERVICE_UNAVAILABLE',
                  ],
                  example: 'VALIDATION_FAILED',
                },
                message: {
                  type: 'string',
                  description:
                    'Client-safe description. Server faults collapse to a generic sentence; stack traces are never included.',
                  example: 'Request validation failed',
                },
                requestId: {
                  type: 'string',
                  description:
                    'Correlation ID for this request; also returned as the X-Correlation-ID response header. Quote it in support requests.',
                  example: '9f1c2e3a-6b74-4c0f-9a5c-7b1d2e3f4a5b',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                },
                fieldErrors: {
                  type: 'array',
                  description: 'Present on validation failures only.',
                  items: { $ref: '#/components/schemas/ApiFieldError' },
                },
              },
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Malformed request.',
          headers: {
            'X-Correlation-ID': {
              description: 'Correlation ID matching error.requestId.',
              schema: { type: 'string' },
            },
          },
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } },
          },
        },
        ValidationError: {
          description: 'Request validation failed — see error.fieldErrors.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } },
          },
        },
        Unauthorized: {
          description: 'Missing or invalid credentials.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } },
          },
        },
        Forbidden: {
          description: 'Authenticated but not permitted.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } },
          },
        },
        NotFound: {
          description: 'Resource not found.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } },
          },
        },
        RateLimited: {
          description: 'Rate limit exceeded.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } },
          },
        },
        InternalError: {
          description: 'Unexpected server error. Detail is logged against error.requestId.',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/routes/**/*.ts',
    './src/controllers/*.ts',
    './src/controllers/**/*.ts',
  ], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
