// src/types/electron.d.ts
import { 
  Product, Category, Sale, User, Customer,
  CashSession, Settings, InventoryMovement,
  DailyReport, Expense, SaleDetail
} from '../services/DatabaseService';

import {PrintOptions, PrintInvoiceOptions} from './printer';

interface Versions {
  node: () => string;
  chrome: () => string;
  electron: () => string;
}

interface FacturaState {
  invoices: PreviewSale[];
  selectedInvoice: PreviewSale | null;
  loading: boolean;
  error: string | null;
  searchId: string;
  startDate: Date;
  endDate: Date;
  previewMode: boolean;
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  filterStatus: 'all' | 'completed' | 'cancelled';
  filterPaymentMethod: 'all' | 'cash' | 'card' | 'transfer';
  isSearching: boolean;
}

interface SalesResponse {
  data: PreviewSale[];
  total: number;
}



interface SavePdfOptions {
  html: string;
  path: string;
  options?: {
    printBackground?: boolean;
    margins?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
    pageSize?: string;
  };
}

interface PrintInvoiceResult {
  success: boolean;
  error?: string;
  needManualPrint?: boolean;
}

interface SavePdfResult {
  success: boolean;
  path?: string;
  originalPath?: string;
  message?: string;
  error?: string;
  errorDetail?: string;
}

interface Printer {
  isThermal: boolean;
  name: string;
  description?: string;
  status?: number;
  isDefault?: boolean;
  options?: Record<string, any>;
}

interface AppPaths {
  userData: string;
  documents: string;
  downloads: string;
  temp: string;
  exe: string;
  appData: string;
}

interface PrintResult {
  success: boolean;
  error?: string;
}

interface CancelSaleResult {
  success: boolean;
  error?: string;
}

interface SaleWithDetails {
  id: number;
  fecha_venta: string;
  cliente?: string;
  total: number;
  detalles: SaleDetail[];
}

interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  id?: number;
}

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

interface UserUpdateData {
  nombre: string;
  usuario: string;
  clave?: string;
  rol: 'admin' | 'cajero' | 'empleado';
  permisos: string;
}

// Interface for sync events
interface SyncEvent {
  type: string;
  data?: any;
  timestamp: number;
}

interface ElectronPrinting {
  getPrinters: () => Promise<Array<{
    name: string;
    isDefault?: boolean;
    description?: string;
    status?: number;
    isThermal?: boolean;
  }>>;
  // Add any other methods that electronPrinting may have
}

interface ElectronPrinter {
  getPrinters: () => Promise<Array<{
    name: string;
    description?: string;
    isDefault?: boolean;
    isThermal?: boolean;
  }>>;
  print: (options: PrintOptions) => Promise<{ success: boolean; error?: string }>;
}

export enum PrinterType {
  STANDARD = 'normal',
  THERMAL_80MM = 'termica',
  THERMAL_58MM = 'termica58'
}


export interface SavePdfOptions {
  directory: string;
  filename?: string;
  overwrite?: boolean;
}

export interface PrinterInfo {
  name: string;
  description?: string;
  isDefault?: boolean;
  isThermal?: boolean;
  status?: number; // added optional status
}

