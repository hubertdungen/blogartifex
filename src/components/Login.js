import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useGoogleLogin, hasGrantedAllScopesGoogle } from '@react-oauth/google';
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
  // Server-side sessions (months) when the server holds the OAuth client secret; otherwise the one-hour token flow.
  const [codeFlow, setCodeFlow] = useState(false);
  useEffect(() => {
    fetch('./api/auth/status').then(r => r.json()).then(d => setCodeFlow(Boolean(d.available))).catch(() => {});
  }, []);

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
      
      // With granular consent the user can untick the Blogger permission;
      // the token would then fail on every API call, so stop here.
      if (!hasGrantedAllScopesGoogle(tokenResponse, AuthService.BLOGGER_API_SCOPE)) {
        setError(t('auth.missingBloggerScope'));
        setIsLoading(false);
        return;
      }

      try {
        // IMPORTANTE: Usar tokenResponse.access_token, não credential
        const tokenSaved = AuthService.setAuthToken(tokenResponse.access_token, tokenResponse.expires_in);
        
        if (!tokenSaved) {
          throw new Error('Failed to save authentication token');
        }

        await AuthService.fetchCurrentAccount();
        
        navigate('/dashboard', { replace: true });
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

  const loginWithCode = useGoogleLogin({
    flow: 'auth_code',
    scope: AuthService.BLOGGER_API_SCOPE,
    include_granted_scopes: false,
    onSuccess: async (codeResponse) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('./api/auth/exchange', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: codeResponse.code })
        });
        if (!response.ok) throw new Error(t('auth.checkConnection'));
        const data = await response.json();
        if (!hasGrantedAllScopesGoogle({ scope: data.scope || '' }, AuthService.BLOGGER_API_SCOPE)) {
          AuthService.clearAuthSession('Login-missing-scope');
          setError(t('auth.missingBloggerScope'));
          setIsLoading(false);
          return;
        }
        if (!AuthService.setAuthToken(data.access_token, data.expires_in)) throw new Error('Failed to save authentication token');
        await AuthService.fetchCurrentAccount();
        navigate('/dashboard', { replace: true });
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
    }
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
              onClick={() => (codeFlow ? loginWithCode({ prompt: 'consent select_account' }) : login({ prompt: 'select_account' }))}
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
