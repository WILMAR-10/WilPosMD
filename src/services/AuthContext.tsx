// src/services/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User, UserRole } from '../types/user';
import { PermissionAction, PermissionTarget, hasPermission, parseStoredPermissions } from '../utils/PermissionUtils';
import BrowserSecurityService from './BrowserSecurityService';

interface AuthSession {
  token: string;
  userId: string;
  expirationTime: number;
  createdAt: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isSessionValid: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  hasPermission: (target: PermissionTarget, action?: PermissionAction) => boolean;
  requireAdminConfirmation: (callback: () => void) => void;
  refreshSession: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSessionValid, setIsSessionValid] = useState(false);
  const [confirmationCallback, setConfirmationCallback] = useState<(() => void) | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const MAX_LOGIN_ATTEMPTS = 5;

  useEffect(() => {
    // Check if user is already logged in and session is valid
    const checkStoredSession = () => {
      try {
        const encryptedSession = localStorage.getItem('userSession');
        if (encryptedSession) {
          const sessionData = BrowserSecurityService.decrypt(encryptedSession);
          if (sessionData) {
            const session: AuthSession = JSON.parse(sessionData);
            
            if (BrowserSecurityService.isValidSession(session)) {
              const encryptedUser = localStorage.getItem('currentUser');
              if (encryptedUser) {
                const userData = BrowserSecurityService.decrypt(encryptedUser);
                if (userData) {
                  setUser(JSON.parse(userData));
                  setIsSessionValid(true);
                }
              }
            } else {
              // Session expired, clean up
              localStorage.removeItem('userSession');
              localStorage.removeItem('currentUser');
            }
          }
        }
      } catch (error) {
        console.error('Error checking stored session:', error);
        localStorage.removeItem('userSession');
        localStorage.removeItem('currentUser');
      }
      setLoading(false);
    };

    checkStoredSession();

    // Set up session check interval (every 5 minutes)
    const sessionCheckInterval = setInterval(() => {
      const encryptedSession = localStorage.getItem('userSession');
      if (encryptedSession) {
        const sessionData = BrowserSecurityService.decrypt(encryptedSession);
        if (sessionData) {
          const session: AuthSession = JSON.parse(sessionData);
          if (!BrowserSecurityService.isValidSession(session)) {
            logout();
          }
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(sessionCheckInterval);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      // Input validation
      if (!username?.trim() || !password?.trim()) {
        return { success: false, message: 'Usuario y contraseña son requeridos' };
      }

      // Rate limiting check
      const rateLimitKey = `login_${username}`;
      const rateLimit = BrowserSecurityService.checkRateLimit(rateLimitKey, MAX_LOGIN_ATTEMPTS);
      
      if (!rateLimit.allowed) {
        const resetTime = new Date(rateLimit.resetTime!);
        return { 
          success: false, 
          message: `Demasiados intentos de login. Intente nuevamente después de ${resetTime.toLocaleTimeString()}` 
        };
      }

      // Sanitize inputs
      const sanitizedUsername = BrowserSecurityService.sanitizeInput(username);
      
      if (!window.api?.login) {
        throw new Error('API no disponible');
      }
      
      // Type assertion for the API response
      const response = await window.api.login({ 
        username: sanitizedUsername, 
        password 
      }) as {
        success: boolean;
        user?: User;
        message?: string;
      };
      
      if (response.success && response.user) {
        // Create secure session
        const session = BrowserSecurityService.generateSession(response.user.id.toString());
        const encryptedSession = BrowserSecurityService.encrypt(JSON.stringify(session));
        const encryptedUser = BrowserSecurityService.encrypt(JSON.stringify(response.user));
        
        if (encryptedSession && encryptedUser) {
          localStorage.setItem('userSession', encryptedSession);
          localStorage.setItem('currentUser', encryptedUser);
          
          setUser(response.user);
          setIsSessionValid(true);
          setLoginAttempts(0);
          
          // Clear rate limit on successful login
          localStorage.removeItem(`rateLimit_${rateLimitKey}`);
          
          return { success: true };
        } else {
          throw new Error('Error al crear sesión segura');
        }
      } else {
        setLoginAttempts(prev => prev + 1);
        return { success: false, message: response.message || 'Credenciales inválidas' };
      }
    } catch (error) {
      console.error("Error during login:", error);
      setLoginAttempts(prev => prev + 1);
      return { success: false, message: "Error de conexión" };
    }
  };

  const logout = () => {
    if (window.api?.logout) {
      window.api.logout();
    }
    setUser(null);
    setIsSessionValid(false);
    
    // Clear all session data
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userSession');
    
    // Clear any rate limiting data
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('rateLimit_')) {
        localStorage.removeItem(key);
      }
    });
  };

  // Enhanced permission checking that uses our utility
  const checkPermission = (target: PermissionTarget, action: PermissionAction = 'ver'): boolean => {
    if (!user) return false;
    
    // Parse the permissions from the user object
    const parsedPermissions = parseStoredPermissions(user.permisos);
    
    // Check the permission using our utility
    return hasPermission(user.rol, parsedPermissions, target, action);
  };

  // Function to require admin password confirmation for privileged operations
  const requireAdminConfirmation = (callback: () => void) => {
    // Only require confirmation for non-admin users
    if (user?.rol === 'admin') {
      callback(); // Admins can perform the action directly
      return;
    }
    
    // For non-admins, set up the confirmation flow
    setConfirmationCallback(() => callback);
    setShowConfirmation(true);
  };

  // Function to handle admin password verification
  const verifyAdminPassword = async (password: string) => {
    try {
      if (!window.api?.login) {
        console.warn('API no disponible para verificación de administrador');
        return false;
      }
      
      // Verify admin credentials through the secure API
      const response = await window.api.login({ 
        username: 'admin', 
        password 
      }) as {
        success: boolean;
        user?: User;
      };
      
      return response.success && response.user?.rol === 'admin';
    } catch (error) {
      console.error('Error verifying admin password:', error);
      return false;
    }
  };

  // Handle admin confirmation result
  const handleConfirmationResult = async (password: string | null) => {
    setShowConfirmation(false);
    
    if (password === null) {
      // User cancelled
      setConfirmationCallback(null);
      return;
    }
    
    const verified = await verifyAdminPassword(password);
    
    if (verified && confirmationCallback) {
      // Execute the callback if verification was successful
      confirmationCallback();
    } else {
      // Show error message about invalid password
      alert('Contraseña de administrador incorrecta');
    }
    
    setConfirmationCallback(null);
  };

  // Function to refresh session
  const refreshSession = () => {
    if (user) {
      const session = BrowserSecurityService.generateSession(user.id.toString());
      const encryptedSession = BrowserSecurityService.encrypt(JSON.stringify(session));
      
      if (encryptedSession) {
        localStorage.setItem('userSession', encryptedSession);
        setIsSessionValid(true);
      }
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        login, 
        logout, 
        loading,
        isSessionValid,
        hasPermission: checkPermission,
        requireAdminConfirmation,
        refreshSession
      }}
    >
      {children}
      
      {/* Admin confirmation dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Se requiere autorización</h2>
            <p className="mb-4">Esta operación requiere permisos de administrador.</p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const password = new FormData(form).get('adminPassword') as string;
              handleConfirmationResult(password);
            }}>
              <div className="mb-4">
                <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Contraseña de administrador
                </label>
                <input
                  type="password"
                  id="adminPassword"
                  name="adminPassword"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleConfirmationResult(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Verificar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};