declare global {
  interface Window {
    versions: Versions;
    electronPrinter: ElectronPrinter;
    electronPrinting?: ElectronPrinting;
    api?: {
      // Window controls
      openFolder: (folderPath: string) => Promise<boolean>;
      minimize: () => Promise<boolean>;
      maximize: () => Promise<boolean>;
      close: () => Promise<boolean>;
      
      // Server connection (if application can connect to remote server)
      connectToServer: (serverDetails: any) => Promise<boolean>;
      getConnectionStatus: () => Promise<{ connected: boolean; message?: string }>;
      
      // Authentication handlers
      login: (credentials: { username: string; password: string }) => Promise<{
        success: boolean;
        user?: User;
        message?: string;
      }>;
      logout: () => Promise<boolean>;
      
      // User management
      getUsers: () => Promise<UserData[]>;
      addUser: (user: UserUpdateData) => Promise<ApiResponse>;
      updateUser: (id: number, user: UserUpdateData) => Promise<ApiResponse>;
      deleteUser: (id: number) => Promise<ApiResponse>;
      
      // Database
      initializeDatabase: () => Promise<boolean>;
      
      // Products
      getProducts: () => Promise<Product[]>;
      addProduct: (product: Product) => Promise<Product>;
      updateProduct: (id: number, product: Product) => Promise<Product>;
      deleteProduct: (id: number) => Promise<boolean>;
      
      // Categories
      getCategories: () => Promise<Category[]>;
      addCategory: (category: Category) => Promise<Category>;
      updateCategory: (id: number, category: Category) => Promise<Category>;
      deleteCategory: (id: number) => Promise<boolean>;
      
      // Customers
      getCustomers: () => Promise<Customer[]>;
      addCustomer: (customer: Customer) => Promise<Customer>;
      updateCustomer: (id: number, customer: Customer) => Promise<Customer>;
      deleteCustomer: (id: number) => Promise<boolean>;
      
      // Sales
      createSale: (sale: Sale, details?: SaleDetail[]) => Promise<SaleResponse>;
      getSales: (filters?: any) => Promise<PreviewSale[]>;
      getSaleDetails: (id: number) => Promise<Sale>;
      
      // Report handlers
      getDailySalesReport: (date: string) => Promise<any>,
      getMonthlyReport: (month: string, year: string) => Promise<any>,
      getSalesReport: (startDate: string, endDate: string) => Promise<any>,
      getTopProducts: (startDate: string, endDate: string, limit?: number) => Promise<any>,
      getDailyReports: (params: { startDate: string, endDate: string }) => Promise<DailyReport[]>,
      
      // Customers handlers
      getCustomers: () => Promise<any>;
      addCustomer: (customer: any) => Promise<any>;
      updateCustomer: (id: number, customer: any) => Promise<any>;
      deleteCustomer: (id: number) => Promise<any>;
      
      // Users
      getUsers: () => Promise<User[]>;
      addUser: (user: User) => Promise<User>;
      updateUser: (id: number, user: User) => Promise<User>;
      deleteUser: (id: number) => Promise<boolean>;
      
      // Cash Register
      getCurrentCashSession: () => Promise<CashSession | null>;
      openCashSession: (data: { monto_inicial: number; notas_apertura?: string }) => Promise<CashSession>;
      closeCashSession: (data: { id: number; monto_final: number; notas_cierre?: string }) => Promise<CashSession>;
      addCashTransaction: (data: { sesion_id: number; tipo: string; monto: number; concepto: string; referencia?: string }) => Promise<any>;
      getCashTransactions: (sesion_id: number) => Promise<any[]>;
      
      // Expenses
      getExpenses: (filters?: any) => Promise<Expense[]>;
      addExpense: (expense: Expense) => Promise<Expense>;
      updateExpense: (id: number, expense: Expense) => Promise<Expense>;
      deleteExpense: (id: number) => Promise<boolean>;
      
      // Inventory movements
      getInventoryMovements: (filters?: any) => Promise<InventoryMovement[]>;
      addInventoryMovement: (movement: InventoryMovement) => Promise<InventoryMovement>;
      
      // Settings
      getSettings?: () => Promise<any>;
      getSettings: () => Promise<Settings>;
      saveSettings: (settings: Settings) => Promise<Settings>;
      
      // Window management
      openComponentWindow: (component: string) => Promise<{ windowId: number; cached: boolean; success: boolean; error?: string }>;
      identifyWindow: () => Promise<{ type: string; id?: number; component?: string; error?: string }>;
      
      // Event listeners
      onAppReady: (callback: (data: any) => void) => void;
      onShowLicenseActivation: (callback: () => void) => void;
      removeAllListeners: (channel?: string) => void;

      // PDF and printer methods
      getPDFPath: () => Promise<string>;
      getPrinters: () => Promise<Printer[]>;
      printInvoice: (options: PrintInvoiceOptions) => Promise<PrintInvoiceResult>;
      savePdf: (options: SavePdfOptions) => Promise<SavePdfResult>;

      getAppPaths: () => Promise<AppPaths>;
      cancelSale: (id: number) => Promise<CancelSaleResult>;

      // Sync event methods
      registerSyncListener: () => void,
      unregisterSyncListener: () => void,
      broadcastSyncEvent: (event: SyncEvent) => void,
      testPrinter: (printerName?: string) => Promise<PrintResult>,

      ensureDir?: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      sendMail?: (opts: {
        subject: string;
        body: string;
        attachments?: string[];
      }) => Promise<{ success: boolean; error?: string }>;
      
      print?: (options: PrintOptions) => Promise<PrintResult>;
      printRaw?: (text: string, printerName?: string) => Promise<PrintResult>;
      printInvoice?: (options: any) => Promise<PrintResult>;
      testPrinter?: (printerName?: string) => Promise<PrintResult>;
      

    };
    printerApi: {

      getPrinters: () => Promise<{ success: boolean; printers: PrinterInfo[]; error?: string }>;
      print: (opts: PrintOptions) => Promise<PrintResult>;
      savePdf: (opts: SavePdfOptions) => Promise<SavePdfResult>;
      getPdfPath?: () => Promise<string | null>;
      printRaw?: (texto: string, printerName?: string) => Promise<PrintResult>;
    };
    electron?: {
      app: {
        getState: () => Promise<any>;
        setState: (state: any) => Promise<void>;
      };
    };
  }
}

export { type PrintInvoiceOptions };