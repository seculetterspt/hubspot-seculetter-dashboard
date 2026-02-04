import axios from 'axios';

// Use same domain for API calls (backend serves frontend)
const API_BASE = '';

export interface SessionUser {
  email: string;
  name: string;
  loginTimestamp: number;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: SessionUser;
}

/**
 * Auth service for frontend
 * Handles session checks and logout
 */
class AuthService {
  /**
   * Check if user is authenticated
   */
  async checkSession(): Promise<SessionResponse> {
    try {
      const response = await axios.get(`${API_BASE}/auth/session`, {
        withCredentials: true,
      });
      return response.data;
    } catch (error) {
      console.error('Error checking session:', error);
      return { authenticated: false };
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await axios.post(`${API_BASE}/auth/logout`, {}, {
        withCredentials: true,
      });
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }

  /**
   * Redirect to HubSpot login
   */
  redirectToLogin(returnUrl?: string): void {
    const params = new URLSearchParams();
    if (returnUrl) {
      params.append('returnUrl', returnUrl);
    }
    const loginUrl = `${API_BASE}/auth/hubspot/login${params.toString() ? '?' + params.toString() : ''}`;
    window.location.href = loginUrl;
  }
}

export default new AuthService();
