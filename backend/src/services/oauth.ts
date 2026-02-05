import axios from 'axios';

interface HubSpotOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface HubSpotUserInfo {
  email: string;
  name: string;
  portalId?: string;
}

interface HubSpotAccessTokenInfo {
  user: string;        // User email
  user_id: number;     // User ID
  hub_id: number;      // Portal ID
  app_id: number;
  expires_in: number;
  token_type: string;
  scopes: string[];
}

const HUBSPOT_AUTH_BASE = 'https://app.hubspot.com';
const HUBSPOT_API_BASE = 'https://api.hubapi.com';
const HUBSPOT_OAUTH_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

/**
 * HubSpot OAuth Service
 * Handles identity-only OAuth flow (not for data operations)
 */
export class HubSpotOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    this.clientId = process.env.HUBSPOT_CLIENT_ID || '';
    this.clientSecret = process.env.HUBSPOT_CLIENT_SECRET || '';
    this.redirectUri = process.env.HUBSPOT_OAUTH_REDIRECT_URI || '';

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      console.warn('[OAuth] Missing HubSpot OAuth environment variables - OAuth will not be available');
    }
  }

  /**
   * Validate that OAuth is properly configured
   */
  private validateConfig(): void {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('HubSpot OAuth is not properly configured. Please set HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET, and HUBSPOT_OAUTH_REDIRECT_URI environment variables.');
    }
  }

  /**
   * Generate HubSpot OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    this.validateConfig();
    const scope = ['crm.objects.contacts.read', 'oauth'].join(' ');
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scope,
      state: state,
    });

    return `${HUBSPOT_AUTH_BASE}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens (identity only)
   */
  async exchangeCodeForTokens(code: string): Promise<HubSpotOAuthTokenResponse> {
    this.validateConfig();
    try {
      // HubSpot OAuth token endpoint expects form-encoded data
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code: code,
      });

      const response = await axios.post(
        HUBSPOT_OAUTH_TOKEN_URL,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Error exchanging code for tokens:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        url: HUBSPOT_OAUTH_TOKEN_URL,
      });
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Fetch user info from HubSpot using OAuth access token
   * Uses the access token info endpoint to get the authenticated user's email
   * IMPORTANT: This token is ONLY used for identity verification, then discarded
   */
  async getUserInfo(accessToken: string): Promise<HubSpotUserInfo> {
    this.validateConfig();
    try {
      // Use HubSpot's access token info endpoint to get user details
      // This endpoint returns the email of the user who authorized the token
      const response = await axios.get<HubSpotAccessTokenInfo>(
        `${HUBSPOT_API_BASE}/oauth/v1/access-tokens/${accessToken}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      const tokenInfo = response.data;
      console.log('[OAuth] Token info retrieved:', {
        user: tokenInfo.user,
        user_id: tokenInfo.user_id,
        hub_id: tokenInfo.hub_id,
      });

      // The 'user' field contains the email of the HubSpot user who authorized the app
      if (tokenInfo.user) {
        return {
          email: tokenInfo.user,
          name: tokenInfo.user.split('@')[0], // Use email prefix as name fallback
          portalId: String(tokenInfo.hub_id),
        };
      }

      throw new Error('No user email found in token info');
    } catch (error: any) {
      console.error('[OAuth] Error fetching user info from access token:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });

      // Don't use fallback - fail explicitly so we know there's an issue
      throw new Error('Failed to fetch user identity from HubSpot');
    }
  }
}

export default new HubSpotOAuthService();
