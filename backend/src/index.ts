import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import { initializeSentry, getSentryRequestHandler, getSentryErrorHandler } from './utils/sentry.js';

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

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Web3 Student Lab Backend is running' });
});

// Mount main API v1 router
app.use('/api/v1', routes);

// Mount Sentry Error Handler middleware
app.use(getSentryErrorHandler());

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
