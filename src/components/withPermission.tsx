// src/components/withPermission.tsx
import React, { ComponentType, FC, ReactElement, ReactNode } from 'react';
import { useAuth } from '../services/AuthContext';
import { PermissionTarget, PermissionAction } from '../utils/PermissionUtils';

interface WithPermissionProps {
  target: PermissionTarget;
  action: PermissionAction;
  fallback?: ReactElement | null;
  requireAdminConfirmation?: boolean;
}

/**
 * Higher-Order Component for permission-based rendering
 * 
 * Wraps a component and only renders it if the user has the required permission.
 * Can optionally require admin confirmation for sensitive actions.
 * 
 * @example
 * // Create a delete button that requires permission
 * const DeleteButton = withPermission(
 *   (props) => <button {...props}>Delete</button>,
 *   { target: 'usuarios', action: 'eliminar', requireAdminConfirmation: true }
 * );
 */
export function withPermission<P extends object>(
  WrappedComponent: ComponentType<P>,
  { target, action, fallback = null, requireAdminConfirmation = false }: WithPermissionProps
): FC<P> {
  return (props: P) => {
    const { hasPermission, user, requireAdminConfirmation: confirmAdmin } = useAuth();
    
    // Check if user has permission
    const hasAccess = hasPermission(target, action);
    
    // If no access, render fallback or null
    if (!hasAccess) {
      return fallback;
    }
    
    // For components with onClick handlers that need admin confirmation
    if (requireAdminConfirmation && user?.rol !== 'admin' && 'onClick' in props) {
      const originalOnClick = props.onClick as any;
      
      // Create new props with modified onClick
      const newProps = {
        ...props,
        onClick: (e: React.MouseEvent<HTMLElement>) => {
          e.preventDefault();
          e.stopPropagation();
          
          confirmAdmin(() => {
            // This will be called after admin password is verified
            if (originalOnClick) {
              originalOnClick(e);
            }
          });
        }
      };
      
      return <WrappedComponent {...newProps} />;
    }
    
    // Render the component normally
    return <WrappedComponent {...props} />;
  };
}

/**
 * Create a component that conditionally renders its children based on permissions
 */
export const PermissionGate: FC<{
  target: PermissionTarget;
  action?: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}> = ({ target, action = 'ver', children, fallback = null }) => {
  const { hasPermission } = useAuth();
  
  if (!hasPermission(target, action)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};