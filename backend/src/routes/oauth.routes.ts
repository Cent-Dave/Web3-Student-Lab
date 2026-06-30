import { Router, type Request, type Response } from 'express';

const router = Router();

router.get('/github', (_req: Request, res: Response) => {
  const redirectUrl = new URL('https://github.com/login/oauth/authorize');
  redirectUrl.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID || 'demo-client-id');
  redirectUrl.searchParams.set('scope', 'read:user');
  redirectUrl.searchParams.set('state', 'demo-state');
  res.redirect(redirectUrl.toString());
});

router.post('/github/callback', (_req: Request, res: Response) => {
  res.json({
    connected: true,
    provider: 'github',
    message: 'OAuth session established',
  });
});

export default router;
