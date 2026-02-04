import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiting middleware for sensitive endpoints
 * Limits per session (using session ID as key)
 */

/**
 * Get session ID for rate limiting key
 */
function getSessionId(req: Request): string {
  return req.session?.id || req.ip || 'unknown';
}

/**
 * Rate limiter for transcription endpoint
 * 30 requests per 5 minutes per session
 */
export const transcribeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 requests
  keyGenerator: getSessionId,
  message: 'Too many transcription requests. Please try again later.',
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again in a few minutes.',
      retryAfter: req.rateLimit?.resetTime,
    });
  },
});

/**
 * Rate limiter for structure endpoint
 * 30 requests per 5 minutes per session
 */
export const structureLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  keyGenerator: getSessionId,
  message: 'Too many structure requests. Please try again later.',
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again in a few minutes.',
      retryAfter: req.rateLimit?.resetTime,
    });
  },
});

/**
 * Rate limiter for save endpoint
 * 30 requests per 5 minutes per session
 */
export const saveLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  keyGenerator: getSessionId,
  message: 'Too many save requests. Please try again later.',
  statusCode: 429,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again in a few minutes.',
      retryAfter: req.rateLimit?.resetTime,
    });
  },
});

/**
 * General rate limiter for API endpoints
 * 100 requests per minute per session
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyGenerator: getSessionId,
  standardHeaders: true,
  legacyHeaders: false,
});
