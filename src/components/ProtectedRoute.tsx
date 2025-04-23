// src/components/ProtectedRoute.tsx
import React, { ReactNode } from 'react';
import { useAuth } from '../services/AuthContext';
import Unauthorized from './Unauthorized';
import { PermissionTarget, PermissionAction } from '../utils/PermissionUtils';

interface ProtectedRouteProps {
  requiredTarget: PermissionTarget;
  requiredAction?: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  requiredTarget, 
  requiredAction = 'ver', 
  children,
  fallback
}) => {
  const { hasPermission } = useAuth();
  
  // Check if the user has the required permission
  const isAuthorized = hasPermission(requiredTarget, requiredAction);
  
  // If not authorized, show the fallback or the Unauthorized component
  if (!isAuthorized) {
    return fallback ? <>{fallback}</> : <Unauthorized />;
  }
  
  // If authorized, render the children
  return <>{children}</>;
};

export default ProtectedRoute;