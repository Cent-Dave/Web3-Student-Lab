// @ts-nocheck
import { randomUUID } from 'crypto';
import { Request, Response, Router } from 'express';
import { GeneratorService } from '../../generator/generator.service.js';
import { getRandomProjectIdea, mockProjectIdeas } from '../../generator/mockData.js';
import { storageService } from '../../services/storage/index.js';
import prisma from '../../db/index.js';
import { createVestingScheduleSchema, claimVestingTokensSchema } from './vesting.validation.js';
import { validate } from '../../middleware/validation.js';
import logger from '../../utils/logger.js';
import { broadcastEvent } from '../../websocket/gateway.js';

const router = Router();
const generatorService = new GeneratorService();
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const generatorRequestCounts = new Map<string, { count: number; resetAt: number }>();

const generatorRateLimitMiddleware = (req: Request, res: Response, next: () => void) => {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const existing = generatorRequestCounts.get(key);

  if (!existing || existing.resetAt <= now) {
    generatorRequestCounts.set(key, { count: 1, resetAt: now + 60_000 });
    next();
    return;
  }

  if (existing.count >= 3) {
    res.status(429).json({ error: 'Generator rate limit exceeded. Please try again shortly.' });
    return;
  }

  existing.count += 1;
  next();
};

router.use('/generate', generatorRateLimitMiddleware);

/**
 * @route   POST /api/generator/generate
 * @desc    Generate a new project idea using AI (with mock data fallback)
 * @access  Public
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { theme, techStack, difficulty, persistToStorage, queuedPersist, subscribeToUpdates } = req.body;

    if (!theme || !techStack || !difficulty) {
      res.status(400).json({ error: 'Theme, techStack, and difficulty are required' });
      return;
    }

    const shouldSubscribe = Boolean(subscribeToUpdates);

    try {
      const projectIdea = await generatorService.generateProjectIdea(theme, techStack, difficulty);
      const projectId = `${slugify(theme)}-${Date.now()}-${randomUUID().slice(0, 8)}`;

      if (shouldSubscribe) {
        await broadcastEvent('generator:ideas', {
          event: 'idea-generated',
          projectId,
          theme,
          difficulty,
          projectIdea,
          generatedAt: new Date().toISOString(),
        });
      }

      if (persistToStorage) {
        const storageResult = queuedPersist
          ? await storageService.pinProjectIdea({
              projectId,
              content: projectIdea,
              queued: true,
            })
          : await storageService.pinProjectIdea({
              projectId,
              content: projectIdea,
            });

        res.json({
          projectIdea,
          storage: storageResult,
          ...(shouldSubscribe ? { subscription: { channel: 'generator:ideas', event: 'idea-generated', subscribed: true } } : {}),
        });
        return;
      }

      res.json({
        projectIdea,
        ...(shouldSubscribe ? { subscription: { channel: 'generator:ideas', event: 'idea-generated', subscribed: true } } : {}),
      });
    } catch (aiError) {
      logger.warn(`AI generation failed, using mock data: ${aiError}`);
      const projectIdea = getRandomProjectIdea();
      const projectId = `mock-${Date.now()}-${randomUUID().slice(0, 8)}`;

      if (shouldSubscribe) {
        await broadcastEvent('generator:ideas', {
          event: 'idea-generated',
          projectId,
          theme,
          difficulty,
          projectIdea,
          fromMock: true,
          generatedAt: new Date().toISOString(),
        });
      }

      if (persistToStorage) {
        const storageResult = queuedPersist
          ? await storageService.pinProjectIdea({
              projectId,
              content: projectIdea,
              queued: true,
            })
          : await storageService.pinProjectIdea({
              projectId,
              content: projectIdea,
            });

        res.json({
          projectIdea,
          fromMock: true,
          storage: storageResult,
          ...(shouldSubscribe ? { subscription: { channel: 'generator:ideas', event: 'idea-generated', subscribed: true } } : {}),
        });
        return;
      }

      res.json({
        projectIdea,
        fromMock: true,
        ...(shouldSubscribe ? { subscription: { channel: 'generator:ideas', event: 'idea-generated', subscribed: true } } : {}),
      });
    }
  } catch (error) {
    logger.error(`Generator Route Error: ${error}`);
    res.status(500).json({ error: 'Failed to generate project idea' });
  }
});

/**
 * @route   GET /api/generator/mock-ideas
 * @desc    Get all mock project ideas (for frontend development)
 * @access  Public
 */
