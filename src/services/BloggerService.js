/**
 * BloggerService - Improved and Fixed
 * 
 * Provides robust error handling and proper token management
 * for Blogger API integration
 */

import AuthService from './AuthService';
import { t } from './I18nService';

// API base URL
const API_BASE_URL = 'https://www.googleapis.com/blogger/v3';

// Debug flag (enable for troubleshooting)
const DEBUG = process.env.NODE_ENV === 'development';

// Cache configuration
const CACHE_ENABLED = true;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map();
const tokenCacheIds = new Map();
let tokenCacheCounter = 0;

// Log helper
const log = {
  info: (message, data) => {
    if (DEBUG) console.log(`[BloggerAPI] ${message}`, data || '');
  },
  warn: (message, data) => {
    if (DEBUG) console.warn(`[BloggerAPI] ${message}`, data || '');
  },
  error: (message, error) => {
    if (DEBUG) console.error(`[BloggerAPI] ${message}`, error || '');
  }
};

/**
 * Generates a cache key from request parameters
 */
const getTokenCacheId = (token) => {
  if (!token) return 'anonymous';

  if (!tokenCacheIds.has(token)) {
    tokenCacheCounter += 1;
    tokenCacheIds.set(token, `token-${tokenCacheCounter}`);
  }

  return tokenCacheIds.get(token);
};

const generateCacheKey = (endpoint, params, token) => {
  return `${getTokenCacheId(token)}:${endpoint}:${JSON.stringify(params || {})}`;
};

/**
 * Gets cached response if available and not expired
 */
const getCachedResponse = (key) => {
  if (!CACHE_ENABLED) return null;
  
  const cached = cache.get(key);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
};

/**
 * Caches a response with the current timestamp
 */
