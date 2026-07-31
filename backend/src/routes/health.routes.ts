import { Router } from 'express';
import { cbManager } from '../lib/circuit-breaker/CircuitBreakerManager.js';
import { checkDbHealth } from '../db/healthMonitor.js';

const router = Router();

/**
 * @openapi
 * /api/v1/health/circuit-breakers:
 *   get:
 *     summary: Get status of all circuit breakers
 *     description: Returns the current state of all circuit breakers in the system.
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Success
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
 */
router.get('/circuit-breakers', (req, res) => {
  const stats = cbManager.getStats();
  res.json({
    status: 'success',
    data: stats,
  });
});

/**
 * @openapi
 * /api/v1/health/db:
 *   get:
 *     summary: Database health check
 *     description: Checks database connectivity with pool usage and latency metrics. Returns HTTP 200 when healthy or degraded, HTTP 503 when unreachable.
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Database is healthy or degraded (still operational)
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
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                     latencyMs:
 *                       type: number
 *                       description: Round-trip time for SELECT 1
 *                     poolUsage:
 *                       type: object
 *                       properties:
 *                         active:
 *                           type: integer
 *                           description: Connections currently executing queries
 *                         idle:
 *                           type: integer
 *                           description: Connections waiting in pool
 *                         total:
 *                           type: integer
 *                           description: Pool capacity (DB_POOL_MAX env var)
 *                         utilizationPct:
 *                           type: number
 *                           description: active / total * 100
 *                     alerts:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Human-readable anomaly descriptions
 *                     checkedAt:
 *                       type: string
 *                       format: date-time
 *                       description: ISO timestamp of the check
 *       503:
 *         description: Database is unreachable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/db', async (req, res) => {
  const health = await checkDbHealth();
  const httpStatus = health.status === 'unhealthy' ? 503 : 200;
  res.status(httpStatus).json({ status: 'success', data: health });
});

export default router;
