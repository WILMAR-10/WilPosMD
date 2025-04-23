// src/types/user.ts
export type UserRole = 'admin' | 'cajero' | 'empleado';

export interface User {
  id?: number;
  nombre: string;
  usuario: string;
  clave?: string;
  rol: UserRole;
  permisos: string | Record<string, any>;
  activo?: number;
  fecha_creacion?: string;
}

export interface UserFormData {
  nombre: string;
  usuario: string;
  clave: string;
  rol: UserRole;
  permisos: Record<string, any>;
}

export interface UserUpdateData {
  nombre: string;
  usuario: string;
  clave?: string;
  rol: UserRole;
  permisos: string;
}

// Response from API for login or user operations
export interface UserResponse {
  success: boolean;
  user?: User;
  message?: string;
  error?: string;
}