const cacheResponse = (key, data) => {
  if (!CACHE_ENABLED) return;
  
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

/**
 * Make an API request with proper error handling and token validation
 */
const request = async (endpoint, options = {}) => {
  // Get auth token
  if (!AuthService.getAuthToken() && !(await AuthService.refreshAccessToken())) {
    log.error('No authentication token found');
    const authError = new Error('Authentication required. Please log in.');
    authError.code = 'AUTH';
    throw authError;
  }
  
  // Validate token format and expiration; a renewable session gets a new token first.
  if (!AuthService.validateToken() && !(await AuthService.refreshAccessToken())) {
    log.warn('Token validation failed, removing invalid token');
    AuthService.removeAuthToken('BloggerService-invalid');
    const authError = new Error('Authentication session expired or invalid. Please log in again.');
    authError.code = 'AUTH';
    throw authError;
  }
  
  const token = AuthService.getAuthToken();
  // Prepare request URL
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Any write can change what cached GETs return (post bodies, lists, counts).
  if (options.method && options.method !== 'GET') {
    cache.clear();
  }

  // Check cache for GET requests
  if (options.method === 'GET' || !options.method) {
    const cacheKey = generateCacheKey(endpoint, options.params, token);
    const cachedResponse = getCachedResponse(cacheKey);
    
    if (cachedResponse) {
      log.info(`Using cached response for ${endpoint}`);
      return cachedResponse;
    }
  }
  
  // Prepare query string for GET requests with params
  let queryString = '';
  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
    queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';
  }
  
  // Prepare request options
  const fetchOptions = {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      ...options.headers
    },
    // Enable credentials for proper cookie handling
    credentials: 'same-origin'
  };
  
  // Add body for non-GET requests
  if (options.body && fetchOptions.method !== 'GET') {
    fetchOptions.headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(options.body);
  }
  
  // Add timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);
  fetchOptions.signal = controller.signal;
  
  try {
    log.info(`Making ${fetchOptions.method} request to ${url}${queryString}`);
    
    // Make the request
    const response = await fetch(`${url}${queryString}`, fetchOptions);
    
    // Clear timeout
    clearTimeout(timeoutId);
    
    // Handle response based on status code
    if (response.status === 204) {
      return { success: true };
    }
    
    // Get response content type
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    
    // Handle authentication errors
    if (response.status === 401) {
      log.error('Authentication error (401)');
      if (!options.retried && await AuthService.refreshAccessToken()) {
        return request(endpoint, { ...options, retried: true });
      }
      
      // Parse response for details
      const errorData = isJson ? await response.json() : await response.text();
      log.error('Auth error details:', errorData);
      
      // Clear invalid token
      AuthService.removeAuthToken('BloggerService-401');
      
      const authError = new Error('Your session has expired. Please log in again.');
      authError.code = 'AUTH';
      throw authError;
    }
    
    // Handle permission errors
    if (response.status === 403) {
      const data = isJson ? await response.json() : await response.text();
      log.error('Permission error (403)', data);
      
      // Get detailed error message
      const errorMessage = isJson && data.error ? 
        data.error.message : 'Access denied to the Blogger API.';
      
      // Token without the Blogger scope (e.g. the Blogger box left unticked
      // on Google's granular consent screen): send the user back to sign in.
      if (/insufficient authentication scopes/i.test(errorMessage)) {
        const scopeError = new Error(t('auth.missingBloggerScope'));
        scopeError.code = 'SCOPE';
        throw scopeError;
      }

      // Anything else: keep Google's own message, it names the real cause.
      throw new Error(`Blogger API (403): ${errorMessage}`);
    }
    
    // Handle rate limiting
    if (response.status === 429) {
      log.warn('Rate limit exceeded (429)');
      throw new Error('API rate limit exceeded. Please try again in a few minutes.');
    }
    
    // Handle general error responses
    if (!response.ok) {
      const errorData = isJson ? await response.json() : await response.text();
      log.error(`API error (${response.status})`, errorData);
      
      // Extract specific error message when available
      const errorMessage = isJson && errorData.error && errorData.error.message
        ? errorData.error.message
        : `API request failed with status ${response.status}`;
        
      throw new Error(errorMessage);
    }
    
    // Handle successful responses
    if (isJson) {
      const data = await response.json();
      
      // Cache GET responses
      if (fetchOptions.method === 'GET' || !fetchOptions.method) {
        const cacheKey = generateCacheKey(endpoint, options.params, token);
        cacheResponse(cacheKey, data);
      }
      
      return data;
    }
    
    return { success: true };
  } catch (error) {
    // Clear timeout
    clearTimeout(timeoutId);
    
    // Handle abort errors (timeout)
    if (error.name === 'AbortError') {
      log.error('Request timeout', error);
      throw new Error('Request timed out. Please check your internet connection and try again.');
    }
    
    // Special handling for fetch/network errors
    if (error.message.includes('Failed to fetch') || 
        error.message.includes('Network request failed')) {
      log.error('Network error', error);
      throw new Error('Network connection error. Please check your internet connection.');
    }
    
    // Log and rethrow
    log.error(`Request failed: ${error.message}`, error);
    throw error;
  }
};

/**
 * Clears the entire cache
 */
const clearCache = () => {
  cache.clear();
  log.info('Cache cleared');
};

export const normalizeBlogListResponse = (data = {}) => {
  const itemBlogs = Array.isArray(data.items) ? data.items : [];
  const userInfoBlogs = Array.isArray(data.blogUserInfos)
    ? data.blogUserInfos.map(info => info?.blog).filter(Boolean)
    : [];

  const byKey = new Map();

  [...itemBlogs, ...userInfoBlogs].forEach((blog, index) => {
    if (!blog) return;
    const key = blog.id || blog.url || blog.name || `blog-${index}`;
    byKey.set(key, blog);
  });

  return {
    ...data,
    items: Array.from(byKey.values())
  };
};

/**
 * Retrieves the user's blogs
 */
const getUserBlogs = async (options = {}) => {
  // An account with no blogs gets an empty list (handled by the dashboard),
  // so errors are passed through untouched instead of being guessed at.
  const data = await request('/users/self/blogs', { ...options });
  return normalizeBlogListResponse(data);
};

/**
 * Retrieves a specific blog by ID
 */
const getBlog = async (blogId, options = {}) => {
  if (!blogId) {
    throw new Error('Blog ID is required');
  }
  return request(`/blogs/${blogId}`, { ...options });
};

