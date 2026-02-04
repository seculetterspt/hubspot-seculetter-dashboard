import { useEffect, useState } from 'react';
import authService, { SessionUser } from '../services/auth';

interface UseAuthReturn {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
  login: (returnUrl?: string) => void;
}

/**
 * Hook for managing authentication state
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authService.checkSession();
        if (session.authenticated && session.user) {
          setUser(session.user);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
      // Redirect to login
      window.location.href = '/login';
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  };

  const login = (returnUrl?: string) => {
    authService.redirectToLogin(returnUrl);
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
    login,
  };
}
