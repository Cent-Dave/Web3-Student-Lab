// @ts-nocheck
import { randomUUID } from 'crypto';
import { Request, Response, Router } from 'express';
import { GeneratorService } from '../../generator/generator.service.js';
import { getRandomProjectIdea, mockProjectIdeas } from '../../generator/mockData.js';
import { storageService } from '../../services/storage/index.js';
import logger from '../../utils/logger.js';

const router = Router();
const generatorService = new GeneratorService();
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * @route   POST /api/generator/generate
 * @desc    Generate a new project idea using AI (with mock data fallback)
 * @access  Public
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const {
      theme,
      techStack,
      difficulty,
      persistToStorage,
      queuedPersist,
      customRpcUrl,
    } = req.body;

    const fail400 = (message: string, field?: string) => {
      const payload: Record<string, unknown> = { error: message };
      if (field) payload.field = field;
      res.status(400).json(payload);
    };

    // Validate required inputs
    if (typeof theme !== 'string' || !theme.trim()) {
      fail400('Theme is required and must be a non-empty string', 'theme');
      return;
    }

    if (!Array.isArray(techStack) || techStack.length === 0) {
      fail400('techStack is required and must be a non-empty array', 'techStack');
      return;
    }

    const techStackClean = techStack
      .filter((v: unknown) => typeof v === 'string')
      .map((v: string) => v.trim())
      .filter(Boolean);

    if (techStackClean.length === 0) {
      fail400('techStack must contain at least one non-empty string', 'techStack');
      return;
    }

    const difficultyAllowed = new Set(['Beginner', 'Intermediate', 'Advanced']);
    if (!difficultyAllowed.has(difficulty)) {
      fail400('difficulty must be one of Beginner, Intermediate, Advanced', 'difficulty');
      return;
    }

    // Validate optional custom RPC URL
    let normalizedCustomRpcUrl: string | undefined;
    if (customRpcUrl !== undefined && customRpcUrl !== null) {
      if (typeof customRpcUrl !== 'string') {
        fail400('customRpcUrl must be a string if provided', 'customRpcUrl');
        return;
      }

      const trimmed = customRpcUrl.trim();
      if (!trimmed) {
        fail400('customRpcUrl cannot be empty', 'customRpcUrl');
        return;
      }

      // Prevent prompt-abuse with extremely long URLs
      if (trimmed.length > 2048) {
        fail400('customRpcUrl is too long', 'customRpcUrl');
        return;
      }

      let url: URL;
      try {
        url = new URL(trimmed);
      } catch {
        fail400('customRpcUrl is not a valid URL', 'customRpcUrl');
        return;
      }

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        fail400('customRpcUrl must use http or https', 'customRpcUrl');
        return;
      }

      // Normalize: drop trailing slash to keep deterministic prompt and downstream usage
      url.pathname = url.pathname.replace(/\/$/, '');

      // Defensive: strip credentials from URL (username:password@host)
      url.username = '';
      url.password = '';

      normalizedCustomRpcUrl = url.toString();
    }

    // Try AI generation first, fallback to mock data if it fails
    try {
      const projectIdea = await generatorService.generateProjectIdea(
        theme.trim(),
        techStackClean,
        difficulty,
        normalizedCustomRpcUrl
      );

      if (persistToStorage) {
        const projectId = `${slugify(theme.trim())}-${Date.now()}-${randomUUID().slice(0, 8)}`;
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
        });
        return;
      }

      res.json({ projectIdea });
    } catch (aiError) {
      logger.warn(`AI generation failed, using mock data: ${aiError}`);
      // Return a random mock project idea as fallback
      const projectIdea = getRandomProjectIdea();
      if (persistToStorage) {
        const projectId = `mock-${Date.now()}-${randomUUID().slice(0, 8)}`;
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
        });
        return;
      }

      res.json({ projectIdea, fromMock: true });
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
