import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { initializeSentry, getSentryRequestHandler, getSentryErrorHandler } from './utils/sentry.js';
import { createCorsMiddleware } from './config/cors.config.js';

dotenv.config();

export const app = express();
const port = process.env.PORT || 8080;

// Initialize Sentry Telemetry and Distributed Tracing
initializeSentry(app);

// Mount Sentry Request Handler middleware
app.use(getSentryRequestHandler());

app.use(createCorsMiddleware());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Web3 Student Lab Backend is running' });
});

// Mount main API v1 router
app.use('/api/v1', routes);

// Mount Sentry Error Handler middleware
app.use(getSentryErrorHandler());

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
