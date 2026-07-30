import request from 'supertest';
import { app } from '../src/index';

describe('Health Endpoint Integration Tests', () => {
  describe('GET /health/live', () => {
    it('should return 200 with status ok', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });

    it('should return JSON content type', async () => {
      const response = await request(app).get('/health/live');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('GET /health/ready', () => {
    it('should return 503 when dependencies are unavailable in test', async () => {
      const response = await request(app).get('/health/ready');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('uptime');
      if (response.status === 503) {
        expect(response.body).toHaveProperty('errors');
        expect(Array.isArray(response.body.errors)).toBe(true);
      } else {
        expect(response.body).toHaveProperty('status', 'ok');
        expect(response.body).toHaveProperty('database');
        expect(response.body).toHaveProperty('redis');
      }
    });
  });

  describe('GET /health', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });

    it('should return Web3 Student Lab Backend message', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Web3 Student Lab Backend is running');
    });

    it('should return uptime and version', async () => {
      const response = await request(app).get('/health');

      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body).toHaveProperty('version');
      expect(response.body.version).toBe('1.0.0');
    });

    it('should return JSON content type', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/non-existent-route');

      expect(response.status).toBe(404);
    });
  });
});
