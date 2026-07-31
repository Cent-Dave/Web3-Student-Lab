/**
 * Metrics Routes — exposes collected metrics over HTTP.
 *
 * Endpoints:
 *   GET  /api/v1/metrics          — aggregated summary
 *   GET  /api/v1/metrics/performance — raw performance entries
 *   GET  /api/v1/metrics/errors      — raw error entries
 *   GET  /api/v1/metrics/business    — raw business event entries
 *   POST /api/v1/metrics/reset       — clear all metrics (admin use)
 *
 * Educational note: In a real deployment you would protect these endpoints
 * with an admin-only auth middleware. Here we keep it simple and rely on
 * the existing workspace/rate-limit middleware applied at the router level.
 */

import { Router, Request, Response } from 'express';
import metricsCollector from '../metrics/MetricsCollector.js';

const router = Router();

/**
 * @openapi
 * /api/v1/metrics:
 *   get:
 *     summary: Get aggregated metrics summary
 *     description: Returns a summary of all collected application metrics.
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   description: Aggregated metrics summary
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'success', data: metricsCollector.getSummary() });
});

/**
 * @openapi
 * /api/v1/metrics/performance:
 *   get:
 *     summary: Get raw performance metrics
 *     description: Returns raw performance metric entries (response times, throughput, etc.).
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/performance', (_req: Request, res: Response) => {
  res.json({ status: 'success', data: metricsCollector.getPerformanceMetrics() });
});

/**
 * @openapi
 * /api/v1/metrics/errors:
 *   get:
 *     summary: Get raw error metrics
 *     description: Returns raw error metric entries (error counts, types, routes).
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Error metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/errors', (_req: Request, res: Response) => {
  res.json({ status: 'success', data: metricsCollector.getErrorMetrics() });
});

/**
 * @openapi
 * /api/v1/metrics/business:
 *   get:
 *     summary: Get raw business event metrics
 *     description: Returns raw business event entries (registrations, logins, certificate mints).
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Business event metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/business', (_req: Request, res: Response) => {
  res.json({ status: 'success', data: metricsCollector.getBusinessMetrics() });
});

/**
 * @openapi
 * /api/v1/metrics/reset:
 *   post:
 *     summary: Reset all collected metrics
 *     description: Clears all in-memory collected metrics. Requires admin authorization.
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Metrics reset successfully
 */
router.post('/reset', (_req: Request, res: Response) => {
  metricsCollector.reset();
  res.json({ status: 'success', message: 'Metrics reset successfully' });
});

export default router;
