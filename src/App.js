import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PostEditor from './components/PostEditor';
import TemplatesManager from './components/TemplatesManager';
import Settings from './components/Settings';
import Sidebar from './components/Sidebar';
import AuthDebugger from './components/AuthDebugger'; // Import the new debugger component
import AuthService from './services/AuthService';
import LoginDebugger from './components/LoginDebugger';
import { getStoredJson, getStoredValue, setStoredValue } from './utils/storage';

// Import all necessary styles
import './styles/app.css';
import './styles/dashboard.css';
import './styles/editor.css';
import './styles/templates.css';
import './styles/settings.css';
import './styles/feedback.css';
import './styles/ai.css';

// Protected route component to handle authentication
const ProtectedRoute = ({ children }) => {
  const token = AuthService.getAuthToken();
  
  // Basic token validation (improved from original)
  const isAuthenticated = token && !AuthService.isTokenExpired();
  
  if (!isAuthenticated) {
    console.warn('[ProtectedRoute] Authentication check failed, redirecting to login');
    return <Navigate to="/" replace state={{ authError: "Authentication required. Please log in." }} />;
  }
  
  return children;
};

// Layout component for authenticated pages
const AuthenticatedLayout = ({ children, theme, toggleTheme }) => {
  const [wideLayout, setWideLayout] = useState(false);
  const [contentAlignment, setContentAlignment] = useState('center');

  useEffect(() => {
    const savedSettings = getStoredJson('blogartifex_settings', {});
    setWideLayout(!!savedSettings.wideLayout);
    setContentAlignment(savedSettings.contentAlignment || 'center');

    const handleStorageChange = (e) => {
      if (e.key === 'blogartifex_settings') {
        try {
          const newSettings = JSON.parse(e.newValue || '{}');
          setWideLayout(!!newSettings.wideLayout);
          setContentAlignment(newSettings.contentAlignment || 'center');
        } catch {
          setWideLayout(false);
          setContentAlignment('center');
        }
      }
    };
    const handleSettingsUpdate = (e) => {
      if (e.detail) {
        if (typeof e.detail.wideLayout !== 'undefined') {
          setWideLayout(!!e.detail.wideLayout);
        }
        if (typeof e.detail.contentAlignment !== 'undefined') {
          setContentAlignment(e.detail.contentAlignment || 'center');
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('blogartifex_settings_update', handleSettingsUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('blogartifex_settings_update', handleSettingsUpdate);
    };
  }, []);

  return (
    <div className={`dashboard-container ${wideLayout ? 'wide' : ''} align-${contentAlignment}`}>
      <Sidebar theme={theme} toggleTheme={toggleTheme} />
      {children}
    </div>
  );
};

// Main App component
function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = getStoredValue('theme');
    return savedTheme || 'dark'; // Default to dark theme
  });

  const [showDebugger, setShowDebugger] = useState(() => {
    const savedSettings = getStoredJson('blogartifex_settings', {});
    return savedSettings.showDebugger || false;
  });

  // Keep debugger visibility synchronized with settings changes.
  useEffect(() => {
    const updateDebugger = () => {
      const savedSettings = getStoredJson('blogartifex_settings', {});
      setShowDebugger(savedSettings.showDebugger || false);
    };

    updateDebugger();

    const handleStorageChange = (e) => {
      if (e.key === 'blogartifex_settings') {
        updateDebugger();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('blogartifex_settings_updated', updateDebugger);

    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('blogartifex_settings_updated', updateDebugger);
    };
  }, []);

  /**
   * Alterna o tema ou define explicitamente um tema
   * @param {('light'|'dark')} [newTheme] - Tema opcional a ser definido
   */
  const toggleTheme = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark') {
      setTheme(newTheme);
    } else {
      setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
    }
  };

  useEffect(() => {
    document.body.className = theme;
    setStoredValue('theme', theme);
  }, [theme]);

  return (
    <HashRouter>
      <div className={`app-container ${theme}`}>

          {/* Add the debugger here, before Routes */}
          {process.env.NODE_ENV !== 'production' && showDebugger && <LoginDebugger />}
        

        <Routes>
          {/* Public route - Login */}
          <Route path="/" element={<Login />} />
          
          {/* New route for authentication debugging */}
          <Route 
            path="/auth-debug" 
            element={
              <ProtectedRoute>
                <AuthenticatedLayout theme={theme} toggleTheme={toggleTheme}>
                  <AuthDebugger />
                </AuthenticatedLayout>
              </ProtectedRoute>
            } 
          />
          
          {/* Protected routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <AuthenticatedLayout theme={theme} toggleTheme={toggleTheme}>
                  <Dashboard />
                </AuthenticatedLayout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/editor" 
            element={
              <ProtectedRoute>
                <AuthenticatedLayout theme={theme} toggleTheme={toggleTheme}>
                  <PostEditor theme={theme} toggleTheme={toggleTheme} />
                </AuthenticatedLayout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/editor/:postId" 
            element={
              <ProtectedRoute>
                <AuthenticatedLayout theme={theme} toggleTheme={toggleTheme}>
                  <PostEditor theme={theme} toggleTheme={toggleTheme} />
                </AuthenticatedLayout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/templates" 
            element={
              <ProtectedRoute>
                <AuthenticatedLayout theme={theme} toggleTheme={toggleTheme}>
                  <TemplatesManager theme={theme} />
                </AuthenticatedLayout>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <AuthenticatedLayout theme={theme} toggleTheme={toggleTheme}>
                  <Settings theme={theme} toggleTheme={toggleTheme} />
                </AuthenticatedLayout>
              </ProtectedRoute>
            } 
          />
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;
