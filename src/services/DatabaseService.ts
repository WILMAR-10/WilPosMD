// src/services/DatabaseService.ts
import { useEffect, useState } from 'react';

// Define types for each module
export interface Product {
  id?: number;
  nombre: string;
  codigo_barra?: string;
  categoria?: string;
  precio_venta: number;
  costo: number;
  stock: number;
  stock_minimo?: number;
  imagen?: string;
  itebis: number;
  borrado?: number;
  fecha_creacion?: string;
  ultima_modificacion?: string;
}

export interface Category {
  id?: number;
  nombre: string;
  descripcion?: string;
  activo?: number;
  fecha_creacion?: string;
  ultima_modificacion?: string;
}

export interface Sale {
  id?: number;
  cliente_id?: number;
  cliente?: string;
  total: number;
  descuento?: number;
  impuestos?: number;
  metodo_pago?: string;
  estado?: string;
  notas?: string;
  fecha_venta?: string;
  usuario_id?: number;
  monto_recibido?: number;
  cambio?: number;
  detalles: SaleDetail[];
}

export interface SaleDetail {
  id?: number;
  venta_id?: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  descuento?: number;
  itebis: number;
  subtotal: number;
  producto?: Product;
}

// Modified User interface to align with API expectations
export interface User {
  id?: number;
  nombre: string;
  usuario: string;
  clave?: string;
  rol: 'admin' | 'cajero' | 'empleado';
  permisos: string | Record<string, boolean>;
  activo?: number;
  fecha_creacion?: string;
}

// API response interfaces
export interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  id?: number;
  user?: User;
}

// User update data - specifically for API calls
export interface UserUpdateData {
  nombre: string;
  usuario: string;
  clave?: string;
  rol: 'admin' | 'cajero' | 'empleado';
  permisos: string;  // API expects string, not the union type
}

export interface Customer {
  id?: number;
  nombre: string;
  documento?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  notas?: string;
  activo?: number;
  fecha_creacion?: string;
  ultima_modificacion?: string;
}

export interface DailyReport {
  id?: number;
  fecha?: string;
  total_ventas: number;
  total_gastos: number;
  productos_vendidos: number;
  transacciones?: number;
  efectivo?: number;
  tarjeta?: number;
  otros_metodos?: number;
  usuario_id?: number;
  notas?: string;
}

export interface Expense {
  id?: number;
  descripcion: string;
  categoria?: string;
  monto: number;
  fecha?: string;
  usuario_id?: number;
}

export interface CashSession {
  id?: number;
  monto_inicial: number;
  monto_final?: number;
  fecha_apertura?: string;
  fecha_cierre?: string;
  notas_apertura?: string;
  notas_cierre?: string;
  estado?: string;
  usuario_id?: number;
}

export interface Settings {
  id?: number;
  nombre_negocio?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  rnc?: string;
  sitio_web?: string;
  logo?: string; // now this is string | undefined
  mensaje_recibo?: string;
  moneda?: string;
  formato_fecha?: string;
  impuesto_nombre?: string;
  impuesto_porcentaje?: number;
  impresora_termica?: string;
  impresora_termica_secundaria?: string;
  guardar_pdf?: boolean;
  ruta_pdf?: string; // same if you clear ruta_pdf to undefined
  tema?: string;
  tipo_impresora?: 'normal' | 'termica' | 'termica58'; 
  ultima_modificacion?: string;
  printer_speed?: string; 
  print_density?: string; 
  auto_cut?: boolean;
  open_cash_drawer?: boolean;
  impresora_etiquetas?: string;
}

export interface InventoryMovement {
  id?: number;
  producto_id: number;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  motivo?: string;
  notas?: string;
  fecha?: string;
  usuario_id?: number;
  producto?: Product;
}

// Database Service Hooks

