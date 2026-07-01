// @ts-nocheck
import { Router } from 'express';
import dashboardRoutes from '../dashboard/dashboard.routes.js';
import activityLogRouter from '../dashboard/activityLog.routes.js';
import feedbackRouter from '../feedback/feedback.routes.js';
import userRouter from '../user/routes.js';
import analyticsRouter from './analytics.routes.js';
import authRoutes from './auth/auth.routes.js';
import certificatesRouter from './certificates.routes.js';
import contractRouter from './contracts.routes.js';
import coursesRouter from './courses.js';
import enrollmentsRouter from './enrollments.js';
import exportRouter from './export.routes.js';
import generatorRouter from './generator/generator.routes.js';
import healthRouter from './health.routes.js';
import learningRoutes from './learning/learning.routes.js';
import curriculumSearchRouter from './search/curriculum-search.routes.js';
import securityRouter from './security.routes.js';
import studentsRouter from './students.js';
import simulatorErrorsRouter from './simulatorErrors.routes.js';
import termsOfServiceRouter from './termsOfService.routes.js';
import privacyPolicyRouter from './privacyPolicy.routes.js';
import playgroundRouter from './playground.routes.js';
import oauthRouter from './oauth.routes.js';

import notificationRouter from '../notifications/notification.routes.js';
import notificationPreferencesRouter from '../notifications/preferences.routes.js';
import metricsRouter from './metrics.routes.js';
import infrastructureRouter from '../infrastructure/infrastructure.routes.js';
import simulatorRouter from '../simulator/simulator.routes.js';

import webhooksRouter from './webhooks.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/analytics', analyticsRouter);
router.use('/students', studentsRouter);
router.use('/certificates', certificatesRouter);
router.use('/courses', coursesRouter);
router.use('/enrollments', enrollmentsRouter);
router.use('/dashboard', dashboardRoutes);
router.use('/dashboard/activity-log', activityLogRouter);
router.use('/feedback', feedbackRouter);
router.use('/auth', authRoutes);
router.use('/learning', learningRoutes);
router.use('/search', curriculumSearchRouter);
router.use('/contracts', contractRouter);
router.use('/notifications', notificationRouter);
router.use('/notifications/preferences', notificationPreferencesRouter);
router.use('/security', securityRouter);
router.use('/generator', generatorRouter);
router.use('/export', exportRouter);
router.use('/webhooks', webhooksRouter);
router.use('/user', userRouter);
router.use('/metrics', metricsRouter);
router.use('/infrastructure', infrastructureRouter);
router.use('/simulator', simulatorRouter);
router.use('/simulator/errors', simulatorErrorsRouter);
router.use('/roadmap/tos', termsOfServiceRouter);
router.use('/playground', playgroundRouter);
router.use('/playground/privacy-policy', privacyPolicyRouter);
router.use('/oauth', oauthRouter);

export default router;
