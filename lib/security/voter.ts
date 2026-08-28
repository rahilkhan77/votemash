/**
 * Voter identity and security utilities
 * Handles anonymous voter tokens and cryptographic hashing
 */

import crypto from 'crypto';

/**
 * Generate a random voter token for anonymous identification
 * This token will be stored in a secure cookie and hashed for database storage
 */
export function generateVoterToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a voter token for database storage
 * Never store raw tokens in the database
 */
export function hashVoterToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Extract IP address from request headers
 * Works with various proxy configurations
 */
export function getClientIp(request: Request): string | null {
  const headers = request.headers;
  
  // Check for common proxy headers
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to socket address if available
  // Note: In serverless environments this may not be reliable
  return null;
}

/**
 * Hash an IP address for risk tracking
 * Never store raw IP addresses long-term
 */
export function hashIpAddress(ip: string | null): string | null {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex');
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent');
}

/**
 * Hash a user agent for risk tracking
 */
export function hashUserAgent(userAgent: string | null): string | null {
  if (!userAgent) return null;
  return crypto.createHash('sha256').update(userAgent).digest('hex');
}

/**
 * Get or create voter token from cookies/request
 */
export function getVoterTokenFromCookies(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const voterCookie = cookies.find((c) => c.startsWith('votemash-voter='));

  if (!voterCookie) return null;

  return voterCookie.split('=')[1];
}

/**
 * Create a Set-Cookie header for voter token
 * Secure, HttpOnly, SameSite strict
 */
export function createVoterCookieHeader(token: string, maxAgeSeconds: number = 63072000): string {
  // 63072000 seconds = 2 years
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
  return `votemash-voter=${token}; Path=/; ${secure}HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}
