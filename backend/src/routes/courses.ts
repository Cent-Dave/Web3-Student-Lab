import { Router, Request, Response } from 'express';
import { cacheMiddleware } from '../cache/CacheMiddleware.js';
import { invalidateAllCourses, invalidateCourseCache } from '../cache/CacheInvalidation.js';
import { cacheTTL } from '../config/redis.config.js';
import prisma from '../db/index.js';
import { auditAction } from '../middleware/audit.js';
import { createNotification } from '../notifications/index.js';
import { buildLinkHeader, decodeCursor, encodeCursor, paginateKeyset } from '../search/PaginationHelper.js';

const router = Router();

interface MockCourse {
  id: string;
  title: string;
  description: string | null;
  instructor: string;
  credits: number;
  createdAt: string;
  updatedAt: string;
}

// Robust Mock Database for 100% Demo Uptime
let courses: MockCourse[] = [
  {
    id: 'cm1yxxxx-intro',
    title: 'Introduction to Web3 and Stellar',
    description:
      'Learn the foundational concepts of blockchain technology, decentralized networks, and how the Stellar consensus protocol enables fast, low-cost cross-border payments.',
    instructor: 'Satoshi N.',
    credits: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cm1yxxxx-soroban',
    title: 'Soroban Smart Contracts 101',
    description:
      'A deep dive into writing secure smart contracts on the Stellar network using Rust and the Soroban SDK. Execute state changes and build immutable modules.',
    instructor: 'Vitalik B.',
    credits: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cm1yxxxx-defi',
    title: 'Decentralized Finance (DeFi) primitives',
    description:
      'Master the core primitives of DeFi including Liquidity Pools, Automated Market Makers (AMMs), and yield generation directly on-chain.',
    instructor: 'Hayden A.',
    credits: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

async function ensureSeedCourses() {
  try {
    const count = await prisma.course.count();
    if (count > 0) {
      const persistedCourses = await prisma.course.findMany({
        orderBy: {
          createdAt: 'asc',
        },
      });
      courses = persistedCourses.map((course) => ({
        ...course,
        createdAt: course.createdAt.toISOString(),
        updatedAt: course.updatedAt.toISOString(),
      }));
      return courses;
    }

    for (const course of courses) {
      await prisma.course.create({
        data: {
          id: course.id,
          title: course.title,
          description: course.description,
          instructor: course.instructor,
          credits: course.credits,
        },
      });
    }

    return courses;
  } catch {
    return courses;
  }
}

// GET /api/courses - Get all courses (supports cursor pagination)
router.get('/', cacheMiddleware({ ttl: cacheTTL.courses.list }), async (req: Request, res: Response) => {
  try {
    const availableCourses = await ensureSeedCourses();
    const cursorParam = req.query.cursor as string | undefined;
    const takeParam = parseInt((req.query.take || req.query.limit) as string, 10) || 20;

    if (cursorParam || req.query.take) {
      const result = await paginateKeyset(
        async (args) => {
          let filtered = [...availableCourses];
          if (args.cursor?.id) {
            const index = filtered.findIndex((c) => c.id === args.cursor?.id);
            if (index !== -1) {
              filtered = filtered.slice(index + (args.skip || 0));
            }
          }
          return filtered.slice(0, args.take);
        },
        { take: takeParam, cursor: cursorParam }
      );

      const linkHeader = buildLinkHeader('/api/courses', {}, result.nextCursor, result.prevCursor);
      if (linkHeader) {
        res.setHeader('Link', linkHeader);
      }

      return res.json({
        data: result.items,
        pagination: {
          nextCursor: result.nextCursor,
          prevCursor: result.prevCursor,
          hasMore: result.hasMore,
        },
      });
    }

    res.json(availableCourses);
  } catch {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// GET /api/courses/:id - Get course by ID
router.get(
  '/:id',
  cacheMiddleware({
    ttl: cacheTTL.courses.detail,
    keyGenerator: (req) => `course:${req.params.id}`,
  }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const availableCourses = await ensureSeedCourses();
      const course = availableCourses.find((c) => c.id === id);

      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      res.json(course);
    } catch {
      res.status(500).json({ error: 'Failed to fetch course' });
    }
  }
);

// POST /api/courses - Create a new course
router.post('/', auditAction('CREATE_COURSE', 'Course'), async (req, res) => {
  try {
    const { title, description, instructor, credits } = req.body;

    if (!title || !instructor) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newCourse = {
      id: `course-${Date.now()}`,
      title,
      description,
      instructor,
      credits: credits || 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createdCourse = await prisma.course.create({
      data: {
        id: newCourse.id,
        title: newCourse.title,
        description: newCourse.description,
        instructor: newCourse.instructor,
        credits: newCourse.credits,
      },
    });

    courses.push({
      ...createdCourse,
      createdAt: createdCourse.createdAt.toISOString(),
      updatedAt: createdCourse.updatedAt.toISOString(),
    });
    await invalidateAllCourses();

    // Notify students about the new course
    await createNotification({
      type: 'course_created',
      courseId: newCourse.id,
      courseTitle: newCourse.title,
      title: 'New Course Available',
      message: `"${newCourse.title}" has been added — enroll now to start learning.`,
      metadata: { instructor: newCourse.instructor, credits: newCourse.credits },
    });

    res.status(201).json(newCourse);
  } catch {
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// PUT /api/courses/:id - Update a course
router.put('/:id', auditAction('UPDATE_COURSE', 'Course'), async (req: Request, res: Response) => {
  try {
    const courseId = String(req.params.id);
    const { title, description, instructor, credits } = req.body;

    await ensureSeedCourses();
    const index = courses.findIndex((c) => c.id === courseId);

    if (index === -1) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const targetCourse = courses[index];

    const oldTitle = targetCourse?.title ?? '';

    if (targetCourse) {
      Object.assign(targetCourse, {
        title,
        description,
        instructor,
        credits,
        updatedAt: new Date().toISOString(),
      });
    }

    await prisma.course.update({
      where: { id: courseId },
      data: {
        title,
        description,
        instructor,
        credits,
      },
    });

    await invalidateCourseCache(courseId);

    // Notify enrolled students about the update
    const newTitle = targetCourse?.title ?? title ?? oldTitle;
    if (oldTitle !== newTitle || description) {
      await createNotification({
        type: 'course_updated',
        courseId,
        courseTitle: newTitle,
        title: 'Course Updated',
        message: `"${newTitle}" has been updated with new content. Check it out!`,
        metadata: { oldTitle, changes: { title: title !== oldTitle, description: !!description } },
      });
    }

    res.json(targetCourse);
  } catch {
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// DELETE /api/courses/:id - Delete a course
router.delete('/:id', auditAction('DELETE_COURSE', 'Course'), async (req: Request, res: Response) => {
  try {
    const courseId = String(req.params.id);

    courses = courses.filter((c) => c.id !== courseId);
    await prisma.course.delete({
      where: { id: courseId },
    });

    await invalidateCourseCache(courseId);

    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

export default router;
