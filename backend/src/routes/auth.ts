import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import session from 'express-session';
import { sign as signCookie } from 'cookie-signature';
import { HubSpotOAuthService } from '../services/oauth.js';
import { isEmailAllowed } from '../middleware/allowlist.js';
import { pool } from '../config/database.js';

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
 * Store OAuth state in database with 10-minute expiry
 */
async function saveOAuthState(state: string, returnUrl?: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  try {
    await pool.query(
      'INSERT INTO "oauth_state" (state, return_url, expires_at) VALUES ($1, $2, $3)',
      [state, returnUrl || '/', expiresAt]
    );
  } catch (error) {
    console.error('[OAuth] Failed to save state to database:', error);
    throw error;
  }
}

async function getOAuthState(state: string): Promise<{ returnUrl: string } | null> {
  try {
    const result = await pool.query(
      'SELECT return_url, expires_at FROM "oauth_state" WHERE state = $1',
      [state]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Check if expired
    if (new Date(row.expires_at) < new Date()) {
      // Delete expired state
      await deleteOAuthState(state);
      return null;
    }

    return { returnUrl: row.return_url };
  } catch (error) {
    console.error('[OAuth] Failed to get state from database:', error);
    return null;
  }
}

async function deleteOAuthState(state: string): Promise<void> {
  try {
    await pool.query('DELETE FROM "oauth_state" WHERE state = $1', [state]);
  } catch (error) {
    console.error('[OAuth] Failed to delete state from database:', error);
  }
}

/**
 * GET /auth/hubspot/login
 * Redirects user to HubSpot OAuth authorization page
 * Optional query param: ?returnUrl=/path/to/redirect
 */
router.get('/hubspot/login', async (req: Request, res: Response) => {
  try {
    console.log('[OAuth] /auth/hubspot/login endpoint reached');
    // Generate random state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');
    const returnUrl = req.query.returnUrl as string || '/';

    console.log('[OAuth] Saving state to database:', state);
    // Store state in database
    await saveOAuthState(state, returnUrl);
    console.log('[OAuth] State saved successfully');

    // Redirect to HubSpot OAuth authorization URL
    const authUrl = oauthService.getAuthorizationUrl(state);
    console.log('[OAuth] Redirecting to:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error('[OAuth] Error in /auth/hubspot/login:', error);
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
      console.error('[OAuth] HubSpot error:', error, error_description);
      return res.redirect(`/?error=${encodeURIComponent(error_description as string || 'Unknown error')}`);
    }

    // Validate state for CSRF protection
    if (!state) {
      console.error('[OAuth] Missing state parameter');
      return res.status(400).json({
        error: 'Invalid state',
        message: 'OAuth state validation failed. Please try logging in again.',
      });
    }

    const stateData = await getOAuthState(state as string);
    if (!stateData) {
      console.error('[OAuth] Invalid or expired state');
      return res.status(400).json({
        error: 'Invalid state',
        message: 'OAuth state validation failed. Please try logging in again.',
      });
    }

    // Delete the state after use
    await deleteOAuthState(state as string);

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
      const userInfo = await oauthService.getUserInfo(tokens.access_token);
      userEmail = userInfo.email;
      userName = userInfo.name;
    } catch (error) {
      console.error('[OAuth] User identification failed:', error);
      return res.status(500).json({
        error: 'User identification failed',
        message: 'Could not verify your identity. Please contact support.',
      });
    }

    // Check if email is in allowlist
    if (!isEmailAllowed(userEmail)) {
      console.warn(`[OAuth] Access denied for: ${userEmail}`);
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your email is not authorized to access this application.',
      });
    }

    // IMPORTANT: Do not store OAuth token
    // Create session instead
    console.log(`[OAuth] ✅ User authenticated: ${userEmail}`);
    req.session.user = {
      userId: crypto.randomBytes(8).toString('hex'), // Internal user ID
      email: userEmail,
      name: userName,
      loginTimestamp: Date.now(),
    };

    // Save session
    req.session.save((err) => {
      if (err) {
        console.error('[OAuth] Session save error:', err);
        return res.status(500).json({
          error: 'Session creation failed',
        });
      }

      // Manually set Set-Cookie header if express-session didn't
      const setCookieHeader = res.getHeader('Set-Cookie');

      if (!setCookieHeader) {
        // Sign the session ID properly - express-session expects signed cookies
        const secret = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
        const signed = signCookie(req.sessionID, secret);
        const cookieValue = `connect.sid=s%3A${signed}; Path=/; HttpOnly; Secure; SameSite=Lax`;
        res.setHeader('Set-Cookie', cookieValue);
      }

      // Redirect to frontend
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const returnUrl = stateData?.returnUrl || '/';
      const redirectUrl = `${frontendUrl}${returnUrl}`;

      res.redirect(redirectUrl);
    });
  } catch (error) {
    console.error('[OAuth] Callback error:', error);
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