// Products Hook
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchProducts = async () => {
    if (!window.api?.getProducts) {
      setError('API no disponible');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await window.api.getProducts();
      setProducts(data);
      setError(null);
    } catch (err) {
      setError(`Error al cargar productos: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const addProduct = async (product: Product) => {
    if (!window.api?.addProduct) {
      throw new Error('API no disponible');
    }
    
    try {
      const newProduct = await window.api.addProduct(product);
      setProducts([...products, newProduct]);
      return newProduct;
    } catch (err) {
      throw err;
    }
  };
  
  const updateProduct = async (id: number, product: Product) => {
    if (!window.api?.updateProduct) {
      throw new Error('API no disponible');
    }
    
    try {
      const updatedProduct = await window.api.updateProduct(id, product);
      setProducts(products.map(p => p.id === id ? updatedProduct : p));
      return updatedProduct;
    } catch (err) {
      throw err;
    }
  };
  
  const deleteProduct = async (id: number) => {
    if (!window.api?.deleteProduct) {
      throw new Error('API no disponible');
    }
    
    try {
      await window.api.deleteProduct(id);
      setProducts(products.filter(p => p.id !== id));
      return true;
    } catch (err) {
      throw err;
    }
  };
  
  // Fetch products on initial load
  useEffect(() => {
    fetchProducts();
  }, []);
  
  return {
    products,
    loading,
    error,
    setProducts,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct
  };
}

// Categories Hook
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchCategories = async () => {
    if (!window.api?.getCategories) {
      setError('API no disponible');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await window.api.getCategories();
      setCategories(data);
      setError(null);
    } catch (err) {
      setError(`Error al cargar categorías: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const addCategory = async (category: Category) => {
    if (!window.api?.addCategory) {
      throw new Error('API no disponible');
    }
    
    try {
      const newCategory = await window.api.addCategory(category);
      setCategories([...categories, newCategory]);
      return newCategory;
    } catch (err) {
      throw err;
    }
  };
  
  const updateCategory = async (id: number, category: Category) => {
    if (!window.api?.updateCategory) {
      throw new Error('API no disponible');
    }
    
    try {
      const updatedCategory = await window.api.updateCategory(id, category);
      setCategories(categories.map(c => c.id === id ? updatedCategory : c));
      return updatedCategory;
    } catch (err) {
      throw err;
    }
  };
  
  const deleteCategory = async (id: number) => {
    if (!window.api?.deleteCategory) {
      throw new Error('API no disponible');
    }
    
    try {
      await window.api.deleteCategory(id);
      setCategories(categories.filter(c => c.id !== id));
      return true;
    } catch (err) {
      throw err;
    }
  };
  
  // Fetch categories on initial load
  useEffect(() => {
    fetchCategories();
  }, []);
  
  return {
    categories,
    loading,
    error,
    fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory
  };
}

// Customers Hook
export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchCustomers = async () => {
    if (!window.api?.getCustomers) {
      setError('API no disponible');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await window.api.getCustomers();
      setCustomers(data);
      setError(null);
    } catch (err) {
      setError(`Error al cargar clientes: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const addCustomer = async (customer: Customer) => {
    if (!window.api?.addCustomer) {
      throw new Error('API no disponible');
    }
    
    try {
      const newCustomer = await window.api.addCustomer(customer);
      setCustomers([...customers, newCustomer]);
      return newCustomer;
    } catch (err) {
      throw err;
    }
  };
  
  const updateCustomer = async (id: number, customer: Customer) => {
    if (!window.api?.updateCustomer) {
      throw new Error('API no disponible');
    }
    
    try {
      const updatedCustomer = await window.api.updateCustomer(id, customer);
      setCustomers(customers.map(c => c.id === id ? updatedCustomer : c));
      return updatedCustomer;
    } catch (err) {
      throw err;
    }
  };
  
  const deleteCustomer = async (id: number) => {
    if (!window.api?.deleteCustomer) {
      throw new Error('API no disponible');
    }
    
    try {
      await window.api.deleteCustomer(id);
      setCustomers(customers.filter(c => c.id !== id));
      return true;
    } catch (err) {
      throw err;
    }
  };
  
  // Fetch customers on initial load
  useEffect(() => {
    fetchCustomers();
  }, []);
  
  return {
    customers,
    loading,
    error,
    fetchCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer
  };
}

// Sales Hook
export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchSales = async (filters?: any) => {
    if (!window.api?.getSales) {
      setError('API no disponible');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await window.api.getSales(filters);
      setSales(data);
      setError(null);
    } catch (err) {
      setError(`Error al cargar ventas: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const createSale = async (sale: Sale) => {
    if (!window.api?.createSale) {
      throw new Error('API no disponible');
    }
    
    try {
      const newSale = await window.api.createSale(sale);
      setSales([...sales, newSale]);
      return newSale;
    } catch (err) {
      throw err;
    }
  };
  
  // Fetch sales on initial load
  useEffect(() => {
    fetchSales();
  }, []);
  
  return {
    sales,
    loading,
    error,
    fetchSales,
    createSale
  };
}

// Reports Hook
export function useReports() {
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchDailyReports = async (startDate?: string, endDate?: string) => {
    if (!window.api?.getDailyReports) {
      setError('API no disponible');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      // Ensure we always pass strings to the API by using defaults if parameters are undefined
      const validStartDate = startDate || new Date(0).toISOString().split('T')[0]; // Default to epoch start
      const validEndDate = endDate || new Date().toISOString().split('T')[0]; // Default to today
      
      const data = await window.api.getDailyReports({ 
        startDate: validStartDate, 
        endDate: validEndDate 
      });
      
      setDailyReports(data);
      setError(null);
    } catch (err) {
      setError(`Error al cargar reportes: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Use the available API methods instead of the missing ones
  const generateSalesReport = async (startDate: string, endDate: string) => {
    if (!window.api?.getSalesReport) {
      throw new Error('API no disponible');
    }
    
    try {
      return await window.api.getSalesReport(startDate, endDate);
    } catch (err) {
      throw err;
    }
  };
  
  const generateInventoryReport = async () => {
    if (!window.api?.getInventoryMovements) {
      throw new Error('API no disponible');
    }
    
    try {
      // Use inventory movements as a replacement for inventory report
      return await window.api.getInventoryMovements();
    } catch (err) {
      throw err;
    }
  };
  
  // Fetch daily reports on initial load
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];
    
    fetchDailyReports(startDate, endDate);
  }, []);
  
  return {
    dailyReports,
    loading,
    error,
    fetchDailyReports,
    generateSalesReport,
    generateInventoryReport
  };
}

// Users Hook - Fixed to handle API responses correctly
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchUsers = async () => {
    if (!window.api?.getUsers) {
      setError('API no disponible');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await window.api.getUsers();
      // Ensure we're getting an array of User objects
      if (Array.isArray(data)) {
        setUsers(data as User[]);
      } else {
        throw new Error('Formato de respuesta inválido');
      }
      setError(null);
    } catch (err) {
      setError(`Error al cargar usuarios: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const addUser = async (userData: UserUpdateData): Promise<User> => {
    if (!window.api?.addUser) {
      throw new Error('API no disponible');
    }
    
    try {
      const response = await window.api.addUser(userData);
      
      // Check if response is an ApiResponse with success property
      if (typeof response === 'object' && 'success' in response) {
        const apiResponse = response as { 
          success: boolean; 
          error?: string; 
          id?: number; 
          user?: User;
        };
        
        if (!apiResponse.success) {
          throw new Error(apiResponse.error || 'Error al crear usuario');
        }
        
        // Handle case where API returns a success response with an ID but no user object
        if (apiResponse.id && !apiResponse.user) {
          // Fetch the user by ID or construct a user object from userData
          const newUser: User = {
            id: apiResponse.id,
            nombre: userData.nombre,
            usuario: userData.usuario,
            rol: userData.rol,
            permisos: userData.permisos
          };
          
          setUsers([...users, newUser]);
          return newUser;
        }
        
        // Handle case where API returns the user object directly
        if (apiResponse.user) {
          const newUser = apiResponse.user;
          setUsers([...users, newUser]);
          return newUser;
        }
        
        throw new Error('Formato de respuesta inválido');
      } else {
        // If the API returns the user directly
        const newUser = response as User;
        setUsers([...users, newUser]);
        return newUser;
      }
    } catch (err) {
      throw err;
    }
  };

  const updateUser = async (id: number, userData: UserUpdateData): Promise<User> => {
    if (!window.api?.updateUser) {
      throw new Error('API no disponible');
    }
    
    try {
      const response = await window.api.updateUser(id, userData);
      
      // Check if response is an ApiResponse with success property
      if (typeof response === 'object' && 'success' in response) {
        const apiResponse = response as { 
          success: boolean; 
          error?: string; 
          id?: number; 
          user?: User;
        };
        
        if (!apiResponse.success) {
          throw new Error(apiResponse.error || 'Error al actualizar usuario');
        }
        
        // Handle case where API returns a success response with an ID but no user object
        if (apiResponse.success && !apiResponse.user) {
          // Either fetch the updated user or construct from userData + id
          const updatedUser: User = {
            id: id,
            nombre: userData.nombre,
            usuario: userData.usuario,
            rol: userData.rol,
            permisos: userData.permisos
          };
          
          setUsers(users.map(u => u.id === id ? updatedUser : u));
          return updatedUser;
        }
        
        // Handle case where API returns the user object
        if (apiResponse.user) {
          const updatedUser = apiResponse.user;
          setUsers(users.map(u => u.id === id ? updatedUser : u));
          return updatedUser;
        }
        
        throw new Error('Formato de respuesta inválido');
      } else {
        // If the API returns the user directly
        const updatedUser = response as User;
        setUsers(users.map(u => u.id === id ? updatedUser : u));
        return updatedUser;
      }
    } catch (err) {
      throw err;
    }
  };
  
  const deleteUser = async (id: number) => {
    if (!window.api?.deleteUser) {
      throw new Error('API no disponible');
    }
    
    try {
      const response = await window.api.deleteUser(id);
      // Handle different response formats
      if (typeof response === 'boolean') {
        if (response) {
          setUsers(users.filter(u => u.id !== id));
          return true;
        }
        return false;
      } else if ('success' in response) {
        if (response.success) {
          setUsers(users.filter(u => u.id !== id));
          return true;
        }
        throw new Error(response.error || 'Error al eliminar usuario');
      }
      return false;
    } catch (err) {
      throw err;
    }
  };
  
  // Fetch users on initial load (only for users with proper permissions)
  useEffect(() => {
    fetchUsers();
  }, []);
  
  return {
    users,
    loading,
    error,
    fetchUsers,
    addUser,
    updateUser,
    deleteUser
  };
}

// Cash Register Hook
export function useCashRegister() {
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchCurrentCashSession = async () => {
    if (!window.api?.getCurrentCashSession) {
      setError('API no disponible');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await window.api.getCurrentCashSession();
      setCashSession(data);
      setError(null);
    } catch (err) {
      setError(`Error al cargar sesión de caja: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const openCashSession = async (montoInicial: number, notas?: string) => {
    if (!window.api?.openCashSession) {
      throw new Error('API no disponible');
    }
    
    try {
      const session = await window.api.openCashSession({ 
        monto_inicial: montoInicial, 
        notas_apertura: notas 
      });
      setCashSession(session);
      return session;
    } catch (err) {
      throw err;
    }
  };
  
  const closeCashSession = async (montoFinal: number, notas?: string) => {
    if (!window.api?.closeCashSession || !cashSession?.id) {
      throw new Error('API no disponible o no hay sesión activa');
    }
    
    try {
      const session = await window.api.closeCashSession({
        id: cashSession.id,
        monto_final: montoFinal,
        notas_cierre: notas
      });
      setCashSession(null);
      return session;
    } catch (err) {
      throw err;
    }
  };
  
  // Fetch current cash session on initial load
  useEffect(() => {
    fetchCurrentCashSession();
  }, []);
  
  return {
    cashSession,
    loading,
    error,
    fetchCurrentCashSession,
    openCashSession,
    closeCashSession
  };
}

// Settings Hook
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchSettings = async () => {
    if (!window.api?.getSettings) {
      setError('API no disponible');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await window.api.getSettings();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(`Error al cargar configuración: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const saveSettings = async (newSettings: Settings) => {
    if (!window.api?.saveSettings) {
      throw new Error('API no disponible');
    }
    
    try {
      const updatedSettings = await window.api.saveSettings(newSettings);
      setSettings(updatedSettings);
      return updatedSettings;
    } catch (err) {
      throw err;
    }
  };
  
  // Fetch settings on initial load
  useEffect(() => {
    fetchSettings();
  }, []);
  
  return {
    settings,
    loading,
    error,
    fetchSettings,
    saveSettings
  };
}

// Inventory Movements Hook
export function useInventoryMovements() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchMovements = async (filters?: any) => {
    if (!window.api?.getInventoryMovements) {
      setError('API no disponible');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await window.api.getInventoryMovements(filters);
      setMovements(data);
      setError(null);
    } catch (err) {
      setError(`Error al cargar movimientos: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const addMovement = async (movement: InventoryMovement) => {
    if (!window.api?.addInventoryMovement) {
      throw new Error('API no disponible');
    }
    
    try {
      const newMovement = await window.api.addInventoryMovement(movement);
      setMovements([...movements, newMovement]);
      return newMovement;
    } catch (err) {
      throw err;
    }
  };
  
  // Fetch movements on initial load
  useEffect(() => {
    fetchMovements();
  }, []);
  
  return {
    movements,
    loading,
    error,
    fetchMovements,
    addMovement
  };
}