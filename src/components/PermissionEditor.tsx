// src/components/PermissionEditor.tsx
import React, { useState, useEffect } from 'react';
import { Shield, Check, X } from 'lucide-react';
import { UserRole } from '../types/user';
import { 
  PermissionTarget, 
  PermissionAction,
  getAvailablePermissions,
  getTargetDisplayName, 
  getActionDisplayName,
  parseStoredPermissions
} from '../utils/PermissionUtils';

interface PermissionEditorProps {
  userRole: UserRole;
  initialPermissions: string | Record<string, any>;
  onChange: (permissions: Record<string, any>) => void;
  simplified?: boolean; // Optional simplified mode for non-admin users
}

const PermissionEditor: React.FC<PermissionEditorProps> = ({ 
  userRole, 
  initialPermissions, 
  onChange,
  simplified = false
}) => {
  // Parse the initial permissions
  const [permissions, setPermissions] = useState<Record<string, any>>(
    parseStoredPermissions(initialPermissions)
  );

  // Get available permissions based on user role
  const availablePermissions = getAvailablePermissions();

  // Update state when initialPermissions changes
  useEffect(() => {
    setPermissions(parseStoredPermissions(initialPermissions));
  }, [initialPermissions]);

  // Toggle a permission
  const togglePermission = (target: PermissionTarget, action: PermissionAction) => {
    const updatedPermissions = { ...permissions };
    
    // Initialize the target if it doesn't exist
    if (!updatedPermissions[target]) {
      updatedPermissions[target] = {};
    }
    
    // If the target is an object with action keys
    if (typeof updatedPermissions[target] === 'object') {
      // Toggle the permission
      updatedPermissions[target][action] = !updatedPermissions[target][action];
    } else {
      // Initialize it as an object with the action
      updatedPermissions[target] = { [action]: true };
    }
    
    setPermissions(updatedPermissions);
    onChange(updatedPermissions);
  };

  // Reset permissions to default for the selected role
  const resetToDefaults = () => {
    // In a real implementation, this would reset to the default permissions for the role
    // For now, we'll just clear the custom permissions
    setPermissions({});
    onChange({});
  };

  // Check if a permission is granted
  const isPermissionGranted = (target: PermissionTarget, action: PermissionAction): boolean => {
    if (!permissions[target]) return false;
    
    if (typeof permissions[target] === 'object') {
      return !!permissions[target][action];
    }
    
    return false;
  };

  // Disable certain permissions based on role
  const isPermissionDisabled = (target: PermissionTarget, action: PermissionAction): boolean => {
    // Admin can't be restricted
    if (userRole === 'admin') return true;
    
    // Critical permissions that can only be granted by admin
    const criticalPermissions = [
      { target: 'usuarios', action: 'eliminar' },
      { target: 'facturas', action: 'anular' },
      { target: 'facturas', action: 'reimprimir' },
      { target: 'configuracion', action: 'config' }
    ];
    
    return criticalPermissions.some(p => p.target === target && p.action === action);
  };

  // In simplified mode, we'll show a more streamlined UI
  if (simplified) {
    return (
      <div className="bg-gray-50 p-4 rounded-md">
        <h3 className="text-md font-medium text-gray-700 mb-4 flex items-center">
          <Shield className="h-4 w-4 mr-2 text-blue-500" />
          Permisos de acceso
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {['usuarios', 'clientes', 'facturas', 'caja', 'informes', 'inventario', 'dashboard', 'configuracion'].map((module) => (
            <div key={module} className="flex items-center">
              <input
                type="checkbox"
                id={`perm-${module}`}
                checked={permissions[module] || false}
                onChange={() => {
                  const updatedPermissions = { ...permissions };
                  updatedPermissions[module] = !updatedPermissions[module];
                  setPermissions(updatedPermissions);
                  onChange(updatedPermissions);
                }}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={module === 'usuarios' && userRole !== 'admin'}
              />
              <label htmlFor={`perm-${module}`} className="ml-2 block text-sm text-gray-700 capitalize">
                {getTargetDisplayName(module as PermissionTarget)}
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Full permission editor UI
  return (
    <div className="bg-white p-4 rounded-lg border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-800 flex items-center">
          <Shield className="h-5 w-5 mr-2 text-blue-600" />
          Permisos Detallados
        </h3>
        
        <button
          onClick={resetToDefaults}
          className="text-sm text-blue-600 hover:text-blue-800"
          disabled={userRole === 'admin'}
        >
          Restaurar valores predeterminados
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Módulo
              </th>
              {['ver', 'crear', 'editar', 'eliminar', 'anular', 'reimprimir', 'config'].map(action => (
                <th key={action} scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getActionDisplayName(action as PermissionAction)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {availablePermissions.map(({ target, actions }) => (
              <tr key={target} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {getTargetDisplayName(target)}
                </td>
                
                {['ver', 'crear', 'editar', 'eliminar', 'anular', 'reimprimir', 'config'].map(action => {
                  // Check if this action is available for this target
                  const isAvailable = actions.includes(action as PermissionAction);
                  const isDisabled = isPermissionDisabled(target, action as PermissionAction);
                  const isGranted = isPermissionGranted(target, action as PermissionAction);
                  
                  return (
                    <td key={`${target}-${action}`} className="px-6 py-4 whitespace-nowrap text-center">
                      {isAvailable ? (
                        <button
                          onClick={() => togglePermission(target, action as PermissionAction)}
                          disabled={isDisabled}
                          className={`p-1 rounded-md ${
                            isDisabled 
                              ? 'cursor-not-allowed opacity-50' 
                              : isGranted 
                                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                          title={isDisabled ? 'Este permiso no se puede modificar para este rol' : ''}
                        >
                          {isGranted ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <X className="h-5 w-5" />
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {userRole === 'admin' && (
        <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
          <p>Los administradores tienen todos los permisos por defecto y no pueden ser restringidos.</p>
        </div>
      )}
    </div>
  );
};

export default PermissionEditor;