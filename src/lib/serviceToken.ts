// src/lib/serviceToken.ts
import jwt from 'jsonwebtoken';

/**
 * Mint a short-lived service JWT (HS256) signed with the shared JWT_SECRET.
 *
 * Sent as `Authorization: Bearer <token>` alongside the existing x-api-key so
 * the voice-agent's dispatch/fetch APIs can authenticate this dashboard as a
 * caller. The voice-agent accepts either credential during the migration.
 */
export function mintServiceToken(): string {
  const jwtSecret = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';
  return jwt.sign(
    {
      sub: 'pype-analytics-dashboard',
      iss: 'pype-analytics-dashboard',
      aud: 'pype-vc-bots',
    },
    jwtSecret,
    { algorithm: 'HS256', expiresIn: '5m' }
  );
}

/**
 * Standard auth headers for calling the voice-agent: the existing x-api-key
 * plus a freshly-minted Bearer token. Spread into a fetch `headers` object.
 */
export function serviceAuthHeaders(apiKey: string = 'pype-api-v1'): Record<string, string> {
  return {
    'x-api-key': apiKey,
    Authorization: `Bearer ${mintServiceToken()}`,
  };
}
