// Caja.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ThermalPrintService, { ThermalPaperSize } from '../services/ThermalPrintService';
import InvoiceManager from '../services/InvoiceManager';
import { 
  ShoppingCart, Search, Package, DollarSign, User, 
  Trash2, Plus, Minus, X, CreditCard, Wallet, ChevronLeft,
  Check, AlertTriangle, AlertCircle, Printer, ArrowLeft, 
  Eye, ShieldCheck, Folder, RotateCcw
} from 'lucide-react';
import { useProducts, useCategories, useCustomers, useSales, Product } from '../services/DatabaseService';
import { useAuth } from '../services/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';
import FacturaViewer from '../components/FacturaViewer';
import Badge from '../components/Badge';
import { Sale, SaleDetail, SaleResponse, ApiResponse } from '../types/sales';
import { broadcastSyncEvent } from '../services/SyncService';

// Tipo de método de pago
type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia';

// Tipo para alerta
type AlertType = 'success' | 'warning' | 'error' | 'info';

// Tipo para ítem del carrito
interface CartItem {
  id?: number;
  product_id: number;
  name: string;
  price: number; // Precio ya incluye ITBIS
  price_without_tax: number; // Precio sin ITBIS
  quantity: number;
  subtotal: number;
  itebis: number;
  is_exempt: boolean; // Indica si el producto está exento de ITBIS
  discount?: number;
}

// Tipo para la venta previsualizada
interface PreviewSale {
  id?: number;
  cliente_id: number;
  cliente: string;
  total: number;
  descuento: number;
  impuestos: number;
  metodo_pago: PaymentMethod;
  estado: string;
  notas?: string;
  fecha_venta: string;
  usuario_id?: number;
  usuario: string;
  monto_recibido: number;
  cambio: number;
  detalles: CartItem[];
}

// Tipo para configuración de impresora
interface PrinterSettings {
  impresora_termica?: string;
  guardar_pdf?: boolean;
  ruta_pdf?: string;
}

interface SaleApiResponse {
  success: boolean;
  error?: string;
  details?: string;
  message?: string;
  id?: number;
  warnings?: string[];
}

