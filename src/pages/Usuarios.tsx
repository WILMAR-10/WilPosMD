// Updated Usuarios.tsx with Client Management
import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  User, Users, Pencil, Trash2, Plus, Search, Filter,
  AlertCircle, X, Check, Loader, ChevronLeft, Shield, 
  ShieldCheck, ShieldOff, ShieldX, UserCircle, UserPlus, Menu,
  AlertTriangle
} from 'lucide-react';
import { PermissionTarget, PermissionAction } from '../utils/PermissionUtils';
import { Customer } from '../services/DatabaseService';

// Type definitions
type AlertType = 'success' | 'warning' | 'error' | 'info';
type ActiveTab = 'users' | 'clients';

// API response interfaces
interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  id?: number;
}

// User interface from API
interface UserData {
  id?: number;
  nombre: string;
  usuario: string;
  clave?: string;
  rol: 'admin' | 'cajero' | 'empleado';
  permisos: string | Record<string, boolean>;
  activo?: number;
  fecha_creacion?: string;
}

// Form data for adding/editing users
interface FormData {
  nombre: string;
  usuario: string;
  clave: string;
  rol: 'admin' | 'cajero' | 'empleado';
  permisos: Record<string, boolean>;
}

// Data to send for updates
interface UserUpdateData {
  nombre: string;
  usuario: string;
  clave?: string;
  rol: 'admin' | 'cajero' | 'empleado';
  permisos: string;
}

// Client form data
interface ClientFormData {
  nombre: string;
  documento?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  notas?: string;
}

