import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Web3 Student Lab API Documentation',
      version: '1.0.0',
      description:
        'API documentation for the Web3 Student Lab platform — a decentralized learning platform built on Stellar. ' +
        'This specification covers authentication (Web2 + Web3/Stellar), learning courses, certificates (NFT minting & verification), ' +
        'health monitoring, metrics, and more.',
      contact: {
        name: 'API Support',
        url: 'https://github.com/Web3-Student-Lab/Web3-Student-Lab',
        email: 'support@web3studentlab.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    externalDocs: {
      description: 'Project Repository',
      url: 'https://github.com/Web3-Student-Lab/Web3-Student-Lab',
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Development server',
      },
      {
        url: 'https://api.web3studentlab.com',
        description: 'Production server',
      },
    ],
    tags: [
      { name: 'System', description: 'Health checks and system status' },
      { name: 'Health', description: 'Health endpoints for monitoring' },
      { name: 'Auth', description: 'Authentication and authorization' },
      { name: 'Learning', description: 'Course and curriculum management' },
      { name: 'Certificates', description: 'Certificate minting, verification, and management' },
      { name: 'Metrics', description: 'Application performance and business metrics' },
      { name: 'Licenses', description: 'Open source license guide' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained via /api/v1/auth/login or /api/v1/auth/verify',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Human-readable error message' },
          },
          required: ['error'],
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique user identifier' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            did: { type: 'string', nullable: true, description: 'Decentralized identifier' },
            walletAddress: { type: 'string', nullable: true, description: 'Stellar wallet address' },
          },
          required: ['id', 'email', 'name'],
        },
        CurriculumCourse: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            instructor: { type: 'string' },
            credits: { type: 'integer' },
            modules: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  order: { type: 'integer' },
                  lessons: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        difficulty: { type: 'string', enum: ['beginner', 'intermediate', 'advanced'] },
                        order: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          required: ['id', 'title', 'instructor', 'credits', 'modules'],
        },
        Progress: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            studentId: { type: 'string' },
            courseId: { type: 'string' },
            completedLessons: { type: 'array', items: { type: 'string' } },
            currentModuleId: { type: 'string', nullable: true },
            percentage: { type: 'integer', minimum: 0, maximum: 100 },
            status: { type: 'string', enum: ['not_started', 'in_progress', 'completed'] },
            lastAccessedAt: { type: 'string', format: 'date-time', nullable: true },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
          },
          required: ['id', 'studentId', 'courseId', 'percentage', 'status'],
        },
        Certificate: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            tokenId: { type: 'string' },
            studentId: { type: 'string' },
            courseId: { type: 'string' },
            status: { type: 'string', enum: ['active', 'revoked', 'reissued'] },
            grade: { type: 'string', nullable: true },
            contractAddress: { type: 'string' },
            network: { type: 'string' },
            mintedAt: { type: 'string', format: 'date-time' },
            revokedAt: { type: 'string', format: 'date-time', nullable: true },
            metadata: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                image: { type: 'string', format: 'uri' },
              },
            },
          },
          required: ['id', 'tokenId', 'studentId', 'courseId', 'status'],
        },
      },
    },
  },
  apis: [
    './src/index.ts',
    './src/routes/*.ts',
    './src/routes/**/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
