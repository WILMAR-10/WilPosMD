// src/components/InvoiceTemplate.tsx
import React from 'react';
import { useSettings } from '../services/DatabaseService';
import { CartItem, PreviewSale } from '../types/sales';

interface InvoiceTemplateProps {
  sale: PreviewSale;
  details: CartItem[];
}

const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ sale, details }) => {
  const { settings } = useSettings();
  
  const formatCurrency = (amount: number) => {
    try {
      // Extract proper currency code
      let currencyCode = 'DOP'; // Default to Dominican Peso
      
      if (settings?.moneda) {
        // Handle common currency symbols
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
      // Fallback if Intl.NumberFormat fails
      return `${settings?.moneda || 'RD$'} ${amount.toFixed(2)}`;
    }
  };

  // Calcular totales con manejo correcto de ITBIS
  const calculateTotals = () => {
    let subtotal = 0;
    let totalTax = 0;
    
    details.forEach(item => {
      const isExempt = item.is_exempt || item.itebis === 0;
      const quantity = item.quantity;
      const unitPrice = item.price;
      const taxRate = isExempt ? 0 : (item.itebis || 0.18);
      
      if (isExempt) {
        // Products exempt from ITBIS - price is total
        subtotal += item.subtotal;
      } else {
        // Products with ITBIS - calculate base price and tax
        const basePrice = unitPrice / (1 + taxRate);
        const itemTax = unitPrice - basePrice;
        
        subtotal += (basePrice * quantity);
        totalTax += (itemTax * quantity);
      }
    });
    
    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax: parseFloat(totalTax.toFixed(2)),
      discount: sale.descuento || 0,
      total: sale.total || 0
    };
  };
  
  const totals = calculateTotals();

  // Generar HTML para impresión térmica
  const generatePrintHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 10px;
            width: 80mm;
          }
          .header {
            text-align: center;
            margin-bottom: 10px;
          }
          .company-name {
            font-size: 16px;
            font-weight: bold;
          }
          .invoice-details {
            margin: 10px 0;
            font-size: 12px;
          }
          .items {
            width: 100%;
            font-size: 12px;
            margin: 10px 0;
            border-collapse: collapse;
          }
          .items th, .items td {
            padding: 2px;
            text-align: left;
          }
          .items th {
            border-bottom: 1px solid #000;
          }
          .tax-exempt {
            font-size: 10px;
            font-style: italic;
          }
          .totals {
            margin-top: 10px;
            text-align: right;
            font-size: 12px;
          }
          .footer {
            text-align: center;
            margin-top: 10px;
            font-size: 12px;
            border-top: 1px dashed #000;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">${settings?.nombre_negocio || 'WilPOS'}</div>
          <div>${settings?.direccion || ''}</div>
          <div>Tel: ${settings?.telefono || ''}</div>
          <div>RNC: ${settings?.rnc || ''}</div>
        </div>

        <div class="invoice-details">
          <div>Factura #: ${sale.id}</div>
          <div>Fecha: ${new Date(sale.fecha_venta).toLocaleString()}</div>
          <div>Cliente: ${sale.cliente || 'Cliente General'}</div>
        </div>

        <table class="items">
          <tr>
            <th>Cant</th>
            <th>Descripción</th>
            <th>Precio</th>
            <th>Total</th>
          </tr>
          ${details.map(item => {
            const isExempt = item.is_exempt || item.itebis === 0;
            const taxRate = isExempt ? 0 : (item.itebis || 0.18);
            const basePrice = isExempt ? item.price : (item.price / (1 + taxRate));
            
            return `
              <tr>
                <td>${item.quantity}</td>
                <td>
                  ${item.name}
                  ${isExempt ? '<div class="tax-exempt">Exento</div>' : ''}
                </td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatCurrency(item.subtotal)}</td>
              </tr>
            `;
          }).join('')}
        </table>

        <div class="totals">
          <div>Subtotal: ${formatCurrency(totals.subtotal)}</div>
          ${totals.tax > 0 ? `<div>${settings?.impuesto_nombre || 'ITBIS'}: ${formatCurrency(totals.tax)}</div>` : ''}
          ${sale.descuento > 0 ? `<div>Descuento: -${formatCurrency(sale.descuento)}</div>` : ''}
          <div><strong>Total: ${formatCurrency(sale.total)}</strong></div>
          ${sale.metodo_pago === 'Efectivo' ? `
            <div>Recibido: ${formatCurrency(sale.monto_recibido)}</div>
            <div>Cambio: ${formatCurrency(sale.cambio)}</div>
          ` : `<div>Método de pago: ${sale.metodo_pago}</div>`}
        </div>

        <div class="footer">
          <div>${settings?.mensaje_recibo || 'Gracias por su compra'}</div>
          <div>${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}</div>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <div className="p-8 max-w-3xl mx-auto bg-white">
      {/* Company Header */}
      <div className="text-center mb-8">
        {settings?.logo && (
          <img 
            src={settings?.logo} 
            alt="Logo" 
            className="h-20 mx-auto mb-4"
          />
        )}
        <h1 className="text-2xl font-bold">{settings?.nombre_negocio}</h1>
        <p>{settings?.direccion}</p>
        <p>Tel: {settings?.telefono}</p>
        <p>RNC: {settings?.rnc}</p>
      </div>

      {/* Invoice Details */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Factura #{sale.id}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p><strong>Cliente:</strong> {sale.cliente}</p>
            <p><strong>Fecha:</strong> {new Date(sale.fecha_venta).toLocaleDateString()}</p>
          </div>
          <div>
            <p><strong>Método de Pago:</strong> {sale.metodo_pago}</p>
            <p><strong>Estado:</strong> {sale.estado}</p>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <table className="w-full mb-8">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Producto</th>
            <th className="text-right py-2">Cant.</th>
            <th className="text-right py-2">Precio</th>
            <th className="text-right py-2">ITBIS</th>
            <th className="text-right py-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {details.map((item) => {
            const isExempt = item.is_exempt || item.itebis === 0;
            const taxRate = isExempt ? 0 : (item.itebis || 0.18);
            const basePrice = isExempt ? item.price : (item.price / (1 + taxRate));
            const itemTax = isExempt ? 0 : (item.price - basePrice);
            const lineItemTax = itemTax * item.quantity;
            
            return (
              <tr key={item.product_id} className="border-b">
                <td className="py-2">
                  {item.name}
                  {isExempt && (
                    <span className="ml-1 text-xs bg-green-100 text-green-600 px-1 py-0.5 rounded-sm">
                      Exento
                    </span>
                  )}
                </td>
                <td className="text-right py-2">{item.quantity}</td>
                <td className="text-right py-2">
                  {formatCurrency(item.price)}
                  {!isExempt && (
                    <div className="text-xs text-gray-500">
                      {formatCurrency(basePrice)} + ITBIS
                    </div>
                  )}
                </td>
                <td className="text-right py-2">
                  {isExempt ? (
                    <span className="text-green-600 text-xs">Exento</span>
                  ) : (
                    <>
                      {formatCurrency(lineItemTax)}
                      <div className="text-xs text-gray-500">
                        ({(taxRate * 100).toFixed(0)}%)
                      </div>
                    </>
                  )}
                </td>
                <td className="text-right py-2">
                  {formatCurrency(item.subtotal)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="mb-8">
        <div className="flex justify-between border-b py-2">
          <span>Subtotal:</span>
          <span>{formatCurrency(totals.subtotal)}</span>
        </div>
        {totals.tax > 0 && (
          <div className="flex justify-between border-b py-2">
            <span>{settings?.impuesto_nombre || 'ITBIS'}:</span>
            <span>{formatCurrency(totals.tax)}</span>
          </div>
        )}
        {sale.descuento > 0 && (
          <div className="flex justify-between border-b py-2">
            <span>Descuento:</span>
            <span>-{formatCurrency(sale.descuento)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg py-2">
          <span>Total:</span>
          <span>{formatCurrency(sale.total)}</span>
        </div>
        
        {/* Payment details for cash transactions */}
        {sale.metodo_pago === 'Efectivo' && (
          <>
            <div className="flex justify-between py-1 text-sm">
              <span>Monto recibido:</span>
              <span>{formatCurrency(sale.monto_recibido)}</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span>Cambio:</span>
              <span className={sale.cambio >= 0 ? "text-green-600" : "text-red-600"}>
                {formatCurrency(sale.cambio)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-600">
        <p>{settings?.mensaje_recibo || 'Gracias por su compra'}</p>
        <p className="mt-2">¡Gracias por su preferencia!</p>
      </div>
    </div>
  );
};

export default InvoiceTemplate;