/**
 * Retrieves posts from a blog
 */
const getPosts = async (blogId, params = {}, options = {}) => {
  if (!blogId) {
    throw new Error('Blog ID is required');
  }
  return request(`/blogs/${blogId}/posts`, { 
    params,
    ...options
  });
};

/**
 * Retrieves a specific post by ID
 */
const getPost = async (blogId, postId, options = {}) => {
  if (!blogId || !postId) {
    throw new Error('Blog ID and Post ID are required');
  }
  // The API doesn't document which view drafts need; a plain request can
  // 404/403 on a draft, so fall back to the author's and the admin's view.
  const endpoint = `/blogs/${blogId}/posts/${postId}`;
  let lastError;
  for (const view of [null, 'AUTHOR', 'ADMIN']) {
    try {
      return await request(endpoint, {
        ...options,
        params: { ...(options.params || {}), ...(view ? { view } : {}) }
      });
    } catch (error) {
      lastError = error;
      if (error.code === 'AUTH' || !/40[34]|not found|access denied|permission/i.test(`${error.status || ''} ${error.message}`)) {
        throw error;
      }
    }
  }
  throw lastError;
};

/**
 * Creates a new post
 */
const createPost = async (blogId, postData, options = {}) => {
  if (!blogId) {
    throw new Error('Blog ID is required');
  }
  if (!postData || !postData.title) {
    throw new Error('Post data with title is required');
  }
  return request(`/blogs/${blogId}/posts`, {
    method: 'POST',
    body: postData,
    ...options
  });
};

/**
 * Updates an existing post
 */
const updatePost = async (blogId, postId, postData, options = {}) => {
  if (!blogId || !postId) {
    throw new Error('Blog ID and Post ID are required');
  }
  if (!postData) {
    throw new Error('Post data is required');
  }
  return request(`/blogs/${blogId}/posts/${postId}`, {
    method: 'PUT',
    body: postData,
    ...options
  });
};

/**
 * Deletes a post
 */
const deletePost = async (blogId, postId, options = {}) => {
  if (!blogId || !postId) {
    throw new Error('Blog ID and Post ID are required');
  }
  return request(`/blogs/${blogId}/posts/${postId}`, {
    method: 'DELETE',
    ...options
  });
};

/**
 * Publishes a post (moves from draft to published)
 */
const publishPost = async (blogId, postId, publishDate, options = {}) => {
  if (!blogId || !postId) {
    throw new Error('Blog ID and Post ID are required');
  }
  
  let endpoint = `/blogs/${blogId}/posts/${postId}/publish`;
  
  // Add publish date if specified
  if (publishDate) {
    const params = {
      publishDate: publishDate instanceof Date 
        ? publishDate.toISOString() 
        : publishDate
    };
    return request(endpoint, { method: 'POST', params, ...options });
  }
  
  return request(endpoint, { method: 'POST', ...options });
};

/**
 * Reverts a post to draft status
 */
const revertToDraft = async (blogId, postId, options = {}) => {
  if (!blogId || !postId) {
    throw new Error('Blog ID and Post ID are required');
  }
  return request(`/blogs/${blogId}/posts/${postId}/revert`, {
    method: 'POST',
    ...options
  });
};

/**
 * Gets comments for a post
 */
const getComments = async (blogId, postId, params = {}, options = {}) => {
  if (!blogId || !postId) {
    throw new Error('Blog ID and Post ID are required');
  }
  return request(`/blogs/${blogId}/posts/${postId}/comments`, {
    params,
    ...options
  });
};

/**
 * Test API connection
 * Useful for diagnosing permission or authentication issues
 */
const testConnection = async () => {
  try {
    const result = await getUserBlogs();
    return {
      success: true,
      data: result,
      message: `Connection successful. Found ${result.items?.length || 0} blogs.`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      details: error.details || null
    };
  }
};

// Export the BloggerService with all methods
const BloggerService = {
  getUserBlogs,
  getBlog,
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  publishPost,
  revertToDraft,
  getComments,
  clearCache,
  testConnection
};

export default BloggerService;
