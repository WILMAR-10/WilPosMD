import { User } from "./user";

// src/types/sales.ts - Extended types definition for sales
export interface CartItem {
  id?: number;
  product_id: number;
  name: string;
  price: number;
  price_without_tax: number;
  quantity: number;
  subtotal: number;
  itebis: number;
  is_exempt: boolean;
  discount?: number;
}

export interface PreviewSale {
  id?: number;
  cliente_id: number;
  cliente: string;
  total: number;
  descuento: number;
  impuestos: number;
  metodo_pago: 'Efectivo' | 'Tarjeta' | 'Transferencia';
  estado: string;
  notas?: string;
  fecha_venta: string;
  usuario_id?: number;
  usuario: string;
  monto_recibido: number;
  cambio: number;
  detalles: CartItem[];
  [key: string]: any;
}

// Tipo para método de pago (string literal type)
export type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia';

// Tipo para los detalles de venta que se envía a la API
export interface SaleDetail {
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  descuento?: number;
  itebis: number;
  subtotal: number;
}

// Tipo para las ventas que se envían a la API
export interface Sale {
  id?: number;
  cliente_id: number;
  total: number;
  descuento?: number;
  impuestos?: number;
  metodo_pago: PaymentMethod;
  estado?: string;
  notas?: string;
  usuario_id?: number;
  monto_recibido?: number;
  cambio?: number;
  detalles: SaleDetail[];
}

// Additional response types for API calls
export interface ApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  id?: number;
  user?: User; 
}

export interface SaleResponse extends Sale, ApiResponse {
  id: number;
  warnings?: string[];
}

// Extended DAO response type
export interface DaoResponse<T> {
  success: boolean;
  id?: number;
  error?: string;
  details?: string;
  data?: T;
}