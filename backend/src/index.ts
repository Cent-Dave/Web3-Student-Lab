import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { initializeSentry, getSentryRequestHandler, getSentryErrorHandler } from './utils/sentry.js';
import { jsonBodySizeLimit } from './middleware/bodySizeLimit.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// Initialize Sentry Telemetry and Distributed Tracing
initializeSentry(app);

// Mount Sentry Request Handler middleware
app.use(getSentryRequestHandler());

// Enable CORS with credentials support for Vercel frontend and local development
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow any requesting origin (Vercel, localhost, etc.) to support withCredentials: true
      callback(null, origin || true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-workspace-id',
      'X-Payload-Encryption',
      'sentry-trace',
      'baggage',
    ],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(jsonBodySizeLimit);

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Web3 Student Lab Backend is running' });
});

app.post('/api/security/csp-report', express.json(), (req: Request, res: Response) => {
  const report = req.body;
  logger.warn('CSP violation report', {
    report,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(204).end();
});

// Mount main API v1 router
app.use('/api/v1', routes);

// Mount Sentry Error Handler middleware
app.use(getSentryErrorHandler());

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
