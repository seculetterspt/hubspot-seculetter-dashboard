import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import session from 'express-session';
import { HubSpotOAuthService } from '../services/oauth.js';
import { isEmailAllowed } from '../middleware/allowlist.js';

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

const router = Router();
const oauthService = new HubSpotOAuthService();

/**
 * Store OAuth states in memory (in production, use Redis or database)
 * Expires after 10 minutes
 */
const oauthStates = new Map<string, { timestamp: number; returnUrl?: string }>();

function cleanupOldStates() {
  const now = Date.now();
  const tenMinutes = 10 * 60 * 1000;
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.timestamp > tenMinutes) {
      oauthStates.delete(state);
    }
  }
}

/**
 * GET /auth/hubspot/login
 * Redirects user to HubSpot OAuth authorization page
 * Optional query param: ?returnUrl=/path/to/redirect
 */
router.get('/hubspot/login', (req: Request, res: Response) => {
  try {
    // Generate random state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    const returnUrl = req.query.returnUrl as string || '/';

    // Store state with expiry
    oauthStates.set(state, {
      timestamp: Date.now(),
      returnUrl,
    });

    // Cleanup old states periodically
    if (Math.random() < 0.1) {
      cleanupOldStates();
    }

    // Redirect to HubSpot OAuth authorization URL
    const authUrl = oauthService.getAuthorizationUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error in /auth/hubspot/login:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: 'Failed to initiate HubSpot login. Please try again.',
    });
  }
});

/**
 * GET /auth/hubspot/callback
 * HubSpot OAuth callback endpoint
 * Exchanges authorization code for tokens and creates session
 */
router.get('/hubspot/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Check for OAuth errors
    if (error) {
      console.error('HubSpot OAuth error:', error, error_description);
      return res.redirect(`/?error=${encodeURIComponent(error_description as string || 'Unknown error')}`);
    }

    // Validate state for CSRF protection
    if (!state || !oauthStates.has(state as string)) {
      console.error('Invalid OAuth state:', state);
      return res.status(400).json({
        error: 'Invalid state',
        message: 'OAuth state validation failed. Please try logging in again.',
      });
    }

    const stateData = oauthStates.get(state as string)!;
    oauthStates.delete(state as string);

    if (!code) {
      return res.status(400).json({
        error: 'Missing authorization code',
      });
    }

    // Exchange code for tokens (identity only)
    const tokens = await oauthService.exchangeCodeForTokens(code as string);

    // CRITICAL: Fetch user identity using the OAuth token
    // then DISCARD the OAuth token - we only need user info
    let userEmail = '';
    let userName = '';

    try {
      // Try to get user info from OAuth token
      const userInfo = await oauthService.getUserInfo(tokens.access_token);
      userEmail = userInfo.email;
      userName = userInfo.name;
    } catch (error) {
      // Fallback: For MVP, we might not have direct access to user email via OAuth
      // In production, implement a proper user identity endpoint
      console.warn('Could not fetch user info from OAuth token:', error);
      console.warn('Using fallback: requires additional app-level user identification');

      // For now, reject the auth - production systems should implement proper user lookup
      return res.status(500).json({
        error: 'User identification failed',
        message: 'Could not verify your identity. Please contact support.',
      });
    }

    // Check if email is in allowlist
    if (!isEmailAllowed(userEmail)) {
      console.warn(`Access denied for non-allowlisted email: ${userEmail}`);
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your email is not authorized to access this application.',
      });
    }

    // IMPORTANT: Do not store OAuth token
    // Create session instead
    req.session.user = {
      userId: crypto.randomBytes(8).toString('hex'), // Internal user ID
      email: userEmail,
      name: userName,
      loginTimestamp: Date.now(),
    };

    // Save session
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session:', err);
        return res.status(500).json({
          error: 'Session creation failed',
        });
      }

      // Redirect to frontend (not backend)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const returnUrl = stateData.returnUrl || '/';
      const redirectUrl = `${frontendUrl}${returnUrl}`;
      res.redirect(redirectUrl);
    });
  } catch (error) {
    console.error('Error in /auth/hubspot/callback:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication. Please try again.',
    });
  }
});

/**
 * POST /auth/logout
 * Clears session and logs out user
 */
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({
        error: 'Logout failed',
      });
    }

    // Clear session cookie
    res.clearCookie('connect.sid', { path: '/' });

    res.json({
      message: 'Logged out successfully',
      redirectTo: '/login',
    });
  });
});

/**
 * GET /auth/session
 * Returns current session/user info (for frontend)
 */
router.get('/session', (req: Request, res: Response) => {
  if (req.session?.user) {
    res.json({
      authenticated: true,
      user: {
        email: req.session.user.email,
        name: req.session.user.name,
        loginTimestamp: req.session.user.loginTimestamp,
      },
    });
  } else {
    res.json({
      authenticated: false,
    });
  }
});

export default router;
