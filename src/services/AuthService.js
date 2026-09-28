/**
 * AuthService - Enhanced service for BlogArtifex authentication
 * Fixed to properly handle Google OAuth token validation
 */

// Constants
const TOKEN_KEY = 'blogartifex_token';
const ACCOUNT_KEY = 'blogartifex_account';
const EXPIRES_KEY = 'blogartifex_token_expires';
const BLOGGER_API_SCOPE = 'https://www.googleapis.com/auth/blogger';
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
const USER_INFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const TOKEN_INFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/tokeninfo';

// Debug flag (enable for troubleshooting)
const DEBUG = process.env.NODE_ENV === 'development';

/**
 * Log helper for consistent debugging
 */
const log = {
  info: (message, data) => {
    if (DEBUG) console.log(`[AuthService] ${message}`, data || '');
  },
  warn: (message, data) => {
    if (DEBUG) console.warn(`[AuthService] ${message}`, data || '');
  },
  error: (message, error) => {
    if (DEBUG) console.error(`[AuthService] ${message}`, error || '');
  }
};

/**
 * Retrieves the authentication token from storage
 * @returns {string|null} The auth token or null if not found
 */
const getAuthToken = () => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      log.info('No token found in localStorage');
    }
    return token;
  } catch (error) {
    log.error('Error accessing localStorage', error);
    return null;
  }
};

const getStoredAccount = () => {
  try {
    const account = localStorage.getItem(ACCOUNT_KEY);
    return account ? JSON.parse(account) : null;
  } catch (error) {
    log.error('Error reading stored account', error);
    return null;
  }
};

const setStoredAccount = (account) => {
  if (!account) return;

  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  } catch (error) {
    log.error('Failed to store account details', error);
  }
};

const removeStoredAccount = () => {
  try {
    localStorage.removeItem(ACCOUNT_KEY);
  } catch (error) {
    log.error('Failed to remove stored account details', error);
  }
};

/**
 * Stores the authentication token
 * @param {string} token - The token to store
 * @returns {boolean} True if successful, false otherwise
 */
const setAuthToken = (token, expiresIn) => {
  if (!token) {
    log.warn('Attempted to store empty token, ignoring');
    return false;
  }
  
  try {
    localStorage.setItem(TOKEN_KEY, token);
    // Google access tokens are opaque; expires_in (seconds) is the only way to know when they die.
    if (expiresIn) {
      localStorage.setItem(EXPIRES_KEY, String(Date.now() + Number(expiresIn) * 1000));
    } else {
      localStorage.removeItem(EXPIRES_KEY);
    }
    removeStoredAccount();
    log.info('Token successfully stored');
    
    // Verify token after storage
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken !== token) {
      log.error('Token verification failed - storage mismatch');
      return false;
    }
    
    return true;
  } catch (error) {
    log.error('Failed to store token', error);
    return false;
  }
};

/**
 * Removes the authentication token
 * @param {string} source - Identifier for logging purposes
 * @returns {boolean} True if successful, false otherwise
 */
const removeAuthToken = (source = 'unknown') => {
  try {
    const hasToken = !!localStorage.getItem(TOKEN_KEY);
    removeStoredAccount();
    
    if (!hasToken) {
      log.info(`No token found to remove (source: ${source})`);
      return false;
    }
    
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    log.info(`Token removed (source: ${source})`);
    
    // Verify removal
    const tokenAfterRemoval = localStorage.getItem(TOKEN_KEY);
    if (tokenAfterRemoval) {
      log.error('Token removal verification failed');
      return false;
    }
    
    return true;
  } catch (error) {
    log.error(`Failed to remove token (source: ${source})`, error);
    return false;
  }
};

