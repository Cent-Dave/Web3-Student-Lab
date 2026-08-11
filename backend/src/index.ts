import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Web3 Student Lab Backend is running' });
});

// Mount main API v1 router
app.use('/api/v1', routes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
