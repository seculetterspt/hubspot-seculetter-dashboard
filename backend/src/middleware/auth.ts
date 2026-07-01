import { Request, Response, NextFunction } from 'express';
import session from 'express-session';

/**
 * Extended Request type with session user data
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        name: string;
        loginTimestamp: number;
      };
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    user?: {
      userId: string;
      email: string;
      name: string;
      loginTimestamp: number;
    };
  }
}

/**
 * Middleware to check if user is authenticated
 * Validates session cookie and extracts user data
 */
export const isAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
  if (req.session?.user) {
    req.user = req.session.user;
    next();
  } else {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Please log in to access this resource',
    });
  }
};

/**
 * Middleware to redirect unauthenticated users to login
 * Used for page routes (frontend)
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (req.session?.user) {
    next();
  } else {
    res.status(401).json({
      error: 'Unauthorized',
      redirectTo: '/login',
    });
  }
};

/**
 * Middleware to check if user session is valid
 */
export const validateSession = (req: Request, res: Response, next: NextFunction): void => {
  if (req.session?.user) {
    // Update session timestamp to extend expiry
    req.session.touch();
    next();
  } else {
    next();
  }
};

/**
 * Middleware to gate STATIC PAGE routes (e.g. /reports/*) behind a session.
 * Unlike isAuthenticated (which returns 401 JSON for API calls), this issues a
 * browser redirect to the login page and preserves the original URL as returnUrl
 * so the user lands back on the requested report after HubSpot login.
 */
export const requirePageAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (req.session?.user) {
    next();
  } else {
    const returnUrl = encodeURIComponent(req.originalUrl);
    res.redirect(`/login?returnUrl=${returnUrl}`);
  }
};
