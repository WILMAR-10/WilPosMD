// src/services/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User, UserRole } from '../types/user';
import { PermissionAction, PermissionTarget, hasPermission, parseStoredPermissions } from '../utils/PermissionUtils';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  hasPermission: (target: PermissionTarget, action?: PermissionAction) => boolean;
  requireAdminConfirmation: (callback: () => void) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmationCallback, setConfirmationCallback] = useState<(() => void) | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      if (!window.api?.login) {
        throw new Error('API no disponible');
      }
      
      // Type assertion for the API response
      const response = await window.api.login({ username, password }) as {
        success: boolean;
        user?: User;
        message?: string;
      };
      
      if (response.success && response.user) {
        setUser(response.user);
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        return { success: true };
      } else {
        return { success: false, message: response.message || 'Credenciales inválidas' };
      }
    } catch (error) {
      console.error("Error during login:", error);
      return { success: false, message: "Error de conexión" };
    }
  };

  const logout = () => {
    if (window.api?.logout) {
      window.api.logout();
    }
    setUser(null);
    localStorage.removeItem('currentUser');
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
    // In a real app, you would verify this with the backend
    try {
      // Since the API method doesn't exist, we'll implement a simple verification
      // In a production app, you would call an API endpoint to verify
      
      // For demonstration purposes only - in production, never hardcode passwords
      // or implement client-side password verification
      console.warn('Using mock admin password verification (for demonstration only)');
      
      // Mock verification - in production, this should be a server-side call
      const mockAdminPassword = 'admin123';
      return password === mockAdminPassword;
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

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        login, 
        logout, 
        loading, 
        hasPermission: checkPermission,
        requireAdminConfirmation
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