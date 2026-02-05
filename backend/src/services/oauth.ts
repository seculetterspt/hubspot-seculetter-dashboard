import axios from 'axios';

interface HubSpotOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface HubSpotUserInfo {
  email: string;
  name: string;
  portalId?: string;
}

const HUBSPOT_AUTH_BASE = 'https://app-na2.hubspot.com';
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
   * Fetch user info from HubSpot using OAuth token
   * For identity verification purposes
   * IMPORTANT: This token is ONLY used for identity verification, then discarded
   */
  async getUserInfo(accessToken: string): Promise<HubSpotUserInfo> {
    this.validateConfig();
    try {
      // Fetch the authenticated user's information using the OAuth token
      const response = await axios.get(
        `${HUBSPOT_API_BASE}/oauth/v1/user`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const userData = response.data;
      return {
        email: userData.user?.email || userData.email || 'unknown@hubspot.local',
        name: userData.user?.name || userData.name || 'HubSpot User',
        portalId: userData.hub_id || userData.hubId,
      };
    } catch (error: any) {
      console.error('Error fetching user info from token:', {
        status: error.response?.status,
        message: error.message,
      });

      // Fallback: create a unique user identifier
      // This allows OAuth to work even if we can't fetch specific user details
      const uniqueId = Buffer.from(accessToken).toString('base64').substring(0, 12);

      return {
        email: `oauth-user+${uniqueId}@seculetter.local`,
        name: 'HubSpot OAuth User',
        portalId: undefined,
      };
    }
  }
}

export default new HubSpotOAuthService();