const clearAuthSession = (source = 'unknown') => {
  const removed = removeAuthToken(source);
  removeStoredAccount();
  return removed;
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);

  if (!response.ok) {
    const message = `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
};

const fetchCurrentAccount = async () => {
  const token = getAuthToken();
  if (!token) return null;

  const account = {};

  try {
    const profile = await fetchJson(USER_INFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    Object.assign(account, {
      id: profile.sub || null,
      email: profile.email || null,
      name: profile.name || null,
      picture: profile.picture || null
    });
  } catch (error) {
    log.warn('Unable to fetch Google user profile', error);
  }

  try {
    const tokenInfo = await fetchJson(`${TOKEN_INFO_ENDPOINT}?access_token=${encodeURIComponent(token)}`);
    Object.assign(account, {
      id: account.id || tokenInfo.sub || null,
      email: account.email || tokenInfo.email || null,
      scope: tokenInfo.scope || null,
      expiresIn: tokenInfo.expires_in || null
    });
  } catch (error) {
    log.warn('Unable to fetch token info', error);
  }

  if (!account.email && !account.id && !account.scope) {
    return getStoredAccount();
  }

  setStoredAccount(account);
  return account;
};

/**
 * Decodes JWT token to extract payload
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token payload or null if invalid
 */
const decodeToken = (token) => {
  if (!token) {
    log.warn('No token provided to decode');
    return null;
  }
  
  try {
    // JWT format validation
    const parts = token.split('.');
    if (parts.length !== 3) {
      log.warn('Invalid token format (not a JWT)');
      return null;
    }
    
    // Decode payload (middle part)
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Create padding if needed
    const pad = base64.length % 4;
    const paddedBase64 = pad === 0 
      ? base64 
      : base64 + '='.repeat(4 - pad);
    
    // Fix for non-standard base64 padding in some JWT implementations
    let jsonPayload;
    try {
      // Try standard decoding first
      jsonPayload = atob(paddedBase64);
    } catch (e) {
      // Fallback for problematic tokens
      try {
        // Modern browser approach
        jsonPayload = atob(base64Url);
      } catch (e2) {
        // Last resort - use safer padding approach
        const safePadding = base64.length % 4;
        const safeBase64 = safePadding ? base64 + '='.repeat(4 - safePadding) : base64;
        jsonPayload = atob(safeBase64);
      }
    }
    
    // Parse and return the payload
    const payload = JSON.parse(jsonPayload);
    
    // Log key token details for debugging
    log.info('Token decoded successfully', {
      sub: payload.sub ? payload.sub.substring(0, 8) + '...' : 'missing',
      aud: payload.aud ? (typeof payload.aud === 'string' ? payload.aud.substring(0, 15) + '...' : 'array') : 'missing',
      exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'missing',
    });
    
    return payload;
  } catch (error) {
    log.error('Failed to decode token', error);
    return null;
  }
};

/**
 * Checks if token is expired
 * @returns {boolean} True if token is expired or invalid
 */
const isTokenExpired = () => {
  const token = getAuthToken();
  
  if (!token) {
    log.info('isTokenExpired: No token found');
    return true;
  }
  
  // Google access tokens (ya29.…) are opaque even though they contain dots:
  // the expiry recorded at login is authoritative (1-minute margin).
  const expiresAt = Number(localStorage.getItem(EXPIRES_KEY));
  if (expiresAt) {
    return Date.now() > expiresAt - 60000;
  }
  if (!token.includes('.')) {
    return false; // legacy session without a recorded expiry; a 401 will end it
  }
  
  const payload = decodeToken(token);
  
  if (!payload) {
    log.info('Could not decode token to check expiration');
    return false; // Assumir que não expirou
  }
  
  // Resto do código...
  if (!payload.exp) {
    log.warn('Token has no expiration claim');
    return false;
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  const isExpired = payload.exp <= currentTime;
  
  if (isExpired) {
    log.info('Token is expired');
  }
  
  return isExpired;
};

/**
 * Gets user info from token
 * @returns {Object|null} User information or null
 */
const getUserInfo = () => {
  const token = getAuthToken();
  if (!token) return null;
  
  const payload = decodeToken(token);
  if (!payload) return getStoredAccount();
  
  // Extract common user fields from token
  return {
    id: payload.sub || null,
    email: payload.email || null,
    name: payload.name || null,
    picture: payload.picture || null,
    exp: payload.exp || null,
    scope: payload.scope || null
  };
};

/**
 * Validates the current token with more comprehensive checks
 * @param {boolean} strictMode - Use stricter validation rules
 * @returns {boolean} True if token is valid
 */
const validateToken = (strictMode = false) => {
  const token = getAuthToken();
  
  if (!token) {
    log.info('No token to validate');
    return false;
  }
  
  if (localStorage.getItem(EXPIRES_KEY) || !token.includes('.')) {
    return !isTokenExpired();
  }
  
  // Se parecer um JWT, tentar decodificar
  const parts = token.split('.');
  if (parts.length !== 3) {
    log.info('Token format not JWT, assuming valid access token');
    return true; // Aceitar como access token válido
  }
  
  // Resto do código de validação JWT...
  const payload = decodeToken(token);
  
  if (!payload) {
    // Se não conseguir decodificar, assumir que é um access token válido
    log.info('Could not decode token, assuming valid access token');
    return true;
  }
  
  // Para JWTs, verificar expiração
  if (payload.exp) {
    const currentTime = Math.floor(Date.now() / 1000);
    if (payload.exp <= currentTime) {
      log.warn('Token is expired');
      return false;
    }
  }
  
  log.info('Token validation successful');
  return true;
};

/**
 * Get default scopes for OAuth
 * @returns {string} OAuth scopes
 */
const getDefaultScopes = () => {
  return BLOGGER_API_SCOPE;
};

// Export the service
const AuthService = {
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  clearAuthSession,
  getStoredAccount,
  setStoredAccount,
  removeStoredAccount,
  fetchCurrentAccount,
  decodeToken,
  isTokenExpired,
  getUserInfo,
  validateToken,
  getDefaultScopes,
  CLIENT_ID,
  BLOGGER_API_SCOPE
};

export default AuthService;
