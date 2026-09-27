import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';  // MUDANÇA AQUI
import AuthService from '../services/AuthService';
import Feedback from './Feedback';
import LanguageSelector from './LanguageSelector';
import i18n, { t } from '../services/I18nService';
import logo from '../logo.svg';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocale] = useState(i18n.getLocale());

  // Check for existing token on mount
  useEffect(() => {
    const token = AuthService.getAuthToken();
    if (token && !AuthService.isTokenExpired()) {
      console.log('Valid token found, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
    if (location.state?.authError) {
      setError(`${location.state.authError}`);
    }
    const removeListener = i18n.addListener(setLocale);
    return () => removeListener();
  }, [navigate, location.state]);

  // MUDANÇA PRINCIPAL: Usar useGoogleLogin ao invés de GoogleLogin
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      setError(null);
      
      try {
        // IMPORTANTE: Usar tokenResponse.access_token, não credential
        const tokenSaved = AuthService.setAuthToken(tokenResponse.access_token);
        
        if (!tokenSaved) {
          throw new Error('Failed to save authentication token');
        }

        await AuthService.fetchCurrentAccount();
        
        // Redirect to dashboard
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 500);
      } catch (err) {
        console.error('Error during login process:', err);
        setError(t('auth.loginError', { message: err.message }));
        setIsLoading(false);
      }
    },
    onError: (err) => {
      console.error('Google OAuth error:', err);
      setError(t('auth.loginError', { message: err.error || t('auth.checkConnection') }));
      setIsLoading(false);
    },
    scope: AuthService.BLOGGER_API_SCOPE,
    prompt: 'select_account',
    include_granted_scopes: false,
  });

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>
          <img src={logo} alt="BlogArtifex logo" className="logo-icon" />
          {t('app.name')}
        </h1>
        <p>{t('app.slogan')}</p>


        {error && (
          <Feedback 
            type="error" 
            message={error} 
            onDismiss={() => setError(null)} 
          />
        )}
        
        <div className="login-form">
          {isLoading ? (
            <div className="auth-loading">{t('auth.loggingIn')}</div>
          ) : (
            <button
              onClick={() => login({ prompt: 'select_account' })}
              className="google-login-button"
              style={{
                padding: '10px 20px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                style={{ width: '20px', height: '20px' }}
              />
              {t('auth.loginWithGoogle')}
            </button>
          )}
        </div>
      </div>
      <LanguageSelector />
    </div>
  );
}

export default Login;
