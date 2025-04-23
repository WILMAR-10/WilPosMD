// src/utils/PermissionUtils.ts
import { UserRole } from '../types/user';

// Utility functions and types for handling permissions

export type PermissionTarget = 
  'inventario' | 
  'ventas' | 
  'clientes' | 
  'reportes' | 
  'configuracion' | 
  'usuarios' |
  'dashboard' |
  'caja' |
  'facturas';

export type PermissionAction = 'ver' | 'crear' | 'editar' | 'eliminar' | 'config';

// Define the full permission structure
export interface Permission {
  target: PermissionTarget;
  actions: PermissionAction[];
}

// Map of default permissions by role
const DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  'admin': [
    // Admin has all permissions to all modules
    { 
      target: 'usuarios', 
      actions: ['ver', 'crear', 'editar', 'eliminar'] 
    },
    { 
      target: 'clientes', 
      actions: ['ver', 'crear', 'editar', 'eliminar'] 
    },
    { 
      target: 'configuracion', 
      actions: ['ver', 'editar', 'config'] 
    },
    { 
      target: 'facturas', 
      actions: ['ver'] 
    },
    { 
      target: 'caja', 
      actions: ['ver', 'crear', 'editar'] 
    },
    { 
      target: 'reportes', 
      actions: ['ver'] 
    },
    { 
      target: 'inventario', 
      actions: ['ver', 'crear', 'editar', 'eliminar'] 
    },
    { 
      target: 'dashboard', 
      actions: ['ver'] 
    },
  ],
  
  'cajero': [
    // Cashier has limited permissions
    { 
      target: 'usuarios', 
      actions: ['ver'] 
    },
    { 
      target: 'clientes', 
      actions: ['ver', 'crear'] 
    },
    { 
      target: 'configuracion', 
      actions: ['ver'] // Can only view personal settings
    },
    { 
      target: 'facturas', 
      actions: ['ver'] 
    },
    { 
      target: 'caja', 
      actions: ['ver', 'crear'] 
    },
    { 
      target: 'inventario', 
      actions: ['ver'] 
    },
  ],
  
  'empleado': [
    // Employee has moderate permissions
    { 
      target: 'usuarios', 
      actions: ['ver'] 
    },
    { 
      target: 'clientes', 
      actions: ['ver', 'crear', 'editar'] 
    },
    { 
      target: 'configuracion', 
      actions: ['ver'] 
    },
    { 
      target: 'facturas', 
      actions: ['ver'] 
    },
    { 
      target: 'reportes', 
      actions: ['ver'] 
    },
    { 
      target: 'inventario', 
      actions: ['ver', 'crear', 'editar', 'eliminar'] 
    },
    { 
      target: 'dashboard', 
      actions: ['ver'] 
    },
  ]
};

// Function to check if a specific role has permission for a given action on a target
export function hasPermission(
  role: UserRole, 
  customPermissions: Record<string, any> | null,
  target: PermissionTarget,
  action: PermissionAction
): boolean {
  // Admin always has all permissions
  if (role === 'admin') {
    return true;
  }
  
  // Check custom permissions from the user profile first
  if (customPermissions && typeof customPermissions === 'object') {
    const targetPermissions = customPermissions[target];
    
    // If custom permissions for this target exist, use them
    if (targetPermissions) {
      // Handle various formats of stored permissions
      if (Array.isArray(targetPermissions)) {
        return targetPermissions.includes(action);
      } else if (typeof targetPermissions === 'object') {
        return !!targetPermissions[action];
      } else if (typeof targetPermissions === 'boolean') {
        return targetPermissions; // Simple boolean permission
      }
    }
  }
  
  // Fall back to default permissions for this role
  const rolePermissions = DEFAULT_PERMISSIONS[role] || [];
  const targetPermission = rolePermissions.find(p => p.target === target);
  
  if (!targetPermission) {
    return false;
  }
  
  return targetPermission.actions.includes(action);
}

// Convert user permissions stored as JSON to a usable permissions object
export function parseStoredPermissions(permissionsData: string | Record<string, any> | null): Record<string, any> {
  try {
    if (!permissionsData) {
      return {};
    }
    
    if (typeof permissionsData === 'string') {
      return JSON.parse(permissionsData);
    }
    
    if (typeof permissionsData === 'object') {
      return permissionsData;
    }
    
    return {};
  } catch (error) {
    console.error('Error parsing permissions:', error);
    return {};
  }
}

// Utility function to generate permission list for the admin UI
export function getAvailablePermissions(): Permission[] {
  return [
    { 
      target: 'usuarios', 
      actions: ['ver', 'crear', 'editar', 'eliminar'] 
    },
    { 
      target: 'clientes', 
      actions: ['ver', 'crear', 'editar', 'eliminar'] 
    },
    { 
      target: 'configuracion', 
      actions: ['ver', 'editar', 'config'] 
    },
    { 
      target: 'facturas', 
      actions: ['ver'] 
    },
    { 
      target: 'caja', 
      actions: ['ver', 'crear', 'editar'] 
    },
    { 
      target: 'reportes', 
      actions: ['ver'] 
    },
    { 
      target: 'inventario', 
      actions: ['ver', 'crear', 'editar', 'eliminar'] 
    },
    { 
      target: 'dashboard', 
      actions: ['ver'] 
    },
  ];
}

// Helper to get human-readable permission names
export function getTargetDisplayName(target: PermissionTarget): string {
  const displayNames: Record<PermissionTarget, string> = {
    'usuarios': 'Usuarios',
    'clientes': 'Clientes',
    'configuracion': 'Configuración',
    'facturas': 'Facturas',
    'caja': 'Caja',
    'reportes': 'Reportes',
    'inventario': 'Inventario',
    'dashboard': 'Dashboard',
    'ventas': 'Ventas'
  };
  
  return displayNames[target] || target;
}

export function getActionDisplayName(action: PermissionAction): string {
  const displayNames: Record<PermissionAction, string> = {
    'ver': 'Ver',
    'crear': 'Crear',
    'editar': 'Editar',
    'eliminar': 'Eliminar',
    'config': 'Configurar'
  };
  
  return displayNames[action] || action;
}

// Example utility function for permission handling
export const hasAllPermissions = (
  userPermissions: Record<string, boolean>, 
  requiredPermissions: PermissionTarget[]
): boolean => {
  return requiredPermissions.every(permission => userPermissions[permission] === true);
};