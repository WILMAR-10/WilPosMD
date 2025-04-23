// src/services/ProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { PermissionTarget, PermissionAction } from '../utils/PermissionUtils';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredModule?: PermissionTarget | null;
  requiredAccess?: PermissionAction;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredModule = null,
  requiredAccess = 'ver' 
}) => {
  const { user, loading, hasPermission } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (requiredModule && !hasPermission(requiredModule, requiredAccess)) {
    return <Navigate to="/unauthorized" />;
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;