router.get('/mock-ideas', (_req: Request, res: Response) => {
  res.json({ ideas: mockProjectIdeas });
});

/**
 * @route   POST /api/generator/vesting
 * @desc    Create a new vesting schedule
 * @access  Public
 */
router.post('/vesting', validate(createVestingScheduleSchema), async (req: Request, res: Response) => {
  try {
    const { projectId, tokenName, tokenSymbol, amount, cliffMonths, durationMonths, beneficiary } = req.body;

    const existing = await prisma.vestingSchedule.findUnique({
      where: { projectId }
    });
    if (existing) {
      res.status(400).json({ error: 'Vesting schedule already exists for this project' });
      return;
    }

    const schedule = await prisma.vestingSchedule.create({
      data: {
        projectId,
        tokenName,
        tokenSymbol,
        amount,
        cliffMonths,
        durationMonths,
        beneficiary,
        claimedAmount: 0
      }
    });

    res.status(201).json(schedule);
  } catch (error) {
    logger.error(`Create Vesting Schedule Error: ${error}`);
    res.status(500).json({ error: 'Failed to create vesting schedule' });
  }
});

/**
 * @route   GET /api/generator/vesting
 * @desc    Get all vesting schedules
 * @access  Public
 */
router.get('/vesting', async (req: Request, res: Response) => {
  try {
    const schedules = await prisma.vestingSchedule.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(schedules);
  } catch (error) {
    logger.error(`List Vesting Schedules Error: ${error}`);
    res.status(500).json({ error: 'Failed to retrieve vesting schedules' });
  }
});

/**
 * @route   GET /api/generator/vesting/:projectId
 * @desc    Get vesting schedule by project ID
 * @access  Public
 */
router.get('/vesting/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const schedule = await prisma.vestingSchedule.findUnique({
      where: { projectId }
    });
    if (!schedule) {
      res.status(404).json({ error: 'Vesting schedule not found' });
      return;
    }
    res.json(schedule);
  } catch (error) {
    logger.error(`Get Vesting Schedule Error: ${error}`);
    res.status(500).json({ error: 'Failed to retrieve vesting schedule' });
  }
});

/**
 * @route   POST /api/generator/vesting/:projectId/claim
 * @desc    Claim vesting tokens (simulated or real-time)
 * @access  Public
 */
router.post('/vesting/:projectId/claim', validate(claimVestingTokensSchema), async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { amount: claimAmount } = req.body;
    const simulatedMonths = req.body.simulatedMonthsElapsed !== undefined ? Number(req.body.simulatedMonthsElapsed) : null;

    const schedule = await prisma.vestingSchedule.findUnique({
      where: { projectId }
    });
    if (!schedule) {
      res.status(404).json({ error: 'Vesting schedule not found' });
      return;
    }

    let vestedAmount = 0;
    if (simulatedMonths !== null) {
      if (simulatedMonths >= schedule.durationMonths) {
        vestedAmount = schedule.amount;
      } else if (simulatedMonths < schedule.cliffMonths) {
        vestedAmount = 0;
      } else {
        vestedAmount = schedule.amount * (simulatedMonths / schedule.durationMonths);
      }
    } else {
      const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;
      const timeElapsedMs = Date.now() - schedule.createdAt.getTime();
      const cliffMs = schedule.cliffMonths * MONTH_IN_MS;
      const durationMs = schedule.durationMonths * MONTH_IN_MS;

      if (timeElapsedMs >= durationMs) {
        vestedAmount = schedule.amount;
      } else if (timeElapsedMs < cliffMs) {
        vestedAmount = 0;
      } else {
        vestedAmount = schedule.amount * (timeElapsedMs / durationMs);
      }
    }

    const claimableAmount = Math.max(0, vestedAmount - schedule.claimedAmount);

    if (claimAmount > claimableAmount) {
      res.status(400).json({
        error: `Requested claim amount ${claimAmount} exceeds claimable amount ${claimableAmount.toFixed(2)}`
      });
      return;
    }

    const updatedSchedule = await prisma.vestingSchedule.update({
      where: { projectId },
      data: {
        claimedAmount: {
          increment: claimAmount
        }
      }
    });

    res.json(updatedSchedule);
  } catch (error) {
    logger.error(`Claim Vesting Tokens Error: ${error}`);
    res.status(500).json({ error: 'Failed to process token claim' });
  }
});

export default router;