const Usuarios: React.FC = () => {
  const { user, hasPermission } = useAuth();
  
  // Common states
  const [activeTab, setActiveTab] = useState<ActiveTab>('users');
  const [alert, setAlert] = useState<{ type: AlertType; message: string } | null>(null);

  // User management states
  const [users, setUsers] = useState<UserData[]>([]);
  const [userLoading, setUserLoading] = useState<boolean>(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [isAddingUser, setIsAddingUser] = useState<boolean>(false);
  const [isEditingUser, setIsEditingUser] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  
  // Client management states
  const [clients, setClients] = useState<Customer[]>([]);
  const [clientLoading, setClientLoading] = useState<boolean>(true);
  const [clientError, setClientError] = useState<string | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState<string>('');
  const [isAddingClient, setIsAddingClient] = useState<boolean>(false);
  const [isEditingClient, setIsEditingClient] = useState<boolean>(false);
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);

  // Form state for adding/editing users
  const [userFormData, setUserFormData] = useState<FormData>({
    nombre: '',
    usuario: '',
    clave: '',
    rol: 'empleado',
    permisos: {}
  });

  // Form state for adding/editing clients
  const [clientFormData, setClientFormData] = useState<ClientFormData>({
    nombre: '',
    documento: '',
    telefono: '',
    email: '',
    direccion: '',
    notas: ''
  });

  // Dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning' as 'warning' | 'danger' | 'info'
  });

  // Load users on component mount
  useEffect(() => {
    if (activeTab === 'users' && hasPermission('usuarios', 'ver')) {
      fetchUsers();
    }
  }, [activeTab]);

  // Load clients on component mount or tab change
  useEffect(() => {
    if (activeTab === 'clients' && hasPermission('clientes', 'ver')) {
      fetchClients();
    }
  }, [activeTab]);

  // Fetch users from API
  const fetchUsers = async () => {
    try {
      setUserLoading(true);
      if (!window.api?.getUsers) {
        throw new Error('API no disponible');
      }
      
      const data = await window.api.getUsers();
      setUsers(data);
      setUserError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setUserError(`Error al cargar usuarios: ${errorMessage}`);
      setAlert({
        type: 'error',
        message: `Error al cargar usuarios: ${errorMessage}`
      });
    } finally {
      setUserLoading(false);
    }
  };

  // Fetch clients from API
  const fetchClients = async () => {
    try {
      setClientLoading(true);
      if (!window.api?.getCustomers) {
        throw new Error('API no disponible');
      }
      
      const data = await window.api.getCustomers();
      setClients(data);
      setClientError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setClientError(`Error al cargar clientes: ${errorMessage}`);
      setAlert({
        type: 'error',
        message: `Error al cargar clientes: ${errorMessage}`
      });
    } finally {
      setClientLoading(false);
    }
  };

  // Add new user
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check permission first
    if (!hasPermission('usuarios', 'crear')) {
      setAlert({
        type: 'error',
        message: 'No tienes permiso para crear usuarios'
      });
      return;
    }
    
    try {
      if (!window.api?.addUser) {
        throw new Error('API no disponible');
      }

      // Validate required fields
      if (!userFormData.nombre || !userFormData.usuario || !userFormData.clave) {
        setAlert({
          type: 'warning',
          message: 'Todos los campos son obligatorios'
        });
        return;
      }

      // Convert permissions object to string for API
      const userToAdd: UserUpdateData = {
        nombre: userFormData.nombre,
        usuario: userFormData.usuario,
        clave: userFormData.clave,
        rol: userFormData.rol,
        permisos: JSON.stringify(userFormData.permisos)
      };

      const result = await window.api.addUser(userToAdd) as ApiResponse;
      
      if (result.success) {
        setAlert({
          type: 'success',
          message: 'Usuario creado con éxito'
        });
        setIsAddingUser(false);
        resetUserForm();
        fetchUsers();
      } else {
        throw new Error(result.error || 'Error al crear usuario');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setAlert({
        type: 'error',
        message: `Error al crear usuario: ${errorMessage}`
      });
    }
  };

  // Update existing user
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check permission first
    if (!hasPermission('usuarios', 'editar')) {
      setAlert({
        type: 'error',
        message: 'No tienes permiso para editar usuarios'
      });
      return;
    }
    
    if (!selectedUser || !selectedUser.id) return;
    
    try {
      if (!window.api?.updateUser) {
        throw new Error('API no disponible');
      }

      // Validate required fields
      if (!userFormData.nombre || !userFormData.usuario) {
        setAlert({
          type: 'warning',
          message: 'Nombre y usuario son obligatorios'
        });
        return;
      }

      // Create a new object for update with the proper types
      const dataToUpdate: UserUpdateData = {
        nombre: userFormData.nombre,
        usuario: userFormData.usuario,
        rol: userFormData.rol,
        permisos: JSON.stringify(userFormData.permisos)
      };
      
      // Only include password if it's not empty
      if (userFormData.clave && userFormData.clave.trim() !== '') {
        dataToUpdate.clave = userFormData.clave;
      }

      // Prevent users from upgrading themselves to admin
      if (user?.id === selectedUser.id && user?.rol !== 'admin' && userFormData.rol === 'admin') {
        setAlert({
          type: 'error',
          message: 'No puedes cambiar tu rol a administrador'
        });
        return;
      }

      const result = await window.api.updateUser(selectedUser.id, dataToUpdate) as ApiResponse;
      
      if (result.success) {
        setAlert({
          type: 'success',
          message: 'Usuario actualizado con éxito'
        });
        setIsEditingUser(false);
        resetUserForm();
        fetchUsers();
      } else {
        throw new Error(result.error || 'Error al actualizar usuario');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setAlert({
        type: 'error',
        message: `Error al actualizar usuario: ${errorMessage}`
      });
    }
  };

  // Add new client
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check permission first
    if (!hasPermission('clientes', 'crear')) {
      setAlert({
        type: 'error',
        message: 'No tienes permiso para crear clientes'
      });
      return;
    }
    
    try {
      if (!window.api?.addCustomer) {
        throw new Error('API no disponible');
      }

      // Validate required fields
      if (!clientFormData.nombre) {
        setAlert({
          type: 'warning',
          message: 'El nombre del cliente es obligatorio'
        });
        return;
      }

      const result = await window.api.addCustomer(clientFormData);
      
      if (result) {
        setAlert({
          type: 'success',
          message: 'Cliente agregado con éxito'
        });
        setIsAddingClient(false);
        resetClientForm();
        fetchClients();
      } else {
        throw new Error('Error al agregar cliente');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setAlert({
        type: 'error',
        message: `Error al agregar cliente: ${errorMessage}`
      });
    }
  };

  // Update existing client
  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check permission first
    if (!hasPermission('clientes', 'editar')) {
      setAlert({
        type: 'error',
        message: 'No tienes permiso para editar clientes'
      });
      return;
    }
    
    if (!selectedClient || !selectedClient.id) return;
    
    try {
      if (!window.api?.updateCustomer) {
        throw new Error('API no disponible');
      }

      // Validate required fields
      if (!clientFormData.nombre) {
        setAlert({
          type: 'warning',
          message: 'El nombre del cliente es obligatorio'
        });
        return;
      }

      const result = await window.api.updateCustomer(selectedClient.id, clientFormData);
      
      if (result) {
        setAlert({
          type: 'success',
          message: 'Cliente actualizado con éxito'
        });
        setIsEditingClient(false);
        resetClientForm();
        fetchClients();
      } else {
        throw new Error('Error al actualizar cliente');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setAlert({
        type: 'error',
        message: `Error al actualizar cliente: ${errorMessage}`
      });
    }
  };

  // Handle user form input changes
  const handleUserInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserFormData({
      ...userFormData,
      [name]: value
    });
  };

  // Handle client form input changes
  const handleClientInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setClientFormData({
      ...clientFormData,
      [name]: value
    });
  };

  // Reset user form fields
  const resetUserForm = () => {
    setUserFormData({
      nombre: '',
      usuario: '',
      clave: '',
      rol: 'empleado',
      permisos: {}
    });
    setSelectedUser(null);
  };

  // Reset client form fields
  const resetClientForm = () => {
    setClientFormData({
      nombre: '',
      documento: '',
      telefono: '',
      email: '',
      direccion: '',
      notas: ''
    });
    setSelectedClient(null);
  };

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.nombre.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.usuario.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.rol.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  // Filter clients based on search term
  const filteredClients = clients.filter(client =>
    client.nombre.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    (client.documento && client.documento.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
    (client.telefono && client.telefono.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
    (client.email && client.email.toLowerCase().includes(clientSearchTerm.toLowerCase()))
  );

  // Handle permission toggles for user roles
  const handlePermissionChange = (module: string, value: boolean) => {
    setUserFormData({
      ...userFormData,
      permisos: {
        ...userFormData.permisos,
        [module]: value
      }
    });
  };
  
  // Edit user (load data into form)
  const handleEditUser = (userItem: UserData) => {
    // Check permission first
    if (!hasPermission('usuarios', 'editar')) {
      setAlert({
        type: 'error',
        message: 'No tienes permiso para editar usuarios'
      });
      return;
    }
    
    setSelectedUser(userItem);
    
    // Parse permissions if they're stored as a string
    let userPermissions: Record<string, boolean> = {};
    
    if (typeof userItem.permisos === 'string') {
      try {
        userPermissions = JSON.parse(userItem.permisos);
      } catch (error) {
        console.error('Error parsing permissions:', error);
        // Use empty object if parsing fails
      }
    } else if (userItem.permisos && typeof userItem.permisos === 'object') {
      userPermissions = userItem.permisos as Record<string, boolean>;
    }
    
    setUserFormData({
      nombre: userItem.nombre,
      usuario: userItem.usuario,
      clave: '', // Don't show existing password
      rol: userItem.rol,
      permisos: userPermissions
    });
    
    setIsEditingUser(true);
  };

  // Edit client (load data into form)
  const handleEditClient = (client: Customer) => {
    // Check permission first
    if (!hasPermission('clientes', 'editar')) {
      setAlert({
        type: 'error',
        message: 'No tienes permiso para editar clientes'
      });
      return;
    }
    
    setSelectedClient(client);
    setClientFormData({
      nombre: client.nombre,
      documento: client.documento || '',
      telefono: client.telefono || '',
      email: client.email || '',
      direccion: client.direccion || '',
      notas: client.notas || ''
    });
    
    setIsEditingClient(true);
  };
  
  // Delete user confirmation
  const handleDeleteUser = (userItem: UserData) => {
    // Check permission first
    if (!hasPermission('usuarios', 'eliminar')) {
      setAlert({
        type: 'error',
        message: 'No tienes permiso para eliminar usuarios'
      });
      return;
    }
    
    // Prevent users from deleting themselves
    if (userItem.id === user?.id) {
      setAlert({
        type: 'error',
        message: 'No puedes eliminar tu propia cuenta'
      });
      return;
    }
    
    // Show confirmation dialog
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Usuario',
      message: `¿Estás seguro de eliminar al usuario ${userItem.nombre}? Esta acción no se puede deshacer.`,
      onConfirm: () => confirmDeleteUser(userItem.id),
      type: 'danger'
    });
  };

  // Delete client confirmation
  const handleDeleteClient = (client: Customer) => {
    // Check permission first
    if (!hasPermission('clientes', 'eliminar')) {
      setAlert({
        type: 'error',
        message: 'No tienes permiso para eliminar clientes'
      });
      return;
    }
    
    // Prevent deleting the generic client (id = 1)
    if (client.id === 1) {
      setAlert({
        type: 'error',
        message: 'No puedes eliminar el cliente genérico'
      });
      return;
    }
    
    // Show confirmation dialog
    setConfirmDialog({
      isOpen: true,
      title: 'Eliminar Cliente',
      message: `¿Estás seguro de eliminar al cliente ${client.nombre}? Esta acción no se puede deshacer.`,
      onConfirm: () => confirmDeleteClient(client.id),
      type: 'danger'
    });
  };
  
  // Confirm delete user
  const confirmDeleteUser = async (id?: number) => {
    if (typeof id === 'undefined') {
      setAlert({
        type: 'error',
        message: 'ID de usuario no válido'
      });
      return;
    }
    
    try {
      if (!window.api?.deleteUser) {
        throw new Error('API no disponible');
      }
      
      const result = await window.api.deleteUser(id) as ApiResponse;
      
      if (result.success) {
        setAlert({
          type: 'success',
          message: 'Usuario eliminado con éxito'
        });
        fetchUsers();
      } else {
        throw new Error(result.error || 'Error al eliminar usuario');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setAlert({
        type: 'error',
        message: `Error al eliminar usuario: ${errorMessage}`
      });
    }
  };

  // Confirm delete client
  const confirmDeleteClient = async (id?: number) => {
    if (typeof id === 'undefined') {
      setAlert({
        type: 'error',
        message: 'ID de cliente no válido'
      });
      return;
    }
    
    try {
      if (!window.api?.deleteCustomer) {
        throw new Error('API no disponible');
      }
      
      const result = await window.api.deleteCustomer(id);
      
      if (result) {
        setAlert({
          type: 'success',
          message: 'Cliente eliminado con éxito'
        });
        fetchClients();
      } else {
        throw new Error('Error al eliminar cliente');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setAlert({
        type: 'error',
        message: `Error al eliminar cliente: ${errorMessage}`
      });
    }
  };
  
  // Regresar al home
  const handleGoBack = () => {
    const event = new CustomEvent('componentChange', {
      detail: { component: 'Home' }
    });
    window.dispatchEvent(event);
  };

  // Show confirm dialog
  const showConfirmDialog = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'danger' | 'info' = 'warning') => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
      type
    });
  };
  
  // Alert component
  const Alert = ({ type, message }: { type: AlertType; message: string }) => {
    const colors = {
      success: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', icon: Check },
      warning: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', icon: AlertTriangle },
      error: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', icon: X },
      info: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', icon: AlertCircle }
    };
    
    const style = colors[type] || colors.info;
    const Icon = style.icon;
    
    return (
      <div className={`${style.bg} ${style.text} ${style.border} border p-4 rounded-lg flex items-start mb-4`}>
        <Icon className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
        <div className="flex-grow">{message}</div>
        <button onClick={() => setAlert(null)} className="ml-2 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };
  
  // Close alert after a period
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Check if user has permission for either users or clients module
  const canAccessUsersModule = hasPermission('usuarios', 'ver');
  const canAccessClientsModule = hasPermission('clientes', 'ver');
  
  // If no access to either module, show unauthorized message
  if (!canAccessUsersModule && !canAccessClientsModule) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-md max-w-md text-center">
          <ShieldX className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acceso Restringido</h2>
          <p className="text-gray-600 mb-6">No tienes permiso para gestionar usuarios ni clientes.</p>
          <button
            onClick={handleGoBack}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  // Determine which tab to show by default
  // If user has no permission for users but has for clients, show clients tab
  useEffect(() => {
    if (!canAccessUsersModule && canAccessClientsModule) {
      setActiveTab('clients');
    }
  }, [canAccessUsersModule, canAccessClientsModule]);

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      {/* Alerta */}
      {alert && (
        <div className="fixed top-6 right-6 z-50 max-w-md w-full">
          <Alert type={alert.type} message={alert.message} />
        </div>
      )}
      
      {/* Encabezado */}
      <header className="flex justify-between items-center px-8 py-4 shadow-md bg-white rounded-lg mb-6">
        <div className="flex items-center gap-3">
          <button onClick={handleGoBack} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">
              {activeTab === 'users' ? 'Gestión de Usuarios' : 'Gestión de Clientes'}
            </h1>
          </div>
        </div>
        
        {/* Botones de acción según el módulo activo */}
        {activeTab === 'users' && !isAddingUser && !isEditingUser && hasPermission('usuarios', 'crear') && (
          <button
            className="flex items-center gap-2 py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            onClick={() => setIsAddingUser(true)}
          >
            <Plus className="h-4 w-4" />
            Agregar Usuario
          </button>
        )}
        
        {activeTab === 'clients' && !isAddingClient && !isEditingClient && hasPermission('clientes', 'crear') && (
          <button
            className="flex items-center gap-2 py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            onClick={() => setIsAddingClient(true)}
          >
            <Plus className="h-4 w-4" />
            Agregar Cliente
          </button>
        )}
      </header>
      
      {/* Pestañas para cambiar entre usuarios y clientes */}
      <div className="flex justify-center mb-6">
        <div className="bg-white rounded-lg shadow-sm p-1 flex">
          {canAccessUsersModule && (
            <button 
              className={`py-2 px-4 rounded-lg flex items-center gap-2 ${
                activeTab === 'users' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setActiveTab('users')}
            >
              <User className="h-4 w-4" />
              <span>Usuarios</span>
            </button>
          )}
          
          {canAccessClientsModule && (
            <button 
              className={`py-2 px-4 rounded-lg flex items-center gap-2 ${
                activeTab === 'clients' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setActiveTab('clients')}
            >
              <UserCircle className="h-4 w-4" />
              <span>Clientes</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Contenido según la pestaña activa */}
      <main className="flex-1 px-6 pb-8">
        {/* Gestión de Usuarios */}
        {activeTab === 'users' && (
          <>
            {isAddingUser ? (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Agregar Nuevo Usuario</h2>
                <form onSubmit={handleAddUser}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        id="nombre"
                        name="nombre"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={userFormData.nombre}
                        onChange={handleUserInputChange}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="usuario" className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre de Usuario
                      </label>
                      <input
                        type="text"
                        id="usuario"
                        name="usuario"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={userFormData.usuario}
                        onChange={handleUserInputChange}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="clave" className="block text-sm font-medium text-gray-700 mb-1">
                        Contraseña
                      </label>
                      <input
                        type="password"
                        id="clave"
                        name="clave"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={userFormData.clave}
                        onChange={handleUserInputChange}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="rol" className="block text-sm font-medium text-gray-700 mb-1">
                        Rol
                      </label>
                      <select
                        id="rol"
                        name="rol"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={userFormData.rol}
                        onChange={handleUserInputChange}
                      >
                        {/* Only allow creating admins if current user is admin */}
                        {user?.rol === 'admin' && <option value="admin">Administrador</option>}
                        <option value="cajero">Cajero</option>
                        <option value="empleado">Empleado</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <h3 className="text-md font-medium text-gray-700 mb-2">Permisos</h3>
                    <div className="bg-gray-50 p-4 rounded-md grid grid-cols-2 md:grid-cols-3 gap-4">
                      {['usuarios', 'inventario', 'ventas', 'facturas', 'reportes', 'configuracion', 'dashboard', 'caja', 'clientes'].map((module) => (
                        <div key={module} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`perm-${module}`}
                            checked={userFormData.permisos[module] || false}
                            onChange={(e) => handlePermissionChange(module, e.target.checked)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                          />
                          <label htmlFor={`perm-${module}`} className="ml-2 block text-sm text-gray-700 capitalize">
                            {module}
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Los administradores tienen acceso completo independientemente de estos permisos.
                    </p>
                  </div>
                  
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingUser(false);
                        resetUserForm();
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            ) : isEditingUser ? (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Editar Usuario</h2>
                <form onSubmit={handleUpdateUser}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        id="nombre"
                        name="nombre"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={userFormData.nombre}
                        onChange={handleUserInputChange}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="usuario" className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre de Usuario
                      </label>
                      <input
                        type="text"
                        id="usuario"
                        name="usuario"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={userFormData.usuario}
                        onChange={handleUserInputChange}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="clave" className="block text-sm font-medium text-gray-700 mb-1">
                        Contraseña (Dejar en blanco para mantener la actual)
                      </label>
                      <input
                        type="password"
                        id="clave"
                        name="clave"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={userFormData.clave}
                        onChange={handleUserInputChange}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="rol" className="block text-sm font-medium text-gray-700 mb-1">
                        Rol
                      </label>
                      <select
                        id="rol"
                        name="rol"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={userFormData.rol}
                        onChange={handleUserInputChange}
                        disabled={selectedUser?.id === user?.id} // Can't change own role
                      >
                        {/* Only allow editing to admin if current user is admin */}
                        {user?.rol === 'admin' && <option value="admin">Administrador</option>}
                        <option value="cajero">Cajero</option>
                        <option value="empleado">Empleado</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <h3 className="text-md font-medium text-gray-700 mb-2">Permisos</h3>
                    <div className="bg-gray-50 p-4 rounded-md grid grid-cols-2 md:grid-cols-3 gap-4">
                      {['usuarios', 'inventario', 'ventas', 'facturas', 'reportes', 'configuracion', 'dashboard', 'caja', 'clientes'].map((module) => (
                        <div key={module} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`perm-${module}`}
                            checked={userFormData.permisos[module] || false}
                            onChange={(e) => handlePermissionChange(module, e.target.checked)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            disabled={userFormData.rol === 'admin' || (selectedUser?.id === user?.id && module === 'usuarios')} // Admin has all permissions, can't remove own users permission
                          />
                          <label htmlFor={`perm-${module}`} className="ml-2 block text-sm text-gray-700 capitalize">
                            {module}
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Los administradores tienen acceso completo independientemente de estos permisos.
                    </p>
                  </div>
                  
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingUser(false);
                        resetUserForm();
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Actualizar
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                {/* Filtros y búsqueda */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                  <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                    <div className="flex-1">
                      <h2 className="text-lg font-medium text-gray-800 mb-3">Buscar usuario</h2>
                      <div className="relative max-w-md w-full">
                        <Search className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                        <input
                          type="text"
                          className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Buscar por nombre, usuario o rol"
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="text-gray-400 h-4 w-4" />
                      <span className="text-sm text-gray-600">Total: {filteredUsers.length} usuarios</span>
                    </div>
                  </div>
                </div>
                
                {/* Tabla de usuarios */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {userLoading ? (
                    <div className="flex justify-center items-center p-10">
                      <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                      <p className="ml-2 text-gray-500">Cargando usuarios...</p>
                    </div>
                  ) : userError ? (
                    <div className="text-center p-10">
                      <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
                      <p className="text-red-600">{userError}</p>
                      <button
                        onClick={fetchUsers}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center p-10">
                      <User className="h-10 w-10 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No se encontraron usuarios</p>
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Usuario
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nombre
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rol
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Permisos
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredUsers.map((userItem) => (
                          <tr key={userItem.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                  {userItem.usuario.charAt(0).toUpperCase()}
                                </div>
                                <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">@{userItem.usuario}</div>
                                  <div className="text-xs text-gray-500">
                                    Creado: {new Date(userItem.fecha_creacion || '').toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {userItem.nombre}
                              {userItem.id === user?.id && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  Tú
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                userItem.rol === 'admin' ? 'bg-red-100 text-red-800' : 
                                userItem.rol === 'cajero' ? 'bg-green-100 text-green-800' : 
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {userItem.rol === 'admin' ? 'Administrador' : 
                                 userItem.rol === 'cajero' ? 'Cajero' : 'Empleado'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {userItem.rol === 'admin' ? (
                                <div className="flex items-center">
                                  <ShieldCheck className="h-4 w-4 text-green-600 mr-1" />
                                  <span>Acceso completo</span>
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  {typeof userItem.permisos === 'string' && userItem.permisos ? (
                                    <div className="flex gap-1 flex-wrap">
                                      {(() => {
                                        try {
                                          const permisos = JSON.parse(userItem.permisos);
                                          const modulesCount = Object.keys(permisos).length;
                                          return (
                                            <span>{modulesCount} módulos</span>
                                          );
                                        } catch (e) {
                                          return (
                                            <span>Permisos personalizados</span>
                                          );
                                        }
                                      })()}
                                    </div>
                                  ) : (
                                    <span>Sin permisos</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                userItem.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {userItem.activo ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end gap-2">
                                {hasPermission('usuarios', 'editar') && (
                                  <button
                                    onClick={() => handleEditUser(userItem)}
                                    className="text-blue-600 hover:text-blue-900"
                                    title="Editar usuario"
                                    disabled={userLoading}
                                  >
                                    <Pencil className="h-5 w-5" />
                                  </button>
                                )}
                                
                                {hasPermission('usuarios', 'eliminar') && userItem.id !== 1 && userItem.id !== user?.id && (
                                  <button
                                    onClick={() => handleDeleteUser(userItem)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Eliminar usuario"
                                    disabled={userLoading}
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Gestión de Clientes */}
        {activeTab === 'clients' && (
          <>
            {isAddingClient ? (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Agregar Nuevo Cliente</h2>
                <form onSubmit={handleAddClient}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        id="nombre"
                        name="nombre"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={clientFormData.nombre}
                        onChange={handleClientInputChange}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="documento" className="block text-sm font-medium text-gray-700 mb-1">
                        Documento (Cédula/RNC)
                      </label>
                      <input
                        type="text"
                        id="documento"
                        name="documento"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={clientFormData.documento}
                        onChange={handleClientInputChange}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        id="telefono"
                        name="telefono"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={clientFormData.telefono}
                        onChange={handleClientInputChange}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Correo Electrónico
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={clientFormData.email}
                        onChange={handleClientInputChange}
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 mb-1">
                      Dirección
                    </label>
                    <input
                      type="text"
                      id="direccion"
                      name="direccion"
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={clientFormData.direccion}
                      onChange={handleClientInputChange}
                    />
                  </div>
                  
                  <div className="mt-4">
                    <label htmlFor="notas" className="block text-sm font-medium text-gray-700 mb-1">
                      Notas (opcional)
                    </label>
                    <textarea
                      id="notas"
                      name="notas"
                      rows={3}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={clientFormData.notas}
                      onChange={handleClientInputChange}
                    ></textarea>
                  </div>
                  
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingClient(false);
                        resetClientForm();
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            ) : isEditingClient ? (
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Editar Cliente</h2>
                <form onSubmit={handleUpdateClient}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        id="nombre"
                        name="nombre"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={clientFormData.nombre}
                        onChange={handleClientInputChange}
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="documento" className="block text-sm font-medium text-gray-700 mb-1">
                        Documento (Cédula/RNC)
                      </label>
                      <input
                        type="text"
                        id="documento"
                        name="documento"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={clientFormData.documento}
                        onChange={handleClientInputChange}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        id="telefono"
                        name="telefono"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={clientFormData.telefono}
                        onChange={handleClientInputChange}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Correo Electrónico
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        value={clientFormData.email}
                        onChange={handleClientInputChange}
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 mb-1">
                      Dirección
                    </label>
                    <input
                      type="text"
                      id="direccion"
                      name="direccion"
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={clientFormData.direccion}
                      onChange={handleClientInputChange}
                    />
                  </div>
                  
                  <div className="mt-4">
                    <label htmlFor="notas" className="block text-sm font-medium text-gray-700 mb-1">
                      Notas (opcional)
                    </label>
                    <textarea
                      id="notas"
                      name="notas"
                      rows={3}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={clientFormData.notas}
                      onChange={handleClientInputChange}
                    ></textarea>
                  </div>
                  
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingClient(false);
                        resetClientForm();
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Actualizar
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                {/* Filtros y búsqueda de clientes */}
                <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
                  <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                    <div className="flex-1">
                      <h2 className="text-lg font-medium text-gray-800 mb-3">Buscar cliente</h2>
                      <div className="relative max-w-md w-full">
                        <Search className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                        <input
                          type="text"
                          className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Buscar por nombre, documento o teléfono"
                          value={clientSearchTerm}
                          onChange={(e) => setClientSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="text-gray-400 h-4 w-4" />
                      <span className="text-sm text-gray-600">Total: {filteredClients.length} clientes</span>
                    </div>
                  </div>
                </div>
                
                {/* Tabla de clientes */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {clientLoading ? (
                    <div className="flex justify-center items-center p-10">
                      <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                      <p className="ml-2 text-gray-500">Cargando clientes...</p>
                    </div>
                  ) : clientError ? (
                    <div className="text-center p-10">
                      <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
                      <p className="text-red-600">{clientError}</p>
                      <button
                        onClick={fetchClients}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Reintentar
                      </button>
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="text-center p-10">
                      <UserCircle className="h-10 w-10 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No se encontraron clientes</p>
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cliente
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Documento
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contacto
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Dirección
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredClients.map((client) => (
                          <tr key={client.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                  {client.nombre.charAt(0).toUpperCase()}
                                </div>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-gray-900">{client.nombre}</div>
                                  {client.id === 1 && (
                                    <span className="text-xs text-gray-500">Cliente Genérico</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {client.documento || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div>
                                {client.telefono && <div>{client.telefono}</div>}
                                {client.email && <div className="text-xs text-blue-500">{client.email}</div>}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {client.direccion || 'No especificada'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end gap-2">
                                {hasPermission('clientes', 'editar') && (
                                  <button
                                    onClick={() => handleEditClient(client)}
                                    className="text-blue-600 hover:text-blue-900"
                                    title="Editar cliente"
                                  >
                                    <Pencil className="h-5 w-5" />
                                  </button>
                                )}
                                
                                {hasPermission('clientes', 'eliminar') && client.id !== 1 && (
                                  <button
                                    onClick={() => handleDeleteClient(client)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Eliminar cliente"
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>
      
      {/* Diálogo de confirmación */}
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({...confirmDialog, isOpen: false})}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
      />
    </div>
  );
};

export default Usuarios;