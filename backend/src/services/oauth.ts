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

const HUBSPOT_AUTH_BASE = 'https://app.hubspot.com';
const HUBSPOT_API_BASE = 'https://api.hubapi.com';

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
      // HubSpot OAuth token endpoint expects form-encoded data, not JSON
      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('client_id', this.clientId);
      params.append('client_secret', this.clientSecret);
      params.append('redirect_uri', this.redirectUri);
      params.append('code', code);

      const response = await axios.post(`${HUBSPOT_AUTH_BASE}/oauth/token`, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Error exchanging code for tokens:', error.response?.data || error.message);
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
      // HubSpot OAuth provides user info via the access token endpoint
      // Decode JWT token to get user claims
      const parts = accessToken.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      // Decode payload (second part)
      const decodedPayload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8')
      );

      // Extract user info from JWT claims
      const email = decodedPayload.email || decodedPayload.user_id || '';
      const name = decodedPayload.name || 'HubSpot User';

      if (!email) {
        throw new Error('Could not extract email from token');
      }

      return {
        email,
        name,
        portalId: decodedPayload.hub_id,
      };
    } catch (error) {
      console.error('Error fetching user info from token:', error);
      throw new Error('Failed to verify user identity from OAuth token');
    }
  }
}

export default new HubSpotOAuthService();
