// @ts-nocheck
import { randomUUID } from 'crypto';
import { Request, Response, Router } from 'express';
import { GeneratorService } from '../../generator/generator.service.js';
import { getRandomProjectIdea, mockProjectIdeas } from '../../generator/mockData.js';
import { storageService } from '../../services/storage/index.js';
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

export default router;
