// src/pages/Factura.tsx - Improved invoice management component
import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, Download, ChevronLeft, Search, 
  Filter, RotateCcw, FileText,
  Eye, XCircle,
  AlertTriangle, X, Check, Folder
} from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { useSettings } from '../services/DatabaseService';
import FacturaViewer from '../components/FacturaViewer';
import ConfirmDialog from '../components/ConfirmDialog';
import InvoiceManager from '../services/InvoiceManager';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { PreviewSale } from '../types/sales';

// Tipos
type AlertType = 'success' | 'warning' | 'error' | 'info';

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

const Factura: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const invoiceManager = InvoiceManager.getInstance();
  const facturaRef = useRef<HTMLDivElement>(null);
  
  // Estado principal
  const [state, setState] = useState<FacturaState>({
    invoices: [],
    selectedInvoice: null,
    loading: true,
    error: null,
    searchId: '',
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)), // Último mes por defecto
    endDate: new Date(),
    previewMode: false,
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    filterStatus: 'all',
    filterPaymentMethod: 'all',
    isSearching: false
  });
  
  // Estado para alertas
  const [alert, setAlert] = useState<{ type: AlertType; message: string } | null>(null);
  
  // Estado para confirmación
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning' as 'warning' | 'danger' | 'info'
  });

  // Estado para manejo de envío
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar configuración cuando inicia el componente
  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (window.api?.getSettings) {
          const appSettings = await window.api.getSettings();
          console.log("Configuración cargada:", appSettings);
        }
      } catch (error) {
        console.error('Error al cargar configuración:', error);
      }
    };
    
    loadSettings();
  }, []);

  // Cargar facturas
  useEffect(() => {
    fetchInvoices();
  }, [
    state.currentPage, 
    state.itemsPerPage, 
    state.filterStatus, 
    state.filterPaymentMethod
  ]);

  // Función para cargar facturas con filtros
  const fetchInvoices = async () => {
    if (!window.api?.getSales) {
      setState(prev => ({ ...prev, error: 'API no disponible', loading: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      // Preparar filtros
      const filters = {
        startDate: state.startDate.toISOString(),
        endDate: state.endDate.toISOString(),
        page: state.currentPage,
        limit: state.itemsPerPage,
        status: state.filterStatus !== 'all' ? state.filterStatus : undefined,
        paymentMethod: state.filterPaymentMethod !== 'all' ? getPaymentMethodValue() : undefined
      };
      
      const result = await window.api.getSales(filters) as unknown as SalesResponse;
      
      if (result && Array.isArray(result.data)) {
        // Aseguramos que metodo_pago esté en el formato correcto
        const validatedInvoices = result.data.map(invoice => ({
          ...invoice,
          metodo_pago: validatePaymentMethod(invoice.metodo_pago)
        }));
        
        setState(prev => ({ 
          ...prev, 
          invoices: validatedInvoices, 
          totalItems: result.total || validatedInvoices.length,
          loading: false
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          invoices: [], 
          error: 'Formato de respuesta inválido', 
          loading: false
        }));
      }
    } catch (error) {
      console.error('Error al cargar facturas:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Error desconocido',
        loading: false
      }));
      showAlert('error', 'Error al cargar facturas');
    }
  };

  // Función para validar el método de pago y convertirlo al tipo esperado
  const validatePaymentMethod = (method: string | undefined | null): 'Efectivo' | 'Tarjeta' | 'Transferencia' => {
    if (!method) return 'Efectivo'; // Handle null/undefined values
    
    const validMethods = ['Efectivo', 'Tarjeta', 'Transferencia'];
    const normalizedMethod = method.trim(); // Remove whitespace
    
    if (validMethods.includes(normalizedMethod)) {
      return normalizedMethod as 'Efectivo' | 'Tarjeta' | 'Transferencia';
    }
    
    console.warn(`Método de pago inválido: "${method}", usando "Efectivo" por defecto`);
    return 'Efectivo';
  };

  // Función para buscar factura por ID
  const handleSearchById = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!state.searchId.trim()) {
      showAlert('warning', 'Ingrese un número de factura');
      return;
    }
    
    const id = parseInt(state.searchId);
    if (isNaN(id)) {
      showAlert('error', 'ID de factura inválido');
      return;
    }
    
    setState(prev => ({ ...prev, isSearching: true, loading: true }));
    
    try {
      if (!window.api?.getSaleDetails) {
        throw new Error('API no disponible');
      }
      
      const invoice = await window.api.getSaleDetails(id);
      
      if (invoice) {
        // Asegurar que el método de pago es uno de los valores esperados
        const validatedInvoice = {
          ...invoice,
          metodo_pago: validatePaymentMethod(invoice.metodo_pago)
        } as unknown as PreviewSale ;
        
        setState(prev => ({ 
          ...prev, 
          selectedInvoice: validatedInvoice,
          previewMode: true,
          loading: false,
          isSearching: false
        }));
      } else {
        setState(prev => ({ ...prev, loading: false, isSearching: false }));
        showAlert('warning', `No se encontró la factura #${id}`);
      }
    } catch (error) {
      console.error('Error al buscar factura:', error);
      setState(prev => ({ ...prev, loading: false, isSearching: false }));
      showAlert('error', 'Error al buscar la factura');
    }
  };

  // Función para buscar por fecha
  const handleDateSearch = () => {
    setState(prev => ({ ...prev, currentPage: 1 })); // Reset to page 1
    fetchInvoices();
  };

  // Función para resetear filtros
  const resetFilters = () => {
    setState(prev => ({
      ...prev,
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
      endDate: new Date(),
      filterStatus: 'all',
      filterPaymentMethod: 'all',
      currentPage: 1
    }));
  };

  // Obtener el valor correcto para el filtro de método de pago
  const getPaymentMethodValue = () => {
    switch (state.filterPaymentMethod) {
      case 'cash': return 'Efectivo';
      case 'card': return 'Tarjeta';
      case 'transfer': return 'Transferencia';
      default: return undefined;
    }
  };

  // Ver detalles de una factura
  const handleViewInvoice = async (id: number) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      if (!window.api?.getSaleDetails) {
        throw new Error('API no disponible');
      }
      
      const invoice = await window.api.getSaleDetails(id);
      
      if (invoice) {
        // Asegurar que el método de pago es uno de los valores esperados
        const validatedInvoice = {
          ...invoice,
          metodo_pago: validatePaymentMethod(invoice.metodo_pago)
        } as unknown as PreviewSale;
        
        setState(prev => ({ 
          ...prev, 
          selectedInvoice: validatedInvoice,
          previewMode: true,
          loading: false
        }));
      } else {
        setState(prev => ({ ...prev, loading: false }));
        showAlert('warning', `No se encontró la factura #${id}`);
      }
    } catch (error) {
      console.error('Error al cargar detalles de factura:', error);
      setState(prev => ({ ...prev, loading: false }));
      showAlert('error', 'Error al cargar detalles de la factura');
    }
  };

  // Exportar factura como PDF simplificado
  const handleExportPDF = async () => {
    if (!state.selectedInvoice) {
      showAlert('warning', 'No hay factura seleccionada para exportar');
      return;
    }

    try {
      if (!facturaRef.current) {
        throw new Error('Referencia de factura no disponible');
      }

      const htmlContent = facturaRef.current.outerHTML;
      const mgr = InvoiceManager.getInstance();
      const pdfPath = await mgr.saveAsPdf(
        state.selectedInvoice,
        htmlContent,
        {
          directory: settings?.ruta_pdf || '',
          filename: `factura-${state.selectedInvoice.id}-${new Date().toISOString().split('T')[0]}.pdf`
        }
      );

      if (pdfPath) {
        showAlert('success', `Factura guardada como PDF: ${pdfPath}`);
      } else {
        throw new Error('Error al guardar PDF');
      }
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      showAlert('error', 'Error al exportar la factura como PDF');
    }
  };

  // Imprimir factura
  const handlePrint = async () => {
    if (!state.selectedInvoice) {
      showAlert('warning', 'No hay factura seleccionada para imprimir');
      return;
    }
    try {
      if (!facturaRef.current) {
        throw new Error('Referencia de factura no disponible');
      }
      setIsSubmitting(true);
      const htmlContent = facturaRef.current.outerHTML;
      const mgr = InvoiceManager.getInstance();
      await mgr.printInvoice(
        state.selectedInvoice,
        htmlContent,
        { silent: true, copies: 1 }
      );
      showAlert('success', 'Factura impresa correctamente');
    } catch (error) {
      console.error('Error al imprimir factura:', error);
      showAlert('error', `Error al imprimir: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir carpeta de PDFs
  const handleOpenPdfFolder = async () => {
    try {
      const api = window.api;
      
      if (!settings?.ruta_pdf) {
        showAlert('warning', 'No hay una ruta configurada para las facturas');
        return;
      }

      if (!api) {
        throw new Error("API no disponible");
      }
      
      // Definir ruta de facturas
      const facturaPath = settings.ruta_pdf;

      // Asegurar que la carpeta existe antes de intentar abrirla
      if (api.ensureDir) {
        const dirResult = await api.ensureDir(facturaPath);
        if (!dirResult.success) {
          throw new Error(`No se pudo crear la carpeta: ${dirResult.error}`);
        }
      }

      // Abrir la carpeta
      if (api.openFolder) {
        await api.openFolder(facturaPath);
        showAlert('success', 'Carpeta de facturas abierta correctamente');
      } else {
        showAlert('info', `Ruta de facturas: ${facturaPath}`);
      }
    } catch (error) {
      console.error('Error al abrir carpeta:', error);
      showAlert('error', `No se pudo abrir la carpeta: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Volver a la lista de facturas
  const handleBackToList = () => {
    setState(prev => ({ 
      ...prev, 
      selectedInvoice: null,
      previewMode: false
    }));
  };

  // Volver al componente anterior
  const handleGoBack = () => {
    const event = new CustomEvent('componentChange', {
      detail: { component: 'Home' }
    });
    window.dispatchEvent(event);
  };

  // Mostrar alerta
  const showAlert = (type: AlertType, message: string) => {
    setAlert({ type, message });
    
    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
      setAlert(null);
    }, 5000);
  };

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

  // Anular factura
  const handleCancelInvoice = (id: number) => {
    showConfirmDialog(
      'Anular Factura',
      '¿Está seguro que desea anular esta factura? Esta acción no se puede deshacer.',
      async () => {
        try {
          if (!window.api?.cancelSale) {
            throw new Error('API no disponible');
          }
          
          const result = await window.api.cancelSale(id);
          
          if (result.success) {
            showAlert('success', 'Factura anulada correctamente');
            
            // Si estamos viendo la factura, actualizarla
            if (state.selectedInvoice && state.selectedInvoice.id === id) {
              handleViewInvoice(id);
            } else {
              // Sino, refrescar la lista
              fetchInvoices();
            }
          } else {
            throw new Error(result.error || 'Error al anular factura');
          }
        } catch (error) {
          console.error('Error al anular factura:', error);
          showAlert('error', 'Error al anular la factura');
        }
      },
      'danger'
    );
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-DO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Formatear moneda
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
      // Fallback formatting if Intl.NumberFormat fails
      console.warn('Error formatting currency:', error);
      return `${settings?.moneda || 'RD$'} ${amount.toFixed(2)}`;
    }
  };

  // Renderizar paginación
  const renderPagination = () => {
    const totalPages = Math.ceil(state.totalItems / state.itemsPerPage);
    
    return (
      <div className="flex items-center justify-between mt-4 border-t border-gray-200 pt-4">
        <div className="flex items-center text-sm text-gray-500">
          Mostrando {Math.min((state.currentPage - 1) * state.itemsPerPage + 1, state.totalItems)}-
          {Math.min(state.currentPage * state.itemsPerPage, state.totalItems)} de {state.totalItems} facturas
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setState(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
            disabled={state.currentPage === 1}
            className={`p-2 rounded-md ${state.currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Anterior
          </button>
          
          {/* Mostrar números de página */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            // Lógica para mostrar páginas actuales y cercanas
            let pageToShow;
            if (totalPages <= 5) {
              // Si hay 5 o menos páginas, mostrar todas
              pageToShow = i + 1;
            } else if (state.currentPage <= 3) {
              // Si estamos en las primeras páginas
              pageToShow = i + 1;
            } else if (state.currentPage >= totalPages - 2) {
              // Si estamos en las últimas páginas
              pageToShow = totalPages - 4 + i;
            } else {
              // Si estamos en medio
              pageToShow = state.currentPage - 2 + i;
            }
            
            return (
              <button
                key={i}
                onClick={() => setState(prev => ({ ...prev, currentPage: pageToShow }))}
                className={`w-8 h-8 rounded-md ${state.currentPage === pageToShow ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {pageToShow}
              </button>
            );
          })}
          
          <button
            onClick={() => setState(prev => ({ ...prev, currentPage: Math.min(totalPages, prev.currentPage + 1) }))}
            disabled={state.currentPage === totalPages}
            className={`p-2 rounded-md ${state.currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Siguiente
          </button>
        </div>
      </div>
    );
  };

  // Componente de Alerta
  const Alert = ({ type, message }: { type: AlertType; message: string }) => {
    const colors = {
      success: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', icon: Check },
      warning: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', icon: AlertTriangle },
      error: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', icon: X },
      info: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', icon: AlertTriangle }
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

  // Renderizar la UI para la lista de facturas
  const renderInvoicesList = () => {
    if (state.loading) {
      return (
        <div className="flex justify-center items-center p-10">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600">Cargando facturas...</span>
        </div>
      );
    }
    
    if (state.error) {
      return (
        <div className="bg-red-50 p-6 rounded-lg text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-3" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error al cargar facturas</h3>
          <p className="text-red-700 mb-4">{state.error}</p>
          <button
            onClick={fetchInvoices}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      );
    }
    
    if (state.invoices.length === 0) {
      return (
        <div className="p-10 text-center">
          <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-800 mb-2">No se encontraron facturas</h3>
          <p className="text-gray-600 mb-4">Prueba con otros filtros o crea una nueva venta</p>
        </div>
      );
    }
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Factura No.
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Método de Pago
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {state.invoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">#{invoice.id}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-600">{formatDate(invoice.fecha_venta)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-600">{invoice.cliente || 'Cliente General'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{formatCurrency(invoice.total)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                    ${invoice.estado === 'Completada' ? 'bg-green-100 text-green-800' : 
                      invoice.estado === 'Anulada' ? 'bg-red-100 text-red-800' : 
                      'bg-yellow-100 text-yellow-800'}`}>
                    {invoice.estado}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                    ${invoice.metodo_pago === 'Efectivo' ? 'bg-blue-100 text-blue-800' : 
                      invoice.metodo_pago === 'Tarjeta' ? 'bg-purple-100 text-purple-800' : 
                      'bg-indigo-100 text-indigo-800'}`}>
                    {invoice.metodo_pago}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handleViewInvoice(invoice.id!)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Ver factura"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handlePrint()}
                      className="text-gray-600 hover:text-gray-900"
                      title="Imprimir factura"
                    >
                      <Printer className="h-5 w-5" />
                    </button>
                    {invoice.estado !== 'Anulada' && (
                      <button
                        onClick={() => handleCancelInvoice(invoice.id!)}
                        className="text-red-600 hover:text-red-900"
                        title="Anular factura"
                      >
                        <XCircle className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {renderPagination()}
      </div>
    );
  };

  // Renderizado condicional basado en el estado
  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      {/* Alerta flotante */}
      {alert && (
        <div className="fixed top-6 right-6 z-50 max-w-md w-full">
          <Alert type={alert.type} message={alert.message} />
        </div>
      )}
      
      {/* Encabezado */}
      <header className="flex justify-between items-center px-8 py-4 shadow-md bg-white rounded-lg mb-6">
        <div className="flex items-center gap-3">
          <button onClick={state.previewMode ? handleBackToList : handleGoBack} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">
              {state.selectedInvoice ? `Factura #${state.selectedInvoice.id}` : 'Facturas'}
            </h1>
          </div>
        </div>
        
        {state.selectedInvoice && (
          <div className="flex gap-2">
            {settings?.ruta_pdf && (
              <button
                onClick={handleOpenPdfFolder}
                className="flex items-center gap-2 py-2 px-4 rounded-lg bg-gray-600 text-white hover:bg-gray-700 transition-colors"
              >
                <Folder className="h-4 w-4" />
                <span className="hidden sm:inline">Ver Carpeta</span>
              </button>
            )}
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 py-2 px-4 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
          </div>
        )}
      </header>
      
      {/* Contenido principal */}
      <main className="flex-1 px-6 pb-8">
        {state.selectedInvoice ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-sm" ref={facturaRef}>
              <FacturaViewer ventaData={state.selectedInvoice} />
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            {/* Panel de búsqueda y filtros */}
            <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
              <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                <div className="flex-1">
                  <h2 className="text-lg font-medium text-gray-800 mb-3">Buscar factura</h2>
                  <form onSubmit={handleSearchById} className="flex gap-2">
                    <div className="relative flex-grow">
                      <Search className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        className="w-full pl-10 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Número de factura"
                        value={state.searchId}
                        onChange={(e) => setState(prev => ({ ...prev, searchId: e.target.value }))}
                      />
                    </div>
                    <button 
                      type="submit"
                      className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      disabled={state.isSearching}
                    >
                      {state.isSearching ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          <span>Buscando...</span>
                        </>
                      ) : (
                        <span>Buscar</span>
                      )}
                    </button>
                  </form>
                </div>
                
                <div className="flex-1">
                  <h2 className="text-lg font-medium text-gray-800 mb-3">Filtrar por fecha</h2>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-600 mb-1">Desde</label>
                      <DatePicker
                        selected={state.startDate}
                        onChange={(date: Date | null) => {
                          if (date) {
                            setState(prev => ({ ...prev, startDate: date }));
                          }
                        }}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                        dateFormat="dd/MM/yyyy"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm text-gray-600 mb-1">Hasta</label>
                      <DatePicker
                        selected={state.endDate}
                        onChange={(date: Date | null) => {
                          if (date) {
                            setState(prev => ({ ...prev, endDate: date }));
                          }
                        }}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                        dateFormat="dd/MM/yyyy"
                        minDate={state.startDate}
                      />
                    </div>
                    <div className="flex self-end mt-6">
                      <button
                        onClick={handleDateSearch}
                        className="py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mr-2"
                        title="Aplicar filtros"
                      >
                        <Filter className="h-4 w-4" />
                      </button>
                      <button
                        onClick={resetFilters}
                        className="py-2 px-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        title="Limpiar filtros"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Filtros adicionales */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Estado</label>
                    <select
                      value={state.filterStatus}
                      onChange={(e) => setState(prev => ({ ...prev, filterStatus: e.target.value as any }))}
                      className="w-full min-w-[150px] p-2 border border-gray-300 rounded-lg"
                    >
                      <option value="all">Todos</option>
                      <option value="completed">Completadas</option>
                      <option value="cancelled">Anuladas</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Método de Pago</label>
                    <select
                      value={state.filterPaymentMethod}
                      onChange={(e) => setState(prev => ({ ...prev, filterPaymentMethod: e.target.value as any }))}
                      className="w-full min-w-[150px] p-2 border border-gray-300 rounded-lg"
                    >
                      <option value="all">Todos</option>
                      <option value="cash">Efectivo</option>
                      <option value="card">Tarjeta</option>
                      <option value="transfer">Transferencia</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Items por página</label>
                    <select
                      value={state.itemsPerPage}
                      onChange={(e) => setState(prev => ({ ...prev, itemsPerPage: parseInt(e.target.value), currentPage: 1 }))}
                      className="w-full min-w-[100px] p-2 border border-gray-300 rounded-lg"
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Lista de facturas */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {renderInvoicesList()}
            </div>
          </div>
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

export default Factura;