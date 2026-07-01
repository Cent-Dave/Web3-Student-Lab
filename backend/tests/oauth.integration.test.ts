import express from 'express';
import request from 'supertest';
import oauthRouter from '../src/routes/oauth.routes.js';

describe('OAuth integration', () => {
  it('returns a redirect URL for GitHub auth', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/oauth', oauthRouter);

    const response = await request(app)
      .get('/api/v1/oauth/github')
      .expect(302);

    expect(response.headers.location).toContain('github.com/login/oauth/authorize');
  });

  it('exchanges a code for a session payload', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/oauth', oauthRouter);

    const response = await request(app)
      .post('/api/v1/oauth/github/callback')
      .send({ code: 'sample-code' })
      .expect(200);

    expect(response.body.connected).toBe(true);
    expect(response.body.provider).toBe('github');
  });
});
