// src/pages/Caja.tsx - Actualizado con hook unificado usePrinter
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShoppingCart, Search, Package, DollarSign, User,
  Trash2, Plus, Minus, X, CreditCard, Wallet, ChevronLeft,
  Check, AlertTriangle, AlertCircle, Printer, ArrowLeft,
  Eye, Folder, RotateCcw, Info, Barcode, QrCode, FileText,
  Settings
} from 'lucide-react';
import { useProducts, useCategories, useCustomers, useSales, useSettings, Product } from '../services/DatabaseService';
import { useAuth } from '../services/AuthContext';
import { usePrinter } from '../hooks/usePrinter'; // Hook unificado
import ConfirmDialog from '../components/ConfirmDialog';
import FacturaViewer from '../components/FacturaViewer';
import Badge from '../components/Badge';
import { Sale, SaleDetail, SaleResponse, PreviewSale } from '../types/sales';
import { useOptimizedCartSync, useOptimizedProductSync } from '../hooks/useOptimizedSync';
import { broadcastSyncEvent, useSyncListener } from '../services/SyncService';
import SmoothUpdateIndicator from '../components/SmoothUpdateIndicator';

// Tipos
type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia';
type PrintType = 'factura' | 'etiqueta' | 'barcode' | 'qr';

interface Alert {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  timestamp: number;
}

interface CartItem {
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

interface PrintOptions {
  type: PrintType;
  printerName?: string;
  data?: any;
  openDrawer?: boolean;
  copies?: number;
}

const Caja: React.FC = () => {
  const { user } = useAuth();
  const { products, loading: loadingProducts, fetchProducts } = useProducts();
  const { categories, loading: loadingCategories } = useCategories();
  const { customers, loading: loadingCustomers } = useCustomers();
  const { createSale } = useSales();
  const { settings } = useSettings();

  // Estados locales
  const [cart, setCart] = useState<CartItem[]>([]);
  const [localProducts, setLocalProducts] = useState(products);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<number>(1);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('Cliente General');
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [notes, setNotes] = useState<string>('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [previewSale, setPreviewSale] = useState<PreviewSale | null>(null);
  const [printAfterSale, setPrintAfterSale] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Estados de impresión
  const [printDialogOpen, setPrintDialogOpen] = useState<boolean>(false);
  const [selectedPrintType, setSelectedPrintType] = useState<PrintType>('factura');
  const [customPrintData, setCustomPrintData] = useState({
    barcodeValue: '',
    qrValue: '',
    etiquetaData: {}
  });

  // Referencia para vista previa
  const facturaRef = useRef<HTMLDivElement>(null);

  // Estado para confirmación
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning' as 'warning' | 'danger' | 'info'
  });

  // Mostrar alerta - DEBE estar definida antes de los hooks que la usan
  const showAlert = (alert: { type: 'success' | 'warning' | 'error' | 'info'; message: string }) => {
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const newAlert: Alert = {
      id: uniqueId,
      type: alert.type,
      message: alert.message,
      timestamp: Date.now()
    };

    setAlerts(prev => [...prev, newAlert]);

    setTimeout(() => {
      setAlerts(prev => prev.filter(alert => alert.id !== newAlert.id));
    }, 5000);
  };

  // Hooks de sincronización optimizada
  useOptimizedCartSync(cart, setCart, showAlert);
  useOptimizedProductSync(localProducts, setLocalProducts);

  // Listener específico para productos nuevos creados desde inventario
  useSyncListener(['product:created', 'product:create'], (syncEvent) => {
    if (syncEvent.data?.product) {
      const newProduct = syncEvent.data.product;
      console.log('➕ New product received in cash register:', newProduct.nombre);
      
      // Verificar si el producto ya existe antes de agregarlo
      setLocalProducts(prev => {
        const exists = prev.some(product => product.id === newProduct.id);
        if (!exists) {
          console.log('✅ Adding new product to cash register list');
          return [
            ...prev,
            {
              ...newProduct,
              _isNew: true,
              _isUpdated: true,
              _updateTimestamp: Date.now()
            }
          ];
        } else {
          console.log('⚠️ Product already exists in cash register');
          return prev;
        }
      });

      // Limpiar flags después de un momento
      setTimeout(() => {
        setLocalProducts(current => current.map(p => 
          p.id === newProduct.id 
            ? { ...p, _isNew: false, _isUpdated: false }
            : p
        ));
      }, 3000);
    }
  });