const Caja: React.FC = () => {
  const thermalPrintService = ThermalPrintService.getInstance();
  const invoiceManager = InvoiceManager.getInstance();

  const [printerStatus, setPrinterStatus] = useState<{
    available: boolean;
    printerName?: string;
    message?: string;
  }>({ available: false });

  const { user } = useAuth();
  const { products, loading: loadingProducts, fetchProducts } = useProducts();
  const { categories, loading: loadingCategories } = useCategories();
  const { customers, loading: loadingCustomers } = useCustomers();
  const { createSale } = useSales();

  // Estados locales
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<number>(1); // Cliente genérico por defecto
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('Cliente General');
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [notes, setNotes] = useState<string>('');
  const [alert, setAlert] = useState<{ type: AlertType; message: string } | null>(null);
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [previewSale, setPreviewSale] = useState<PreviewSale | null>(null);
  const [printAfterSale, setPrintAfterSale] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [settings, setSettings] = useState<PrinterSettings>({});

  // Referencia para imprimir
  const facturaRef = useRef<HTMLDivElement>(null);

  // Estado para confirmación
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning' as 'warning' | 'danger' | 'info'
  });

  // Cargar configuración cuando inicia el componente
  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (window.api?.getSettings) {
          const appSettings = await window.api.getSettings();
          console.log("Loaded settings:", appSettings);
          
          // Verify configured printer
          if (window.api?.getPrinters) {
            const printers = await window.api.getPrinters();
            console.log("Detected printers:", printers.map(p => p.name));
            console.log("Configured printer:", appSettings.impresora_termica);
            
            // Check if configured printer exists
            const printerExists = printers.some(p => p.name === appSettings.impresora_termica);
            if (appSettings.impresora_termica && !printerExists) {
              console.warn("⚠️ Configured printer not found among available printers");
            }
          }
          
          setSettings({
            impresora_termica: appSettings.impresora_termica,
            guardar_pdf: appSettings.guardar_pdf,
            ruta_pdf: appSettings.ruta_pdf
          });

          // Check thermal printer status
          checkThermalPrinter();
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    loadSettings();
  }, []);

  // Verificar estado de la impresora térmica
  const checkThermalPrinter = async () => {
    try {
      const status = await thermalPrintService.checkPrinterStatus();
      setPrinterStatus(status);
      
      // Show alert if a thermal printer was found automatically
      if (status.available && status.message) {
        setAlert({
          type: 'info',
          message: status.message
        });
      }
    } catch (error) {
      console.error('Error checking thermal printer status:', error);
    }
  };

  useEffect(() => {
    const checkPrinter = async () => {
      try {
        const status = await thermalPrintService.checkPrinterStatus();
        setPrinterStatus(status);

        // Mostrar alerta si se detecta impresora térmica
        if (status.available && status.message) {
          setAlert({
            type: 'info',
            message: status.message
          });
        }
      } catch (error) {
        console.error('Error checking printer status:', error);
      }
    };

    checkPrinter();
  }, []);

  // Mostrar diálogo de confirmación
  const showConfirmDialog = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'danger' | 'info' = 'warning') => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
      type
    });
  };

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount);
  };

  // Calcular totales (mejorado para manejar correctamente productos exentos)
  const calculateTotals = useMemo(() => {
    // Subtotal sin impuestos
    let subtotalWithoutTax = 0;
    // Total de ITBIS
    let taxAmount = 0;

    // Iterar por cada item en el carrito
    cart.forEach(item => {
      if (item.is_exempt) {
        // Si está exento, el precio es el precio final sin ITBIS
        subtotalWithoutTax += item.price * item.quantity;
      } else {
        // Si no está exento, calculamos el precio sin ITBIS y el ITBIS
        const itemBasePrice = item.price_without_tax;
        const itemTax = item.price - itemBasePrice;

        // Añadir al subtotal y al impuesto total
        subtotalWithoutTax += itemBasePrice * item.quantity;
        taxAmount += itemTax * item.quantity;
      }
    });

    // El subtotal con impuestos es la suma del subtotal sin impuestos más los impuestos
    const subtotalWithTax = subtotalWithoutTax + taxAmount;

    // El descuento se aplica al monto total
    const finalTotal = subtotalWithTax - discount;

    return { 
      subtotalWithTax,
      subtotalWithoutTax,
      taxAmount,
      total: finalTotal
    };
  }, [cart, discount]);

  const { subtotalWithTax, subtotalWithoutTax, taxAmount, total } = calculateTotals;

  // Función para calcular el cambio
  const calculateChange = useMemo(() => {
    if (paymentMethod !== 'Efectivo' || amountReceived <= 0) {
      return 0;
    }
    return amountReceived - total;
  }, [amountReceived, total, paymentMethod]);

  // Filtrar productos según búsqueda y categoría
  const filteredProducts = useMemo(() => {
    if (loadingProducts) return [];

    return products.filter(product => {
      const matchesSearch = searchTerm 
        ? product.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (product.codigo_barra && product.codigo_barra.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;

      const matchesCategory = categoryFilter === 'all' || product.categoria === categoryFilter;

      return matchesSearch && matchesCategory && (product.stock > 0);
    });
  }, [products, searchTerm, categoryFilter, loadingProducts]);

  // Añadir producto al carrito (mejorado para cálculos de ITBIS)
  const addToCart = (product: Product) => {
    const existingItemIndex = cart.findIndex(item => item.product_id === product.id);

    // Verificar si el producto está exento de ITBIS
    const isExempt = product.itebis === 0;

    // Calcular el precio sin ITBIS
    const priceWithoutTax = isExempt 
      ? product.precio_venta 
      : product.precio_venta / (1 + product.itebis);

    // Calcular precio con ITBIS ya incluido (para productos no exentos)
    const priceWithTax = product.precio_venta;

    if (existingItemIndex >= 0) {
      // Si ya existe, incrementar cantidad
      const updatedCart = [...cart];
      const item = updatedCart[existingItemIndex];
      item.quantity += 1;

      // Recalcular subtotal basado en la nueva cantidad
      item.subtotal = item.quantity * item.price;
      setCart(updatedCart);
    } else {
      // Si no existe, añadir nuevo item
      setCart([...cart, {
        product_id: product.id!,
        name: product.nombre,
        price: priceWithTax, // Precio que incluye ITBIS si aplica
        price_without_tax: priceWithoutTax, // Precio sin ITBIS
        quantity: 1,
        subtotal: priceWithTax, // Subtotal inicial = precio con ITBIS incluido
        itebis: product.itebis, // Tasa de ITBIS del producto
        is_exempt: isExempt, // Indicador de exención
        discount: 0
      }]);
    }
  };

  // Manejar el escaneo de códigos de barras
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!barcodeInput.trim()) return;

    // Asegurarse de que código de barras se maneje como string
    const product = products.find(p => p.codigo_barra === barcodeInput.trim());

    if (product) {
      addToCart(product);
      setBarcodeInput('');
    } else {
      setAlert({
        type: 'warning', 
        message: `No existe un producto con el código ${barcodeInput}`
      });
      setBarcodeInput(''); 
    }
  };

  // Eliminar producto del carrito
  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  // Actualizar cantidad de producto en carrito
  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;

    const updatedCart = [...cart];
    const item = updatedCart[index];

    // Verificar stock disponible
    const product = products.find(p => p.id === item.product_id);

    if (product && newQuantity > product.stock) {
      setAlert({
        type: 'warning',
        message: `Solo hay ${product.stock} unidades disponibles de ${product.nombre}`
      });
      newQuantity = product.stock;
    }

    item.quantity = newQuantity;
    item.subtotal = newQuantity * item.price;
    setCart(updatedCart);
  };

  // Limpiar carrito
  const clearCart = () => {
    if (cart.length === 0) return;

    showConfirmDialog(
      'Limpiar carrito',
      '¿Estás seguro de que deseas eliminar todos los productos del carrito?',
      () => {
        setCart([]);
        setDiscount(0);
        setNotes('');
      },
      'warning'
    );
  };

  // Generar vista previa de la factura
  const generatePreview = () => {
    if (cart.length === 0) {
      setAlert({ type: 'warning', message: 'El carrito está vacío' });
      return;
    }

    // Buscar el nombre del cliente seleccionado
    const customer = customers.find(c => c.id === selectedCustomer);
    const customerName = customer ? customer.nombre : 'Cliente General';

    // Crear objeto de vista previa
    const preview: PreviewSale = {
      cliente_id: selectedCustomer,
      cliente: customerName,
      total: total,
      descuento: discount,
      impuestos: taxAmount,
      metodo_pago: paymentMethod,
      estado: 'Pendiente',
      notas: notes || undefined,
      fecha_venta: new Date().toISOString(),
      usuario_id: user?.id,
      usuario: user?.nombre || 'Usuario',
      monto_recibido: amountReceived,
      cambio: calculateChange,
      detalles: cart.map(item => ({...item}))
    };

    setPreviewSale(preview);
    setPreviewMode(true);
  };

  // Procesar venta
  const processSale = async () => {
    if (cart.length === 0) {
      setAlert({ type: 'warning', message: 'El carrito está vacío' });
      return;
    }

    showConfirmDialog(
      'Confirmar venta',
      '¿Estás seguro de procesar esta venta?',
      async () => {
        try {
          setIsSubmitting(true);

          // Validar datos del carrito
          if (!cart.every(item => item.product_id && item.quantity > 0)) {
            throw new Error('Hay productos con datos inválidos en el carrito');
          }

          // Preparar detalles de la venta
          const saleDetails: SaleDetail[] = cart.map(item => ({
            producto_id: item.product_id,
            cantidad: item.quantity,
            precio_unitario: item.price,
            descuento: item.discount || 0,
            itebis: item.itebis,
            subtotal: item.subtotal
          }));

          // Validar el método de pago
          const validPaymentMethod = 
            (paymentMethod === 'Efectivo' || paymentMethod === 'Tarjeta' || paymentMethod === 'Transferencia') 
              ? paymentMethod 
              : 'Efectivo';

          // Objeto de venta con todos los datos necesarios
          const sale: Sale = {
            cliente_id: selectedCustomer,
            total: total,
            descuento: discount,
            impuestos: taxAmount,
            metodo_pago: validPaymentMethod,
            estado: 'Completada',
            notas: notes || undefined,
            usuario_id: user?.id,
            monto_recibido: paymentMethod === 'Efectivo' ? amountReceived : total,
            cambio: paymentMethod === 'Efectivo' ? calculateChange : 0,
            detalles: saleDetails // Incluir los detalles en el objeto sale
          };

          console.log('Enviando datos de venta:', JSON.stringify(sale));

          // Procesar la venta en la base de datos
          let result;

          try {
            if (window.api?.createSale) {
              // Pasamos el objeto sale completo que ya incluye los detalles
              result = await window.api.createSale(sale) as SaleResponse;
              console.log('Venta procesada con window.api.createSale:', result);
            } else {
              throw new Error('API de ventas no disponible');
            }
          } catch (error) {
            console.error('Error en API de ventas:', error);
            throw new Error(`Error al procesar venta: ${error instanceof Error ? error.message : 'Error desconocido'}`);
          }

          if (!result) {
            throw new Error('No se recibió respuesta al crear la venta');
          }

          // Log the full result for debugging
          console.log('Resultado completo de crear venta:', result);

          // Check for success and ID - con aserción de tipo
          if (!result.success) {
            throw new Error(result.error || 'Error desconocido al crear la venta');
          }

          if (!result.id) {
            throw new Error('No se recibió ID de la venta');
          }

          // Sale was successful - update UI with cleaner alert message
          let successMessage = 'Venta procesada con éxito';
          if (result.warnings && Array.isArray(result.warnings) && result.warnings.length > 0) {
            successMessage = 'Venta procesada con advertencias: ' + result.warnings[0];
          }

          setAlert({ 
            type: 'success', 
            message: successMessage
          });

          // Build preview sale object with complete information
          const previewSale: PreviewSale = {
            id: result.id,
            cliente_id: selectedCustomer,
            cliente: selectedCustomerName,
            total: total,
            descuento: discount,
            impuestos: taxAmount,
            metodo_pago: validPaymentMethod,
            estado: 'Completada',
            notas: notes || undefined,
            fecha_venta: new Date().toISOString(),
            usuario_id: user?.id,
            usuario: user?.nombre || 'Usuario',
            monto_recibido: paymentMethod === 'Efectivo' ? amountReceived : total,
            cambio: paymentMethod === 'Efectivo' ? calculateChange : 0,
            detalles: cart.map(item => ({...item}))
          };

          setPreviewSale(previewSale);
          setPreviewMode(true);

          // Broadcast that a sale was created
          broadcastSyncEvent('sale:create', {
            saleId: result.id,
            products: cart.map(item => ({
              id: item.product_id,
              quantity: item.quantity
            }))
          });

          // Print receipt if enabled
          if (printAfterSale && previewSale) {
            try {
              const thermalService = ThermalPrintService.getInstance();
              const printResult = await thermalService.printReceipt(previewSale);
              if (!printResult.success) {
                console.warn('Advertencia al imprimir:', printResult.message);
              }
            } catch (printError) {
              console.error('Error al imprimir:', printError);
            }
          }

          // Refresh products data after sale to get updated stock levels
          try {
            setTimeout(() => {
              fetchProducts();
            }, 1500);
          } catch (refreshError) {
            console.warn('Error al actualizar productos:', refreshError);
          }

          // Clear cart after successful sale
          setCart([]);
          setDiscount(0);
          setNotes('');
          setAmountReceived(0);
        } catch (error) {
          console.error('Error al procesar venta:', error);
          setAlert({ 
            type: 'error', 
            message: `Error al procesar la venta: ${error instanceof Error ? error.message : 'Error desconocido'}`
          });
        } finally {
          setIsSubmitting(false);
        }
      },
      'info'
    );
  };

  // Regresar al home
  const handleGoBack = () => {
    if (previewMode) {
      setPreviewMode(false);
      return;
    }

    if (cart.length > 0) {
      showConfirmDialog(
        'Salir del módulo de caja',
        '¿Estás seguro? Perderás la venta actual',
        () => {
          const event = new CustomEvent('componentChange', {
            detail: { component: 'Home' }
          });
          window.dispatchEvent(event);
        },
        'warning'
      );
    } else {
      const event = new CustomEvent('componentChange', {
        detail: { component: 'Home' }
      });
      window.dispatchEvent(event);
    }
  };

  // Abrir carpeta de facturas
  const handleOpenPdfFolder = async () => {
    try {
      if (!settings?.ruta_pdf) {
        setAlert({ type: 'warning', message: 'No hay una ruta configurada para las facturas' });
        return;
      }

      // En sistemas con electron, podemos abrir directamente la carpeta
      if (window.api?.getAppPaths) {
        const paths = await window.api.getAppPaths();
        // Aquí se debería implementar una función para abrir la carpeta
        // Esto normalmente se hace en el proceso principal de Electron
        console.log('Abriendo carpeta:', settings.ruta_pdf);

        // Esta es una solución alternativa ya que no hay una función directa en la API
        // Se podría implementar una función específica en el preload.cjs
        setAlert({ type: 'info', message: `Ruta de facturas: ${settings.ruta_pdf}` });
      }
    } catch (error) {
      console.error('Error al abrir carpeta:', error);
      setAlert({ type: 'error', message: 'No se pudo abrir la carpeta de facturas' });
    }
  };

  // Manejo de impresión manual simplificado
  async function handlePrint() {
    if (!previewSale) {
      if (cart.length > 0) {
        const customer = customers.find(c => c.id === selectedCustomer);
        const customerName = customer ? customer.nombre : 'Cliente General';
        const tempPreview: PreviewSale = {
          cliente_id: selectedCustomer,
          cliente: customerName,
          total, descuento: discount, impuestos: taxAmount,
          metodo_pago: paymentMethod, estado: 'Pendiente',
          fecha_venta: new Date().toISOString(),
          usuario_id: user?.id, usuario: user?.nombre || 'Usuario',
          monto_recibido: amountReceived, cambio: calculateChange,
          detalles: cart.map(item => ({ ...item }))
        };
        setIsSubmitting(true);
        try {
          const thermalService = ThermalPrintService.getInstance();
          const result = await thermalService.printReceipt(tempPreview);
          if (result.success) {
            setAlert({ type: 'success', message: 'Borrador de recibo enviado a la impresora' });
          } else {
            throw new Error(result.message || 'Error al imprimir');
          }
        } catch (err) {
          setAlert({
            type: 'error',
            message: `Error de impresión: ${err instanceof Error ? err.message : String(err)}`
          });
          console.error('Print error:', err);
        } finally {
          setIsSubmitting(false);
        }
      } else {
        setAlert({
          type: 'error',
          message: 'No hay recibo para imprimir. Agregue productos al carrito primero.'
        });
      }
      return;
    }

    // Imprimir si hay una venta previsualizada
    setIsSubmitting(true);
    try {
      const thermalService = ThermalPrintService.getInstance();
      const result = await thermalService.printReceipt(previewSale);
      if (result.success) {
        setAlert({ type: 'success', message: 'Recibo enviado a la impresora térmica' });
      } else {
        throw new Error(result.message || 'Error al imprimir');
      }
    } catch (err) {
      setAlert({
        type: 'error',
        message: `Error de impresión: ${err instanceof Error ? err.message : String(err)}`
      });
      console.error('Print error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Seleccionar cliente y guardar su nombre
  useEffect(() => {
    if (customers.length > 0) {
      const customer = customers.find(c => c.id === selectedCustomer);
      if (customer) {
        setSelectedCustomerName(customer.nombre);
      } else {
        setSelectedCustomerName('Cliente General');
      }
    }
  }, [selectedCustomer, customers]);

  // Resetea el monto recibido cuando cambia el método de pago
  useEffect(() => {
    if (paymentMethod === 'Efectivo') {
      setAmountReceived(total); // Solo establece inicialmente
    } else {
      setAmountReceived(0);
    }
  }, [paymentMethod, total]);

  // Componente de Alerta
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

  // Efecto para cerrar la alerta después de un tiempo
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Si estamos en modo vista previa, mostramos la factura
  if (previewMode && previewSale) {
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
              <ShoppingCart className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-800">Vista Previa de Factura</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
              onClick={handlePrint}
              disabled={isSubmitting}
            >
              <Printer className="h-4 w-4" />
              <span>{isSubmitting ? 'Imprimiendo...' : 'Imprimir'}</span>
            </button>
            {settings.ruta_pdf && (
              <button 
                className="py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
                onClick={handleOpenPdfFolder}
              >
                <Folder className="h-4 w-4" />
                <span>Ver Carpeta</span>
              </button>
            )}
            {previewSale.estado === 'Pendiente' && (
              <button 
                className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                onClick={processSale}
              >
                <Check className="h-4 w-4" />
                <span>Confirmar Venta</span>
              </button>
            )}
          </div>
        </header>

        {/* Contenido principal - Factura */}
        <main className="flex-1 px-6 pb-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-sm" ref={facturaRef}>
              <FacturaViewer ventaData={previewSale} />
            </div>
          </div>
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
  }

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
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Punto de Venta</h1>
          </div>
          
          {/* Printer status indicator */}
          <div className={`ml-4 flex items-center gap-2 py-1 px-3 rounded-full text-sm
            ${printerStatus.available 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
            <Printer className="h-3 w-3" />
            <span className="hidden sm:inline">
              {printerStatus.available 
                ? `Impresora: ${printerStatus.printerName || 'Térmica'}` 
                : 'No hay impresora térmica'}
            </span>
          </div>
          
          {/* Refresh printer status button */}
          <button 
            onClick={checkThermalPrinter}
            className="ml-1 p-1 rounded text-gray-500 hover:bg-gray-100"
            title="Actualizar estado de impresora"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 pb-8">
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Panel de carrito (lado izquierdo en pantallas grandes) */}
          <div className="xl:w-2/5 bg-white rounded-md shadow-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-medium text-gray-800">Carrito de Compra</h2>
              <div className="flex gap-2">
                <button
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className={`p-2 rounded-lg text-red-600 hover:bg-red-50 ${cart.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Selector de cliente */}
              <div className="flex gap-2">
                <select 
                  className="w-full p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(parseInt(e.target.value))}
                >
                  {loadingCustomers ? (
                    <option value="1">Cargando clientes...</option>
                  ) : (
                    customers.map(customer => (
                      <option key={customer.id} value={customer.id || 1}>
                        {customer.nombre}
                      </option>
                    ))
                  )}
                </select>
                <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                  <User className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* Búsqueda por código de barras */}
              <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Escanear código de barras"
                    className="w-full pl-9 p-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Añadir
                </button>
              </form>

              {/* Lista de productos en carrito */}
              <div className="shadow-md rounded-md overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4">
                      <ShoppingCart className="h-16 w-16 text-gray-300 mb-4" />
                      <p className="text-gray-500 text-center">El carrito está vacío</p>
                      <p className="text-gray-400 text-sm text-center mt-2">Añada productos escaneando o seleccionando desde la lista</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {cart.map((item, index) => (
                        <div key={index} className="p-3 hover:bg-gray-50">
                          <div className="flex justify-between">
                            <div>
                              <span className="font-medium">{item.name}</span>
                            </div>
                            <button 
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              onClick={() => removeFromCart(index)}
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              <button 
                                className="w-7 h-7 flex items-center justify-center border rounded-full hover:bg-gray-100 transition-colors"
                                onClick={() => updateQuantity(index, item.quantity - 1)}
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <input 
                                type="number" 
                                value={item.quantity}
                                onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                                className="w-14 p-1 text-center border rounded focus:outline-none focus:ring-2 focus:ring-blue-200"
                                min="1"
                              />
                              <button 
                                className="w-7 h-7 flex items-center justify-center border rounded-full hover:bg-gray-100 transition-colors"
                                onClick={() => updateQuantity(index, item.quantity + 1)}
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="text-right">
                              <div className="text-gray-500 text-sm">{formatCurrency(item.price)} c/u</div>
                              <div className="font-medium">{formatCurrency(item.subtotal)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Totales y opciones de pago */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(subtotalWithoutTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ITBIS:</span>
                  <span className="font-medium">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Descuento:</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      className="w-24 p-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-200" 
                      placeholder="0.00"
                      min="0"
                      max={subtotalWithTax} 
                      value={discount}
                      onChange={(e) => {
                        const newDiscount = parseFloat(e.target.value) || 0;
                        setDiscount(Math.min(newDiscount, subtotalWithTax));
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-lg font-bold pt-3 border-t">
                  <span>Total:</span>
                  <span>{formatCurrency(total)}</span>
                </div>

                {/* Método de pago */}
                <div className="pt-3">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Método de pago:</h3>
                  <div className="flex gap-2">
                    <button
                      className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors ${paymentMethod === 'Efectivo' ? 'bg-blue-100 text-blue-700 border-blue-300 border' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                      onClick={() => setPaymentMethod('Efectivo')}
                    >
                      <Wallet className="h-4 w-4" />
                      <span>Efectivo</span>
                    </button>
                    <button
                      className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors ${paymentMethod === 'Tarjeta' ? 'bg-blue-100 text-blue-700 border-blue-300 border' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                      onClick={() => setPaymentMethod('Tarjeta')}
                    >
                      <CreditCard className="h-4 w-4" />
                      <span>Tarjeta</span>
                    </button>
                    <button
                      className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1 transition-colors ${paymentMethod === 'Transferencia' ? 'bg-blue-100 text-blue-700 border-blue-300 border' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                      onClick={() => setPaymentMethod('Transferencia')}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span>Trans.</span>
                    </button>
                  </div>
                </div>

                {/* Monto recibido y cambio (solo para pagos en efectivo) */}
                {paymentMethod === 'Efectivo' && (
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <label htmlFor="amountReceived" className="text-sm font-medium text-gray-700">
                        Monto Recibido:
                      </label>
                      <input
                        id="amountReceived"
                        type="number"
                        step="0.01"
                        className="w-28 p-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Cambio:</span>
                      <span className={`font-bold text-lg ${calculateChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(calculateChange)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Notas */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Notas (opcional):
                  </label>
                  <textarea
                    id="notes"
                    rows={2}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  ></textarea>
                </div>

                {/* Auto-print option */}
                <div className="flex items-center justify-between">
                  <label htmlFor="autoPrint" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Printer className="h-4 w-4 text-gray-500" />
                    <span>Imprimir automáticamente</span>
                  </label>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      id="autoPrint"
                      className="sr-only"
                      checked={printAfterSale}
                      onChange={() => setPrintAfterSale(!printAfterSale)}
                    />
                    <div className={`block w-10 h-6 rounded-full ${printAfterSale ? 'bg-blue-600' : 'bg-gray-300'} transition`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${printAfterSale ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Botón de vista previa */}
                  <button 
                    className="py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={generatePreview}
                    disabled={cart.length === 0}
                  >
                    <Eye className="h-5 w-5" />
                    <span>Vista Previa</span>
                  </button>

                  {/* Botón de procesar */}
                  <button 
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={processSale}
                    disabled={cart.length === 0}
                  >
                    <DollarSign className="h-5 w-5" />
                    <span>Procesar Venta</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Panel de productos (lado derecho en pantallas grandes) */}
          <div className="xl:w-3/5 flex flex-col gap-4">
            {/* Búsqueda y filtros */}
            <div className="bg-white p-4 rounded-xl shadow-md">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    className="w-full p-2 pl-9 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500" 
                    placeholder="Buscar producto" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select 
                  className="sm:w-48 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">Todas las categorías</option>
                  {loadingCategories ? (
                    <option disabled>Cargando...</option>
                  ) : (
                    categories.map((category) => (
                      <option key={category.id} value={category.nombre}>
                        {category.nombre}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Lista de productos */}
            <div className="bg-white p-4 rounded-xl shadow-md flex-1">
              {loadingProducts ? (
                <div className="flex justify-center items-center p-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                  <p className="text-gray-500">Cargando productos...</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Package className="h-16 w-16 text-gray-300 mb-4" />
                  <p className="text-gray-500 text-center">No se encontraron productos</p>
                  <p className="text-gray-400 text-sm text-center mt-2">Intente con otra búsqueda o categoría</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                  {filteredProducts.map((product) => (
                    <div 
                      key={product.id}
                      className="shadow-md rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative"
                      onClick={() => addToCart(product)}
                    >
                      <div className="h-28 bg-gray-50 flex items-center justify-center">
                        {product.imagen ? (
                          <img src={product.imagen} alt={product.nombre} className="max-h-full" />
                        ) : (
                          <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                            {product.nombre.charAt(0)}
                          </div>
                        )}
                      </div>

                      {/* Indicador de stock bajo - usando stock_minimo */}
                      {product.stock > 0 && product.stock_minimo && product.stock < product.stock_minimo && (
                        <Badge variant="destructive" className="absolute right-1 top-1 rounded-lg text-xs font-medium">
                          Stock: {product.stock}
                        </Badge>
                      )}

                      {/* Indicador de sin stock */}
                      {product.stock <= 0 && (
                        <Badge variant="destructive" className="absolute right-1 top-1 rounded-lg text-xs font-medium">
                          Sin stock
                        </Badge>
                      )}

                      {/* Categoría con manejo de texto largo */}
                      <Badge 
                        variant="outline" 
                        className="absolute left-1 top-1 text-xs rounded-lg bg-blue-50 text-blue-700 border-blue-200 max-w-[calc(100%-45px)] overflow-hidden"
                      >
                        <span className="block truncate" title={product.categoria || "Sin categoría"}>
                          {product.categoria || "Sin categoría"}
                        </span>
                      </Badge>
                      
                      <div className="p-3">
                        <h3 className="font-medium text-gray-800 truncate" title={product.nombre}>
                          {product.nombre}
                        </h3>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-blue-600 font-medium">{formatCurrency(product.precio_venta)}</span>
                          <span className="text-xs text-gray-500">Stock: {product.stock}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
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

export default Caja;