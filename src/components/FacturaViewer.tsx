// src/components/FacturaViewer.tsx - Improved invoice viewer with proper tax handling
import React from 'react';
import { 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign, 
  CreditCard, 
  ArrowLeft,
  AlertTriangle,
  ShieldCheck,
  User
} from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { useSettings } from '../services/DatabaseService';

interface FacturaViewerProps {
  ventaData: any;
  className?: string;
  printMode?: boolean; // Add printMode prop for thermal printer optimization
}

const FacturaViewer: React.FC<FacturaViewerProps> = ({ ventaData, className = "", printMode = false }) => {
  const { user } = useAuth();
  const { settings } = useSettings();

  // Función para formatear moneda - Fixed to properly handle currency codes
  const formatCurrency = (amount: number) => {
    try {
      // Extract the first 3 characters if it's a valid currency code, otherwise use 'DOP'
      let currencyCode = 'DOP'; // Default to Dominican Peso
      
      if (settings?.moneda) {
        // Handle common currency symbols and convert to standard codes
        const currencyMap: Record<string, string> = {
          'RD$': 'DOP', // Dominican Peso
          '$': 'USD',   // US Dollar
          '€': 'EUR',   // Euro
          '£': 'GBP'    // British Pound
        };
        
        if (currencyMap[settings.moneda]) {
          currencyCode = currencyMap[settings.moneda];
        } else if (settings.moneda.length === 3) {
          // If it's already a 3-letter code, use it directly
          currencyCode = settings.moneda;
        }
      }
      
      return new Intl.NumberFormat('es-DO', { 
        style: 'currency', 
        currency: currencyCode,
        minimumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      // Fallback formatting if Intl.NumberFormat fails
      console.warn('Error formatting currency:', error);
      return `${settings?.moneda || 'RD$'} ${amount.toFixed(2)}`;
    }
  };

  // Función para formatear fecha
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      
      if (settings?.formato_fecha === 'DD/MM/YYYY') {
        return new Intl.DateTimeFormat('es-DO', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).format(date);
      } else if (settings?.formato_fecha === 'MM/DD/YYYY') {
        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).format(date);
      } else {
        // YYYY-MM-DD
        return new Intl.DateTimeFormat('fr-CA', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).format(date);
      }
    } catch (error) {
      console.warn('Error formatting date:', error);
      return dateString.toString();
    }
  };

  // Función para calcular totales (mejorada para cálculo correcto de ITBIS)
  const calcularTotales = () => {
    if (!ventaData || !ventaData.detalles) return { 
      subtotal: 0, 
      impuestos: 0, 
      descuento: 0, 
      total: 0 
    };
    
    let subtotal = 0;
    let impuestos = 0;
    
    // Calcular subtotal e impuestos a partir de los detalles
    ventaData.detalles.forEach((item: any) => {
      if (item.is_exempt || item.itebis === 0) {
        // Productos exentos: el precio es el total, sin impuestos
        subtotal += item.subtotal;
      } else {
        // Productos con ITBIS: calculamos el precio base y el impuesto
        const taxRate = item.itebis || 0.18;
        const basePrice = item.price_without_tax || (item.price / (1 + taxRate));
        const itemTax = item.price - basePrice;
        
        // Sumamos al subtotal y a los impuestos según la cantidad
        subtotal += basePrice * item.quantity;
        impuestos += itemTax * item.quantity;
      }
    });
    
    // Redondear para evitar errores de punto flotante
    subtotal = Math.round(subtotal * 100) / 100;
    impuestos = Math.round(impuestos * 100) / 100;
    
    // Usar valores de la venta si están disponibles
    const descuento = ventaData.descuento || 0;
    const total = ventaData.total || (subtotal + impuestos - descuento);
    
    return { subtotal, impuestos, descuento, total };
  };

  const { subtotal, impuestos, descuento, total } = calcularTotales();

  // Verificar si hay información de monto recibido y cambio
  const showPaymentDetails = ventaData?.metodo_pago === 'Efectivo' && 
                            (ventaData?.monto_recibido !== undefined || 
                            ventaData?.cambio !== undefined);
  
  // Para impresora térmica de 80mm, optimizamos el ancho
  const thermalPrinterStyles = printMode ? {
    maxWidth: '80mm',
    width: '80mm',
    padding: '5mm',
    margin: '0 auto',
    fontSize: '10pt',
    lineHeight: '1.2',
    fontFamily: 'Arial, sans-serif'
  } : {};

  if (!ventaData) {
    return <div className="p-8 text-center text-gray-500">No hay datos de factura disponibles</div>;
  }

  return (
    <div className={`bg-white p-6 rounded-lg ${className}`} style={thermalPrinterStyles}>
      <div className="space-y-4">
        {/* Encabezado de la factura */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {settings?.logo ? (
                <img src={settings.logo} alt="Logo" className="h-12 w-auto" />
              ) : (
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xl">
                  {settings?.nombre_negocio?.charAt(0) || 'W'}
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-800">{settings?.nombre_negocio || 'WilPOS'}</h2>
                {settings?.rnc && <p className="text-sm text-gray-600">RNC: {settings.rnc}</p>}
              </div>
            </div>
            
            <div className="text-sm text-gray-600 space-y-1">
              {settings?.direccion && <p>{settings.direccion}</p>}
              <div className="flex items-center gap-4">
                {settings?.telefono && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {settings.telefono}
                  </span>
                )}
                {settings?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {settings.email}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-right">
          <div className="inline-block bg-blue-50 text-blue-800 font-medium px-3 py-1 rounded-md mb-2">
              Factura #{ventaData.id || ''}
            </div>
            <div className="text-sm text-gray-600 flex flex-col items-end">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {formatDate(ventaData.fecha_venta)}
              </span>
              <span className="flex items-center gap-1 capitalize">
                {ventaData.metodo_pago === 'Efectivo' ? (
                  <><DollarSign className="h-3 w-3" /> Efectivo</>
                ) : ventaData.metodo_pago === 'Tarjeta' ? (
                  <><CreditCard className="h-3 w-3" /> Tarjeta</>
                ) : (
                  <><ArrowLeft className="h-3 w-3" /> {ventaData.metodo_pago}</>
                )}
              </span>
              {ventaData.comprobante_fiscal && (
                <span className="flex items-center gap-1 text-green-600 mt-1">
                  <ShieldCheck className="h-3 w-3" /> NCF: {ventaData.comprobante_fiscal}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Información del cliente y cajero */}
        <div className="border-t border-b py-4 grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-1">Cliente</h3>
            <p className="text-gray-800">{ventaData.cliente || 'Cliente General'}</p>
            {ventaData.cliente_rnc && (
              <p className="text-xs text-gray-600">RNC/Cédula: {ventaData.cliente_rnc}</p>
            )}
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-1">Atendido por</h3>
            <p className="text-gray-800 flex items-center gap-1">
              <User className="h-3 w-3 text-gray-500" />
              {ventaData.usuario || user?.nombre || 'WilPOS'}
            </p>
          </div>
        </div>
        
        {/* Detalles de la venta */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Detalle de productos</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-medium text-gray-600">Producto</th>
                <th className="text-center py-2 font-medium text-gray-600">Cant.</th>
                <th className="text-right py-2 font-medium text-gray-600">Precio</th>
                <th className="text-right py-2 font-medium text-gray-600">ITBIS</th>
                <th className="text-right py-2 font-medium text-gray-600">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {ventaData.detalles && ventaData.detalles.map((item: any, index: number) => {
                // Calcular el precio base y el ITBIS por cada artículo
                const isExempt = item.is_exempt || item.itebis === 0;
                const quantity = item.quantity || item.cantidad || 1;
                const unitPrice = item.price || item.precio_unitario || 0;
                const taxRate = isExempt ? 0 : (item.itebis || 0.18);
                
                // Calcular precio base y monto de ITBIS para este artículo
                const basePrice = isExempt ? unitPrice : (unitPrice / (1 + taxRate));
                const itemTaxAmount = isExempt ? 0 : (unitPrice - basePrice);
                
                // Calcular totales para la línea
                const lineBaseTotal = basePrice * quantity;
                const lineTaxTotal = itemTaxAmount * quantity;
                const lineTotal = lineBaseTotal + lineTaxTotal;
                
                return (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 text-gray-800">
                      {item.name || item.producto_nombre || `Producto #${item.product_id || item.producto_id}`}
                    </td>
                    <td className="py-2 text-center text-gray-800">{quantity}</td>
                    <td className="py-2 text-right text-gray-800">
                      {formatCurrency(unitPrice)}
                      {!isExempt && (
                        <div className="text-xs text-gray-500">
                          {formatCurrency(basePrice)} + ITBIS
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-right text-gray-800">
                      {isExempt ? (
                        <span className="text-green-600 text-xs">Exento</span>
                      ) : (
                        <>
                          {formatCurrency(lineTaxTotal)}
                          <div className="text-xs text-gray-500">
                            ({(taxRate * 100).toFixed(0)}%)
                          </div>
                        </>
                      )}
                    </td>
                    <td className="py-2 text-right text-gray-800">{formatCurrency(item.subtotal || lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Totales */}
        <div className="flex justify-end mt-4">
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            
            {impuestos > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>{settings?.impuesto_nombre || 'ITBIS'}:</span>
                <span>{formatCurrency(impuestos)}</span>
              </div>
            )}
            
            {descuento > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Descuento:</span>
                <span>-{formatCurrency(descuento)}</span>
              </div>
            )}
            
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span>{formatCurrency(total)}</span>
            </div>
            
            {/* Información de pago (monto recibido y cambio) */}
            {showPaymentDetails && (
              <div className="border-t pt-2 mt-2">
                {ventaData.monto_recibido !== undefined && (
                  <div className="flex justify-between text-gray-600">
                    <span>Recibido:</span>
                    <span>{formatCurrency(ventaData.monto_recibido)}</span>
                  </div>
                )}
                
                {ventaData.cambio !== undefined && (
                  <div className="flex justify-between text-gray-600">
                    <span>Cambio:</span>
                    <span className={ventaData.cambio >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatCurrency(ventaData.cambio)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Estado de la factura */}
        {ventaData.estado && ventaData.estado !== 'Completada' && (
          <div className="flex justify-center mt-4">
            <div className={`
              px-4 py-2 rounded-md inline-flex items-center gap-2 text-sm
              ${ventaData.estado === 'Anulada' ? 'bg-red-50 text-red-700' : 
                ventaData.estado === 'Pendiente' ? 'bg-yellow-50 text-yellow-700' : 
                'bg-gray-50 text-gray-700'}
            `}>
              <AlertTriangle className="h-4 w-4" />
              <span className="uppercase font-medium">
                {ventaData.estado === 'Anulada' ? 'Factura Anulada' :
                 ventaData.estado === 'Pendiente' ? 'Pago Pendiente' : 
                 ventaData.estado}
              </span>
            </div>
          </div>
        )}
        
        {/* Notas y términos */}
        <div className="border-t pt-4 text-center text-sm text-gray-600 mt-4">
          {ventaData.notas && (
            <p className="mb-2 italic">{ventaData.notas}</p>
          )}
          <p>{settings?.mensaje_recibo || 'Gracias por su compra'}</p>
        </div>
        
        {/* Footer */}
        <div className="text-xs text-gray-500 text-center border-t pt-2 mt-4">
          <p>Generado por WilPOS</p>
          {settings?.sitio_web && <p>{settings.sitio_web}</p>}
          {ventaData.id && (
            <p className="mt-1 font-mono">{new Date().toISOString().split('T')[0]}/{ventaData.id}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacturaViewer;