// src/components/PermissionButton.tsx
import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { useAuth } from '../services/AuthContext';
import { PermissionTarget, PermissionAction } from '../utils/PermissionUtils';

interface PermissionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  target: PermissionTarget;
  action: PermissionAction;
  children: ReactNode;
  requireConfirmation?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  icon?: ReactNode;
}

/**
 * A button component that only renders if the user has the required permission.
 * Can optionally require admin confirmation for sensitive actions.
 */
const PermissionButton: React.FC<PermissionButtonProps> = ({
  target,
  action,
  children,
  requireConfirmation = false,
  variant = 'primary',
  icon,
  onClick,
  className,
  ...buttonProps
}) => {
  const { hasPermission, requireAdminConfirmation } = useAuth();
  
  // Check if user has the required permission
  const hasAccess = hasPermission(target, action);
  
  // Don't render if user doesn't have permission
  if (!hasAccess) {
    return null;
  }
  
  // Get style based on variant
  const getButtonStyle = () => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'secondary':
        return 'bg-gray-200 hover:bg-gray-300 text-gray-800';
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'success':
        return 'bg-green-600 hover:bg-green-700 text-white';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 text-white';
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };
  
  // Handle click with optional admin confirmation
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (requireConfirmation) {
      e.preventDefault();
      requireAdminConfirmation(() => {
        onClick && onClick(e);
      });
    } else {
      onClick && onClick(e);
    }
  };
  
  return (
    <button
      className={`py-2 px-4 rounded-lg transition-colors flex items-center gap-2 ${getButtonStyle()} ${className || ''}`}
      onClick={handleClick}
      {...buttonProps}
    >
      {icon}
      {children}
    </button>
  );
};

export default PermissionButton;