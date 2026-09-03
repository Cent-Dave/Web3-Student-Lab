import { Request, Response } from 'express';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeFamily,
  revokeAllUserTokens,
  ROTATION_GRACE_PERIOD_MS,
  TokenPayload,
} from '../src/auth/token.service.js';
import {
  getRefreshTokenCookieOptions,
  setRefreshTokenCookie,
  getRefreshTokenFromReq,
  clearRefreshTokenCookie,
} from '../src/utils/cookie.js';
import { getRedisClient } from '../src/utils/redis.js';

describe('Hardened Refresh Token Session Unit & Concurrency Tests', () => {
  const testUserId = 'test-user-session-123';
  const redis = getRedisClient();

  beforeEach(() => {
    process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-key-32-chars-long';
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-32-chars-long';
  });

  describe('Cookie Configuration & Extraction', () => {
    it('should configure HttpOnly, environment-aware cookie options', () => {
      const options = getRefreshTokenCookieOptions();
      expect(options.httpOnly).toBe(true);
      expect(options.path).toBe('/api/v1/auth');
      expect(options.sameSite).toBe('strict');
      expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should extract refresh token from cookie header or request cookies', () => {
      const tokenVal = 'sample.refresh.token';

      // 1. From req.cookies object
      const reqWithCookies = {
        cookies: { refreshToken: tokenVal },
        headers: {},
      } as unknown as Request;
      expect(getRefreshTokenFromReq(reqWithCookies)).toBe(tokenVal);

      // 2. From raw Cookie header string
      const reqWithHeader = {
        headers: { cookie: `other=123; refreshToken=${tokenVal}; lang=en` },
      } as unknown as Request;
      expect(getRefreshTokenFromReq(reqWithHeader)).toBe(tokenVal);

      // 3. From request body
      const reqWithBody = {
        body: { refreshToken: tokenVal },
        headers: {},
      } as unknown as Request;
      expect(getRefreshTokenFromReq(reqWithBody)).toBe(tokenVal);
    });
  });

  describe('Refresh Token Lifecycle & Grace Period Unit Tests', () => {
    it('should generate and verify valid refresh tokens', async () => {
      const token = await generateRefreshToken({ userId: testUserId });
      expect(typeof token).toBe('string');

      const payload = await verifyRefreshToken(token);
      expect(payload.userId).toBe(testUserId);
      expect(payload.familyId).toBeDefined();
      expect(payload.tokenId).toBeDefined();
    });

    it('should rotate active token and return a new token pair', async () => {
      const initialToken = await generateRefreshToken({ userId: testUserId });
      const initialPayload = await verifyRefreshToken(initialToken);

      const rotated = await rotateRefreshToken(initialToken);
      expect(rotated.accessToken).toBeDefined();
      expect(rotated.refreshToken).toBeDefined();
      expect(rotated.refreshToken).not.toBe(initialToken);

      const rotatedPayload = await verifyRefreshToken(rotated.refreshToken);
      expect(rotatedPayload.userId).toBe(testUserId);
      expect(rotatedPayload.familyId).toBe(initialPayload.familyId); // Same lineage
      expect(rotatedPayload.tokenId).not.toBe(initialPayload.tokenId); // New token ID
    });

    it('should accept immediately-previous token during 10-second grace period without re-rotating', async () => {
      const initialToken = await generateRefreshToken({ userId: testUserId });
      const rotated = await rotateRefreshToken(initialToken);

      // Present the immediately-previous token within the 10s grace window
      const graceVerified = await verifyRefreshToken(initialToken);
      expect(graceVerified.userId).toBe(testUserId);

      // Rotating with the immediately-previous token in grace window returns active token pair
      const graceRotated = await rotateRefreshToken(initialToken);
      expect(graceRotated.refreshToken).toBe(rotated.refreshToken);
    });

    it('should reject previous token after 10-second grace period and revoke token family', async () => {
      const baseTime = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(baseTime);

      const initialToken = await generateRefreshToken({ userId: testUserId });
      const rotated = await rotateRefreshToken(initialToken);
      const activeToken = rotated.refreshToken;

      // Advance time by 11 seconds (past 10s grace period)
      jest.spyOn(Date, 'now').mockReturnValue(baseTime + ROTATION_GRACE_PERIOD_MS + 1000);

      // Attempting to use the old initialToken must fail as theft/reuse
      await expect(verifyRefreshToken(initialToken)).rejects.toThrow('Refresh token has been reused or revoked');

      // The entire token family (including the previously activeToken) must now be universally revoked
      await expect(verifyRefreshToken(activeToken)).rejects.toThrow('Refresh token has been reused or revoked');

      jest.restoreAllMocks();
    });

    it('should instantly detect reuse of older ancestor tokens (2+ rotations ago) and revoke lineage', async () => {
      const gen1Token = await generateRefreshToken({ userId: testUserId });
      const gen2 = await rotateRefreshToken(gen1Token);
      const gen3 = await rotateRefreshToken(gen2.refreshToken);

      // Now gen3 is active, gen2 is within grace period, gen1 is an older ancestor
      // Presenting gen1 must trigger immediate reuse detection and revoke family
      await expect(rotateRefreshToken(gen1Token)).rejects.toThrow('Refresh token has been reused or revoked');

      // Now even the newest gen3 token is revoked
      await expect(verifyRefreshToken(gen3.refreshToken)).rejects.toThrow('Refresh token has been reused or revoked');
    });

    it('should revoke all user tokens on session teardown/logout across all devices', async () => {
      const device1Token = await generateRefreshToken({ userId: testUserId });
      const device2Token = await generateRefreshToken({ userId: testUserId });

      expect((await verifyRefreshToken(device1Token)).userId).toBe(testUserId);
      expect((await verifyRefreshToken(device2Token)).userId).toBe(testUserId);

      // User logs out (revoke all sessions)
      await revokeAllUserTokens(testUserId);

      await expect(verifyRefreshToken(device1Token)).rejects.toThrow('Refresh token has been reused or revoked');
      await expect(verifyRefreshToken(device2Token)).rejects.toThrow('Refresh token has been reused or revoked');
    });

    it('should isolate family revocation to the targeted family only', async () => {
      const family1Token = await generateRefreshToken({ userId: testUserId });
      const family2Token = await generateRefreshToken({ userId: testUserId });

      const decoded1 = await verifyRefreshToken(family1Token);
      await revokeFamily(decoded1.familyId!);

      // Family 1 is revoked
      await expect(verifyRefreshToken(family1Token)).rejects.toThrow('Refresh token has been reused or revoked');

      // Family 2 remains active
      const decoded2 = await verifyRefreshToken(family2Token);
      expect(decoded2.userId).toBe(testUserId);
    });

    it('should fail closed during verifyRefreshToken if Redis is unreachable or throws an error', async () => {
      const token = await generateRefreshToken({ userId: testUserId });

      // Force redis.get to throw a network/connection error
      jest.spyOn(redis, 'get').mockRejectedValueOnce(new Error('Redis connection lost'));

      await expect(verifyRefreshToken(token)).rejects.toThrow('Refresh token has been reused or revoked');
    });

    it('should fail closed during rotateRefreshToken if Redis is unreachable or throws an error', async () => {
      const token = await generateRefreshToken({ userId: testUserId });

      // Force redis.get to throw an error during rotation
      jest.spyOn(redis, 'get').mockRejectedValueOnce(new Error('Redis cluster down'));

      await expect(rotateRefreshToken(token)).rejects.toThrow('Refresh token has been reused or revoked');
    });
  });

  describe('Concurrent Request Integration Tests', () => {
    it('should handle 10 concurrent in-flight refresh calls using the same token without false-positive lockouts', async () => {
      const initialToken = await generateRefreshToken({ userId: testUserId });

      // Simulate 10 simultaneous refresh requests presenting the exact same initialToken
      const concurrencyCount = 10;
      const refreshPromises = Array.from({ length: concurrencyCount }, () =>
        rotateRefreshToken(initialToken)
      );

      const results = await Promise.all(refreshPromises);

      // All 10 requests must succeed
      expect(results).toHaveLength(concurrencyCount);

      // All requests must return valid access tokens
      results.forEach((res) => {
        expect(res.accessToken).toBeDefined();
        expect(res.refreshToken).toBeDefined();
      });

      // Exactly ONE canonical new refresh token should have been returned across all concurrent callers
      const canonicalRefreshToken = results[0]!.refreshToken;
      results.forEach((res) => {
        expect(res.refreshToken).toBe(canonicalRefreshToken);
      });

      // The canonical refresh token must be valid and verifiable
      const payload = await verifyRefreshToken(canonicalRefreshToken);
      expect(payload.userId).toBe(testUserId);
    });

    it('should handle high-concurrency race during token theft event and enforce atomic family revocation', async () => {
      const baseTime = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(baseTime);

      const initialToken = await generateRefreshToken({ userId: testUserId });
      const rotated = await rotateRefreshToken(initialToken);
      const legitimateToken = rotated.refreshToken;

      // Fast forward past the grace window
      jest.spyOn(Date, 'now').mockReturnValue(baseTime + ROTATION_GRACE_PERIOD_MS + 5000);

      // Simulate parallel requests: 5 theft attempts using expired initialToken and 5 legitimate attempts using legitimateToken
      const theftAttempts = Array.from({ length: 5 }, () =>
        rotateRefreshToken(initialToken).catch((err) => err)
      );
      const legitimateAttempts = Array.from({ length: 5 }, () =>
        rotateRefreshToken(legitimateToken).catch((err) => err)
      );

      const allResults = await Promise.all([...theftAttempts, ...legitimateAttempts]);

      // All theft attempts must be rejected with reuse error
      const theftResults = allResults.slice(0, 5);
      theftResults.forEach((res) => {
        expect(res).toBeInstanceOf(Error);
        expect((res as Error).message).toBe('Refresh token has been reused or revoked');
      });

      // Family must be universally revoked
      await expect(verifyRefreshToken(legitimateToken)).rejects.toThrow('Refresh token has been reused or revoked');
    });

    it('should remain deterministic across rapid successive rotation and grace verification cycles', async () => {
      let currentToken = await generateRefreshToken({ userId: testUserId });

      for (let cycle = 0; cycle < 5; cycle++) {
        const rotated = await rotateRefreshToken(currentToken);
        expect(rotated.refreshToken).toBeDefined();
        expect(rotated.refreshToken).not.toBe(currentToken);

        // Immediate concurrent verification of previous token in grace window
        const [prevVerified, currVerified] = await Promise.all([
          verifyRefreshToken(currentToken),
          verifyRefreshToken(rotated.refreshToken),
        ]);

        expect(prevVerified.userId).toBe(testUserId);
        expect(currVerified.userId).toBe(testUserId);

        currentToken = rotated.refreshToken;
      }
    });
  });

  describe('Token Secret Fail-Closed Hardening', () => {
    const savedAccessSecret = process.env.ACCESS_TOKEN_SECRET;
    const savedJwtSecret = process.env.JWT_SECRET;
    const savedRefreshSecret = process.env.REFRESH_TOKEN_SECRET;

    afterEach(() => {
      process.env.ACCESS_TOKEN_SECRET = savedAccessSecret;
      process.env.JWT_SECRET = savedJwtSecret;
      process.env.REFRESH_TOKEN_SECRET = savedRefreshSecret;
    });

    it('should throw an explicit error if ACCESS_TOKEN_SECRET is not configured', () => {
      delete process.env.ACCESS_TOKEN_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => generateAccessToken({ userId: testUserId })).toThrow(
        'ACCESS_TOKEN_SECRET is not configured'
      );
      expect(() => verifyAccessToken('some.token.value')).toThrow(
        'ACCESS_TOKEN_SECRET is not configured'
      );
    });

    it('should throw an explicit error if REFRESH_TOKEN_SECRET is not configured', async () => {
      delete process.env.REFRESH_TOKEN_SECRET;

      await expect(generateRefreshToken({ userId: testUserId })).rejects.toThrow(
        'REFRESH_TOKEN_SECRET is not configured'
      );
      await expect(verifyRefreshToken('some.token.value')).rejects.toThrow(
        'Refresh token has been reused or revoked'
      );
    });
  });
});