  // Sincronizar productos locales cuando cambien desde el hook de database
  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  // Hook de impresión unificado
  const {
    printers,
    loading: printersLoading,
    error: printerError,
    printInvoice,
    printLabel,
    printBarcode,
    printQR,
    testPrinter,
    openCashDrawer,
    refreshPrinters,
    clearError: clearPrinterError,
    isReady: printerReady
  } = usePrinter();

  // Cargar impresoras al inicializar
  useEffect(() => {
    if (!printersLoading && printers.length === 0) {
      refreshPrinters();
    }
  }, [printersLoading, printers.length, refreshPrinters]);

  // La sincronización del carrito se maneja automáticamente con useOptimizedCartSync

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount);
  };

  // Calcular totales
  const calculateTotals = useMemo(() => {
    let subtotalWithoutTax = 0;
    let taxAmount = 0;

    cart.forEach(item => {
      if (item.is_exempt) {
        subtotalWithoutTax += item.price * item.quantity;
      } else {
        const itemBasePrice = item.price_without_tax;
        const itemTax = item.price - itemBasePrice;
        subtotalWithoutTax += itemBasePrice * item.quantity;
        taxAmount += itemTax * item.quantity;
      }
    });

    const subtotalWithTax = subtotalWithoutTax + taxAmount;
    const finalTotal = subtotalWithTax - discount;

    return {
      subtotalWithTax,
      subtotalWithoutTax,
      taxAmount,
      total: finalTotal
    };
  }, [cart, discount]);

  const { subtotalWithTax, subtotalWithoutTax, taxAmount, total } = calculateTotals;

  // Calcular cambio
  const calculateChange = useMemo(() => {
    if (paymentMethod !== 'Efectivo' || amountReceived <= 0) {
      return 0;
    }
    return amountReceived - total;
  }, [amountReceived, total, paymentMethod]);

  // Filtrar productos
  const filteredProducts = useMemo(() => {
    if (loadingProducts) return [];

    return localProducts.filter(product => {
      const matchesSearch = searchTerm
        ? product.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.codigo_barra && product.codigo_barra.toLowerCase().includes(searchTerm.toLowerCase()))
        : true;

      const matchesCategory = categoryFilter === 'all' || product.categoria === categoryFilter;

      return matchesSearch && matchesCategory && (product.stock > 0);
    });
  }, [localProducts, searchTerm, categoryFilter, loadingProducts]);

  // Añadir producto al carrito
  const addToCart = (product: Product) => {
    const existingItemIndex = cart.findIndex(item => item.product_id === product.id);

    const isExempt = product.itebis === 0;
    const priceWithoutTax = isExempt
      ? product.precio_venta
      : product.precio_venta / (1 + product.itebis);
    const priceWithTax = product.precio_venta;

    if (existingItemIndex >= 0) {
      const updatedCart = [...cart];
      const item = updatedCart[existingItemIndex];
      item.quantity += 1;
      item.subtotal = item.quantity * item.price;
      setCart(updatedCart);
    } else {
      setCart([...cart, {
        product_id: product.id!,
        name: product.nombre,
        price: priceWithTax,
        price_without_tax: priceWithoutTax,
        quantity: 1,
        subtotal: priceWithTax,
        itebis: product.itebis,
        is_exempt: isExempt,
        discount: 0
      }]);
    }
  };

  // Manejar búsqueda por código de barras
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!barcodeInput.trim()) return;

    const product = localProducts.find(p => p.codigo_barra === barcodeInput.trim());

    if (product) {
      addToCart(product);
      setBarcodeInput('');
    } else {
      showAlert({
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

  // Actualizar cantidad
  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;

    const updatedCart = [...cart];
    const item = updatedCart[index];

    const product = localProducts.find(p => p.id === item.product_id);

    if (product && newQuantity > product.stock) {
      showAlert({
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

  // Nueva venta - limpiar todo para empezar de cero
  const handleNewSale = () => {
    showConfirmDialog(
      'Nueva Venta',
      cart.length > 0 
        ? '¿Deseas empezar una nueva venta? Se perderá el carrito actual.'
        : '¿Deseas limpiar todo para empezar una nueva venta?',
      () => {
        setCart([]);
        setDiscount(0);
        setNotes('');
        setAmountReceived(0);
        setSelectedCustomer(1);
        setSelectedCustomerName('Cliente General');
        setPaymentMethod('Efectivo');
        setPreviewMode(false);
        setPreviewSale(null);
        setBarcodeInput('');
        setSearchTerm('');
        setCategoryFilter('all');
        showAlert({ 
          type: 'success', 
          message: 'Listo para nueva venta' 
        });
      },
      'info'
    );
  };

  // Probar impresora usando el hook
  const handleTestPrinter = async () => {
    if (!printerReady) {
      showAlert({ type: 'warning', message: 'Sistema de impresión no está listo' });
      return;
    }

    const printerName = settings?.impresora_termica;
    if (!printerName) {
      showAlert({ type: 'warning', message: 'No hay impresora configurada' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await testPrinter(printerName);
      
      if (result.success) {
        showAlert({ type: 'success', message: 'Prueba de impresora enviada correctamente' });
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (err) {
      console.error(err);
      showAlert({ type: 'error', message: `Error al probar impresora: ${(err as Error).message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generar vista previa
  const generatePreview = () => {
    if (cart.length === 0) {
      showAlert({ type: 'warning', message: 'El carrito está vacío' });
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomer);
    const customerName = customer ? customer.nombre : 'Cliente General';

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
      detalles: cart.map(item => ({ ...item }))
    };

    setPreviewSale(preview);
    setPreviewMode(true);
  };

  // Procesar venta
  const processSale = async () => {
    if (cart.length === 0) {
      showAlert({ type: 'warning', message: 'El carrito está vacío' });
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

          // Validar método de pago
          const validPaymentMethod =
            (paymentMethod === 'Efectivo' ||
              paymentMethod === 'Tarjeta' ||
              paymentMethod === 'Transferencia')
              ? paymentMethod
              : 'Efectivo';

          // Crear objeto de venta
          const sale: Sale = {
            cliente_id: selectedCustomer,
            total,
            descuento: discount,
            impuestos: taxAmount,
            metodo_pago: validPaymentMethod,
            estado: 'Completada',
            notas: notes || undefined,
            usuario_id: user?.id,
            monto_recibido:
              paymentMethod === 'Efectivo' ? amountReceived : total,
            cambio:
              paymentMethod === 'Efectivo' ? calculateChange : 0,
            detalles: saleDetails
          };

          console.log('Enviando datos de venta:', JSON.stringify(sale));

          // Procesar la venta
          let result: SaleResponse;
          if (window.api?.createSale) {
            result = (await window.api.createSale(sale)) as SaleResponse;
            console.log('Venta procesada:', result);
          } else {
            throw new Error('API de ventas no disponible');
          }

          if (!result.success) {
            throw new Error(result.error || 'Error al crear la venta');
          }
          if (!result.id) {
            throw new Error('No se recibió ID de la venta');
          }

          // Guardar estado previo
          const previousCart = [...cart];
          const previousDiscount = discount;
          const previousNotes = notes;

          // Limpiar carrito
          setCart([]);
          setDiscount(0);
          setNotes('');
          setAmountReceived(0);

          // Mensaje de éxito
          let successMessage = 'Venta procesada con éxito';
          if (result.warnings?.length) {
            successMessage = 'Venta procesada con advertencias: ' + result.warnings[0];
          }
          showAlert({ type: 'success', message: successMessage });

          // Crear preview de la venta
          const preview: PreviewSale = {
            id: result.id,
            cliente_id: selectedCustomer,
            cliente: selectedCustomerName,
            total,
            descuento: previousDiscount,
            impuestos: taxAmount,
            metodo_pago: validPaymentMethod,
            estado: 'Completada',
            notas: previousNotes,
            fecha_venta: new Date().toISOString(),
            usuario_id: user?.id,
            usuario: user?.nombre || 'Usuario',
            monto_recibido:
              paymentMethod === 'Efectivo' ? amountReceived : total,
            cambio:
              paymentMethod === 'Efectivo' ? calculateChange : 0,
            detalles: previousCart.map(item => ({ ...item }))
          };
          setPreviewSale(preview);
          setPreviewMode(true);

          // Sincronizar - enviar eventos de stock actualizado como lo hace inventario
          previousCart.forEach(item => {
            const productToUpdate = localProducts.find(p => p.id === item.product_id);
            if (productToUpdate) {
              const newStock = Math.max(0, (productToUpdate.stock || 0) - item.quantity);
              // Usar el mismo evento que usa el inventario para sincronización
              broadcastSyncEvent('inventory', {
                action: 'stock_updated',
                data: {
                  id: item.product_id,
                  product: { ...productToUpdate, stock: newStock }
                }
              });
            }
          });

          // También enviar evento de venta para otros propósitos
          broadcastSyncEvent('sale', {
            action: 'create',
            data: {
              saleId: result.id,
              products: previousCart.map(item => ({
                id: item.product_id,
                quantity: item.quantity
              }))
            }
          });

          // Imprimir si está habilitado usando el hook
          if (printAfterSale && printerReady) {
            try {
              const printResult = await printInvoice(preview);
              
              if (printResult.success) {
                showAlert({ type: 'success', message: 'Factura impresa correctamente' });
                
                // Abrir cajón si está configurado
                if (settings?.open_cash_drawer) {
                  await openCashDrawer();
                }
              } else {
                showAlert({ 
                  type: 'warning', 
                  message: `Venta exitosa, pero error al imprimir: ${printResult.error}` 
                });
              }
            } catch (error) {
              showAlert({ 
                type: 'warning', 
                message: 'Venta exitosa, pero error al imprimir factura' 
              });
            }
          }

          // Actualizar inventario
          setTimeout(() => fetchProducts(), 1000);
        } catch (error) {
          console.error('Error al procesar venta:', error);
          showAlert({
            type: 'error',
            message: `Error al procesar la venta: ${error instanceof Error ? error.message : 'Desconocido'}`
          });
        } finally {
          setIsSubmitting(false);
        }
      },
      'info'
    );
  };

  // Imprimir factura manualmente usando el hook
  const handlePrint = async () => {
    if (!previewSale) {
      showAlert({ type: 'warning', message: 'No hay factura para imprimir' });
      return;
    }

    if (!printerReady) {
      showAlert({ type: 'error', message: 'Sistema de impresión no está listo' });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await printInvoice(previewSale);
      
      if (result.success) {
        showAlert({ type: 'success', message: 'Factura impresa correctamente' });
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (err) {
      console.error(err);
      showAlert({ type: 'error', message: `Error al imprimir: ${(err as Error).message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar opciones de impresión avanzadas usando el hook
  const handleAdvancedPrint = () => {
    setPrintDialogOpen(true);
  };

  const handlePrintOption = async (type: PrintType, data?: any) => {
    setIsSubmitting(true);
    setPrintDialogOpen(false);

    try {
      let result;
      
      switch (type) {
        case 'factura':
          if (!previewSale) {
            throw new Error('No hay factura para imprimir');
          }
          result = await printInvoice(previewSale);
          break;
          
        case 'etiqueta':
          if (data?.product) {
            result = await printLabel({
              name: data.product.nombre,
              price: data.product.precio_venta,
              barcode: data.product.codigo_barra,
              category: data.product.categoria
            });
          } else {
            throw new Error('No hay producto seleccionado para la etiqueta');
          }
          break;
          
        case 'barcode':
          if (data?.value) {
            result = await printBarcode({
              text: data.value,
              name: `Producto ${data.value}`
            });
          } else {
            throw new Error('No hay valor para el código de barras');
          }
          break;
          
        case 'qr':
          if (data?.value) {
            result = await printQR({
              text: data.value,
              title: 'Código QR'
            });
          } else {
            throw new Error('No hay valor para el código QR');
          }
          break;
          
        default:
          throw new Error('Tipo de impresión no válido');
      }

      if (result.success) {
        showAlert({ type: 'success', message: `${type.charAt(0).toUpperCase() + type.slice(1)} impresa correctamente` });
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('Error en impresión avanzada:', error);
      showAlert({ type: 'error', message: `Error: ${(error as Error).message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir carpeta de PDFs
  const handleOpenPdfFolder = async () => {
    try {
      const pdfPath = settings?.ruta_pdf;
      if (!pdfPath) {
        showAlert({ type: 'warning', message: 'No hay ruta configurada para las facturas PDF' });
        return;
      }

      if (!window.api?.ensureDir || !window.api?.openFolder) {
        throw new Error("API no disponible");
      }

      // Asegurar que la carpeta existe
      const dirResult = await window.api.ensureDir(pdfPath);
      if (!dirResult.success) {
        throw new Error(`No se pudo crear la carpeta: ${dirResult.error}`);
      }

      // Abrir la carpeta
      await window.api.openFolder(pdfPath);
      showAlert({ type: 'success', message: 'Carpeta de facturas abierta correctamente' });
    } catch (error) {
      console.error('Error al abrir carpeta:', error);
      showAlert({
        type: 'error',
        message: `No se pudo abrir la carpeta: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
    }
  };

  // Regresar al home
  const handleGoBack = () => {
    if (previewMode) {
      if (previewSale?.estado === 'Completada') {
        // NO limpiar automáticamente - permitir al usuario continuar trabajando
        setPreviewMode(false);
        setPreviewSale(null);
        // Mensaje informativo para el usuario
        showAlert({ 
          type: 'info', 
          message: 'Venta completada. Puede continuar con una nueva venta.' 
        });
        return;
      }
      setPreviewMode(false);
      return;
    }

    if (cart.length > 0) {
      showConfirmDialog(
        'Salir del módulo de caja',
        '¿Estás seguro? Perderás la venta actual',
        () => {
          window.dispatchEvent(new CustomEvent('componentChange', {
            detail: { component: 'Home' }
          }));
        },
        'warning'
      );
    } else {
      window.dispatchEvent(new CustomEvent('componentChange', {
        detail: { component: 'Home' }
      }));
    }
  };

  // Actualizar cliente seleccionado
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

  // Resetear monto recibido cuando cambia el método de pago
  useEffect(() => {
    if (paymentMethod === 'Efectivo') {
      setAmountReceived(total);
    } else {
      setAmountReceived(0);
    }
  }, [paymentMethod, total]);

  // Manejar errores de impresora
  useEffect(() => {
    if (printerError) {
      showAlert({ type: 'error', message: printerError });
      clearPrinterError();
    }
  }, [printerError, clearPrinterError]);

  // Mostrar confirmación
  const showConfirmDialog = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'danger' | 'info' = 'warning') => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
      type
    });
  };

  // Componente de Alerta
  const Alert: React.FC<{
    alert: Alert;
    onDismiss: (id: string) => void
  }> = ({ alert, onDismiss }) => {
    const colors = {
      success: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', icon: Check },
      warning: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', icon: AlertTriangle },
      error: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', icon: X },
      info: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', icon: Info }
    };

    const style = colors[alert.type];
    const Icon = style.icon;

    return (
      <div className={`${style.bg} ${style.text} ${style.border} border p-4 rounded-lg flex items-start mb-4 shadow-md animate-fadeIn`}>
        <Icon className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
        <div className="flex-grow">{alert.message}</div>
        <button
          onClick={() => onDismiss(alert.id)}
          className="ml-2 flex-shrink-0 hover:bg-opacity-20 hover:bg-gray-500 p-1 rounded-full"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  // Componente de diálogo de impresión avanzada
  const PrintDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Opciones de Impresión</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3">
            {/* Imprimir factura */}
            {previewSale && (
              <button
                onClick={() => handlePrintOption('factura')}
                className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50"
                disabled={isSubmitting}
              >
                <FileText className="h-5 w-5 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium">Imprimir Factura</div>
                  <div className="text-sm text-gray-500">Factura completa</div>
                </div>
              </button>
            )}

            {/* Imprimir etiquetas de productos */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-3 mb-2">
                <Package className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium">Imprimir Etiquetas</div>
                  <div className="text-sm text-gray-500">Etiquetas de productos del carrito</div>
                </div>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {cart.map((item, index) => {
                  const product = localProducts.find(p => p.id === item.product_id);
                  if (!product) return null;
                  
                  return (
                    <button
                      key={index}
                      onClick={() => handlePrintOption('etiqueta', { product })}
                      className="w-full text-left p-2 text-sm rounded hover:bg-gray-50"
                      disabled={isSubmitting}
                    >
                      {item.name} - {formatCurrency(item.price)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Imprimir código de barras personalizado */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-3 mb-2">
                <Barcode className="h-5 w-5 text-orange-600" />
                <div>
                  <div className="font-medium">Código de Barras</div>
                  <div className="text-sm text-gray-500">Imprimir código personalizado</div>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ingrese código"
                  className="flex-1 p-2 border rounded text-sm"
                  value={customPrintData.barcodeValue}
                  onChange={(e) => setCustomPrintData(prev => ({ ...prev, barcodeValue: e.target.value }))}
                />
                <button
                  onClick={() => handlePrintOption('barcode', { value: customPrintData.barcodeValue })}
                  className="px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
                  disabled={isSubmitting || !customPrintData.barcodeValue.trim()}
                >
                  Imprimir
                </button>
              </div>
            </div>

            {/* Imprimir código QR personalizado */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center gap-3 mb-2">
                <QrCode className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="font-medium">Código QR</div>
                  <div className="text-sm text-gray-500">Imprimir QR personalizado</div>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ingrese texto o URL"
                  className="flex-1 p-2 border rounded text-sm"
                  value={customPrintData.qrValue}
                  onChange={(e) => setCustomPrintData(prev => ({ ...prev, qrValue: e.target.value }))}
                />
                <button
                  onClick={() => handlePrintOption('qr', { value: customPrintData.qrValue })}
                  className="px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                  disabled={isSubmitting || !customPrintData.qrValue.trim()}
                >
                  Imprimir
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Renderizado en modo vista previa
  if (previewMode && previewSale) {
    return (
      <div className="min-h-full bg-gray-50 flex flex-col">
        {/* Alertas */}
        {alerts.length > 0 && (
          <div className="fixed top-6 right-6 z-50 max-w-md w-full space-y-2">
            {alerts.map(alert => (
              <Alert
                key={alert.id}
                alert={alert}
                onDismiss={(id) => setAlerts(prev => prev.filter(alert => alert.id !== id))}
              />
            ))}
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
              disabled={isSubmitting || !printerReady}
            >
              <Printer className="h-4 w-4" />
              <span>{isSubmitting ? 'Imprimiendo...' : 'Imprimir Factura'}</span>
            </button>
            <button
              className="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
              onClick={handleAdvancedPrint}
              disabled={isSubmitting}
            >
              <Settings className="h-4 w-4" />
              <span>Más Opciones</span>
            </button>
            {settings?.guardar_pdf && settings?.ruta_pdf && (
              <button
                className="py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
                onClick={handleOpenPdfFolder}
              >
                <Folder className="h-4 w-4" />
                <span>Ver PDFs</span>
              </button>
            )}
            {previewSale.estado === 'Pendiente' && (
              <button
                className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                onClick={processSale}
                disabled={isSubmitting}
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

        {/* Diálogo de impresión avanzada */}
        <PrintDialog isOpen={printDialogOpen} onClose={() => setPrintDialogOpen(false)} />

        {/* Diálogo de confirmación */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          type={confirmDialog.type}
        />
      </div>
    );
  }

  // Renderizado principal
  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="fixed top-6 right-6 z-50 max-w-md w-full space-y-2">
          {alerts.map(alert => (
            <Alert
              key={alert.id}
              alert={alert}
              onDismiss={(id) => setAlerts(prev => prev.filter(alert => alert.id !== id))}
            />
          ))}
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

          {/* Indicador de estado de impresora */}
          <div className={`ml-4 flex items-center gap-2 py-1 px-3 rounded-full text-sm
            ${printerReady && printers.length > 0
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
            <Printer className="h-3 w-3" />
            <span className="hidden sm:inline">
              {printerReady && printers.length > 0
                ? `${printers.length} impresora${printers.length > 1 ? 's' : ''} disponible${printers.length > 1 ? 's' : ''}`
                : 'Impresoras no configuradas'}
            </span>
          </div>

          {/* Botón de prueba de impresora */}
          <button
            onClick={handleTestPrinter}
            className="ml-1 py-1 px-2 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"
            title="Probar impresora"
            disabled={isSubmitting || !printerReady}
          >
            <Printer className="h-3 w-3" />
            <span>Probar</span>
          </button>

          {/* Botón de recargar impresoras */}
          <button
            onClick={refreshPrinters}
            className="ml-1 py-1 px-2 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1"
            title="Actualizar impresoras"
            disabled={printersLoading}
          >
            <RotateCcw className={`h-3 w-3 ${printersLoading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 pb-8">
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Panel de carrito */}
          <div className="xl:w-2/5 bg-white rounded-md shadow-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-medium text-gray-800">Carrito de Compra</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleNewSale}
                  className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Nueva Venta - Limpiar todo"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
                <button
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className={`p-2 rounded-lg text-red-600 hover:bg-red-50 ${cart.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Limpiar Carrito"
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
                  <span className="text-gray-600">{settings?.impuesto_nombre || 'ITBIS'}:</span>
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

                {/* Opción de impresión automática */}
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
                  <button
                    className="py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={generatePreview}
                    disabled={cart.length === 0}
                  >
                    <Eye className="h-5 w-5" />
                    <span>Vista Previa</span>
                  </button>

                  <button
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={processSale}
                    disabled={cart.length === 0 || isSubmitting}
                  >
                    <DollarSign className="h-5 w-5" />
                    <span>{isSubmitting ? 'Procesando...' : 'Procesar Venta'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Panel de productos */}
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
                        className="shadow-md rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative group"
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

                      {/* Indicador de stock bajo */}
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

                      {/* Categoría */}
                      <Badge
                        variant="outline"
                        className="absolute left-1 top-1 text-xs rounded-lg bg-blue-50 text-blue-700 border-blue-200 max-w-[calc(100%-45px)] overflow-hidden"
                      >
                        <span className="block truncate" title={product.categoria || "Sin categoría"}>
                          {product.categoria || "Sin categoría"}
                        </span>
                      </Badge>

                      {/* Botón flotante para imprimir etiqueta */}
                      <button
                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 bg-green-600 hover:bg-green-700 text-white p-1.5 rounded-full transition-all duration-200 shadow-md"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintOption('etiqueta', { product });
                        }}
                        title="Imprimir etiqueta"
                      >
                        <Package className="h-3 w-3" />
                      </button>

                      <div className="p-3">
                        <h3 className="font-medium text-gray-800 truncate" title={product.nombre}>
                          {product.nombre}
                        </h3>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-blue-600 font-medium">{formatCurrency(product.precio_venta)}</span>
                          <span className="text-xs text-gray-500">Stock: {product.stock}</span>
                        </div>
                        {product.codigo_barra && (
                          <div className="text-xs text-gray-400 mt-1 truncate" title={product.codigo_barra}>
                            {product.codigo_barra}
                          </div>
                        )}
                      </div>
                      </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Diálogo de impresión avanzada */}
      <PrintDialog isOpen={printDialogOpen} onClose={() => setPrintDialogOpen(false)} />

      {/* Diálogo de confirmación */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
      />
    </div>
  );
};

export default Caja;