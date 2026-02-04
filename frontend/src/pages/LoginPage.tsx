import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import authService from '../services/auth';

/**
 * Login page for HubSpot OAuth authentication
 * Works on both mobile and desktop
 */
export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  // If already authenticated, redirect to home
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleHubSpotLogin = () => {
    authService.redirectToLogin('/');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8 sm:p-12">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Seculetter
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              HubSpot Sales Dashboard
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                <span className="font-semibold">Authentication Error:</span> {error}
              </p>
            </div>
          )}

          {/* Login Instructions */}
          <div className="mb-8">
            <p className="text-gray-700 text-sm sm:text-base mb-4">
              로그인하여 미팅 기록 및 거래 현황을 관리하세요.
            </p>
            <p className="text-gray-600 text-xs sm:text-sm">
              HubSpot 계정으로 안전하게 로그인합니다.
            </p>
          </div>

          {/* HubSpot OAuth Button */}
          <button
            onClick={handleHubSpotLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 mb-4"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11z" />
            </svg>
            <span>HubSpot로 로그인</span>
          </button>

          {/* Additional Info */}
          <div className="text-center text-xs text-gray-500 mt-6 pt-6 border-t border-gray-200">
            <p>
              이 서비스를 이용하려면 HubSpot 계정이 필요합니다.
            </p>
          </div>
        </div>

        {/* Mobile Specific: Safe Area Bottom */}
        <div className="h-[env(safe-area-inset-bottom)] md:h-0"></div>
      </div>
    </div>
  );
}
