// src/pages/Configuracion.tsx 
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Save, Settings, Printer, ChevronLeft, 
  User, LogOut, Store, Phone, Mail, 
  Globe, FileText, DollarSign, Calendar, 
  Upload, Check, AlertTriangle, X, Folder,
  ShieldAlert, ShieldCheck, RotateCcw, Info
} from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { useSettings, Settings as SettingsType } from '../services/DatabaseService';
import ConfirmDialog from '../components/ConfirmDialog';
import ProtectedRoute from '../components/ProtectedRoute';
import Unauthorized from '../components/Unauthorized';
import ThermalPrintService from '../services/ThermalPrintService';
import { PrinterType } from '../types/printer';

// Define types
interface Printer {
  name: string;
  description?: string;
  status?: number;
  isDefault?: boolean;
  isThermal?: boolean;
}

interface PrinterOption {
  value: string;
  label: string;
  isThermal?: boolean;
}

type AlertType = 'success' | 'warning' | 'error' | 'info';

const Configuracion: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const { settings, loading, error: settingsError, saveSettings } = useSettings();
  
  // Estado para el formulario
  const [formData, setFormData] = useState<SettingsType>({
    nombre_negocio: '',
    direccion: '',
    telefono: '',
    email: '',
    rnc: '',
    sitio_web: '',
    mensaje_recibo: '',
    moneda: 'RD$',
    formato_fecha: 'DD/MM/YYYY',
    impuesto_nombre: 'ITEBIS',
    impuesto_porcentaje: 0.18,
    impresora_termica: settings?.impresora_termica || '',
    guardar_pdf: true,
    ruta_pdf: '',
    tipo_impresora: settings?.tipo_impresora || 'normal',
    auto_cut: settings?.auto_cut !== false, // default to true
    open_cash_drawer: settings?.open_cash_drawer || false,
  });
  
  // Estado para el logo
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setImageFile] = useState<File | null>(null);
  
  // Estados para manejo de UI
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: AlertType; message: string } | null>(null);

  // Estados para el manejo de impresoras
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [printerOptions, setPrinterOptions] = useState<PrinterOption[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState<boolean>(false);
  const [printerTestStatus, setPrinterTestStatus] = useState<{
    testing: boolean;
    success?: boolean;
    message?: string;
  }>({ testing: false });
  
  // Diálogo de confirmación
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning' as 'warning' | 'danger' | 'info'
  });

  // Check user permissions
  const canViewSettings = hasPermission('configuracion', 'ver');
  const canEditSettings = hasPermission('configuracion', 'editar');
  const canConfigurePrinter = hasPermission('configuracion', 'config'); 
  
  // Cargar configuración inicial y datos necesarios
  useEffect(() => {
    const loadConfig = async () => {
      try {
        if (settings) {
          setFormData({
            nombre_negocio: settings.nombre_negocio || 'WilPOS',
            direccion: settings.direccion || '',
            telefono: settings.telefono || '',
            email: settings.email || '',
            rnc: settings.rnc || '',
            sitio_web: settings.sitio_web || '',
            mensaje_recibo: settings.mensaje_recibo || 'Gracias por su compra',
            moneda: settings.moneda || 'RD$',
            formato_fecha: settings.formato_fecha || 'DD/MM/YYYY',
            impuesto_nombre: settings.impuesto_nombre || 'ITEBIS',
            impuesto_porcentaje: settings.impuesto_porcentaje || 0.18,
            impresora_termica: settings.impresora_termica || '',
            guardar_pdf: settings.guardar_pdf !== undefined ? settings.guardar_pdf : true,
            ruta_pdf: settings.ruta_pdf || '', 
            tipo_impresora: settings.tipo_impresora || 'normal',
            auto_cut: settings.auto_cut !== false, // default to true
            open_cash_drawer: settings.open_cash_drawer || false,
          });
          
          if (settings.logo) {
            setLogoPreview(settings.logo);
          }
        }
      } catch (error) {
        console.error('Error al cargar configuración:', error);
        setAlert({
          type: 'error', 
          message: 'Error al cargar la configuración'
        });
      }
    };
    
    loadConfig();
  }, [settings]);

  // Cargar rutas y listado de impresoras
  const loadPrinters = useCallback(async () => {
    try {
      setLoadingPrinters(true);
      
      // Intentar obtener impresoras desde la API
      let printersList: Printer[] = [];
      
      if (window.printerApi?.getPrinters) {
        const result = await window.printerApi.getPrinters();
        if (result.success && result.printers) {
          printersList = result.printers;
        }
      } else if (window.api?.getPrinters) {
        printersList = await window.api.getPrinters();
      } else {
        throw new Error("API de impresoras no disponible");
      }
      
      // Detectar impresoras térmicas basándonos en patrones del nombre (basado en el manual)
      // SPRT, POS, thermal, receipt, 58mm, 80mm son indicadores de impresoras térmicas
      const printersWithType = printersList.map(printer => ({
        ...printer,
        isThermal: printer.isThermal !== undefined ? printer.isThermal : 
          /thermal|receipt|pos|58mm|80mm|sprt|epson|tm-|tmt/i.test(printer.name)
      }));
      
      setPrinters(printersWithType);
      
      // Crear opciones para el selector con formato especial para impresoras térmicas
      const options: PrinterOption[] = printersWithType.map(printer => ({
        value: printer.name,
        label: `${printer.name}${printer.isDefault ? ' (Predeterminada)' : ''}${printer.isThermal ? ' 🧾' : ''}`,
        isThermal: printer.isThermal
      }));
      
      setPrinterOptions(options);
      
      // Si la impresora configurada ya no está disponible, mostrar advertencia
      if (formData.impresora_termica && !printersWithType.some(p => p.name === formData.impresora_termica)) {
        setAlert({
          type: 'warning',
          message: `La impresora configurada "${formData.impresora_termica}" no está disponible actualmente`
        });
      }
      
    } catch (error) {
      console.error('Error al cargar impresoras:', error);
      setAlert({
        type: 'error',
        message: `Error al cargar impresoras: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
    } finally {
      setLoadingPrinters(false);
    }
  }, [formData.impresora_termica, setAlert]);

  // Cuando cambie la pestaña y sea 'facturacion', refresca la lista
  useEffect(() => {
    if (activeTab === 'facturacion') {
      loadPrinters();
    }
  }, [activeTab, loadPrinters]);
  
  // Efecto para actualizar la configuración de ThermalPrintService cuando cambie el tipo de impresora
  useEffect(() => {
    try {
      if (formData.tipo_impresora) {
        const thermalPrintService = ThermalPrintService.getInstance();
        
        // Configurar el ancho del papel según el tipo de impresora
        if (formData.tipo_impresora === 'termica') {
          thermalPrintService.paperWidth = '80mm';
        }
        
        // Configurar la impresora activa
        if (formData.impresora_termica) {
          thermalPrintService.activePrinter = formData.impresora_termica;
        }
      }
    } catch (error) {
      console.error('Error al configurar servicio de impresión:', error);
    }
  }, [formData.tipo_impresora, formData.impresora_termica]);

  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
      setFormData({ ...formData, [name]: parseFloat(value) });
    } else if (type === 'checkbox') {
      const target = e.target as HTMLInputElement;
      setFormData({ ...formData, [name]: target.checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  
  // Manejar la carga de logo
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Eliminar logo
  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setImageFile(null);
    setFormData(prev => ({
      ...prev,
      logo: ''      // ← empty string, stays a string
    }));
  };
  
  // Guardar configuración
  const handleSaveSettings = async () => {
    // Check if user has edit permission
    if (!canEditSettings) {
      setAlert({
        type: 'error',
        message: 'No tienes permiso para modificar la configuración'
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      let updatedSettings = { ...formData };
      
      // Procesar logo si hay uno nuevo
      if (logoFile) {
        const reader = new FileReader();
        const logoBase64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(logoFile);
        });
        
        const logoBase64 = await logoBase64Promise;
        updatedSettings.logo = logoBase64;
      } else if (logoPreview) {
        updatedSettings.logo = logoPreview;
      } else {
        updatedSettings.logo = undefined;
      }
      
      // Asegurar que la ruta de PDF existe si está habilitada la opción
      if (updatedSettings.guardar_pdf && !updatedSettings.ruta_pdf) {
        try {
          const api = window.api;
          if (api?.getAppPaths) {
            const paths = await api.getAppPaths();
            const docsPath = paths.documents;
            const defaultPdfPath = `${docsPath}/WilPOS/Facturas`;
            
            // Crear la carpeta si no existe
            if (api.ensureDir) {
              await api.ensureDir(defaultPdfPath);
            }
            
            updatedSettings.ruta_pdf = defaultPdfPath;
          }
        } catch (error) {
          console.error('Error al configurar ruta de PDF:', error);
        }
      }
      
      // Actualizar la configuración en ThermalPrintService antes de guardar
      try {
        const thermalPrintService = ThermalPrintService.getInstance();
        
        // Configurar el ancho del papel según el tipo de impresora
        if (updatedSettings.tipo_impresora === 'termica') {
          thermalPrintService.paperWidth = '80mm';
        }
        
        // Configurar la impresora activa y otras opciones
        if (updatedSettings.impresora_termica) {
          thermalPrintService.activePrinter = updatedSettings.impresora_termica;
        }
        
        // Configurar opciones adicionales en el servicio
        thermalPrintService.autoCut = updatedSettings.auto_cut !== false;
        thermalPrintService.autoOpenCashDrawer = updatedSettings.open_cash_drawer || false;
        
        // Guardar la configuración en el servicio
        await thermalPrintService.saveSettings();
        
      } catch (error) {
        console.error('Error al configurar servicio de impresión:', error);
      }
      
      // Guardar configuración en la base de datos
      await saveSettings(updatedSettings);
      
      setAlert({
        type: 'success',
        message: 'Configuración guardada con éxito'
      });
      
    } catch (error) {
      console.error('Error completo:', error);
      setAlert({
        type: 'error',
        message: `Error al guardar configuración: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Confirmar cierre de sesión
  const handleLogout = () => {
    showConfirmDialog(
      'Cerrar sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      () => {
        logout();
      },
      'warning'
    );
  };
  
  // Regresar al home
  const handleGoBack = () => {
    const event = new CustomEvent('componentChange', {
      detail: { component: 'Home' }
    });
    window.dispatchEvent(event);
  };
  
  // Abrir carpeta de facturas
  const handleOpenFolder = async () => {
    try {
      const api = window.api;
      
      if (!api?.getAppPaths) {
        throw new Error("La API no está disponible");
      }

      // Definir la ruta base para las facturas
      const paths = await api.getAppPaths();
      const docsPath = paths.documents;
      const facturaPath = formData.ruta_pdf || `${docsPath}/WilPOS/Facturas`;

      // Asegurar que la carpeta existe antes de intentar abrirla
      if (api.ensureDir) {
        const dirResult = await api.ensureDir(facturaPath);
        if (!dirResult.success) {
          throw new Error(`No se pudo crear la carpeta: ${dirResult.error}`);
        }
      }

      // Actualizar la ruta en el formulario si es necesario
      if (!formData.ruta_pdf) {
        setFormData(prev => ({
          ...prev,
          ruta_pdf: facturaPath
        }));
      }

      // Abrir la carpeta
      if (api.openFolder) {
        await api.openFolder(facturaPath);
        setAlert({
          type: 'success',
          message: 'Carpeta de facturas abierta correctamente'
        });
      } else {
        setAlert({
          type: 'info',
          message: `Ruta de facturas: ${facturaPath}`
        });
      }
      
    } catch (error) {
      console.error('Error al abrir carpeta:', error);
      setAlert({
        type: 'error',
        message: `No se pudo abrir la carpeta: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
    }
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
  
  // Cerrar la alerta después de un tiempo
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Función para probar la impresora seleccionada
  const handleTestPrinter = async () => {
    if (!formData.impresora_termica) {
      setAlert({
        type: 'warning',
        message: 'Seleccione una impresora primero'
      });
      return;
    }
    
    try {
      setPrinterTestStatus({ testing: true });
      
      const thermalPrintService = ThermalPrintService.getInstance();
      
      // Configurar el tipo de impresora según la selección
      thermalPrintService.paperWidth = '80mm';
      
      // Intentar imprimir página de prueba
      const result = await thermalPrintService.testPrinter(formData.impresora_termica);
      
      if (result.success) {
        setPrinterTestStatus({
          testing: false,
          success: true,
          message: 'Prueba de impresión enviada correctamente'
        });
        setAlert({
          type: 'success',
          message: 'Prueba de impresión enviada correctamente'
        });
      } else {
        throw new Error(result.error || 'Error al imprimir');
      }
    } catch (error) {
      console.error('Error al probar impresora:', error);
      setPrinterTestStatus({
        testing: false,
        success: false,
        message: error instanceof Error ? error.message : 'Error al imprimir'
      });
      setAlert({
        type: 'error',
        message: `Error al probar impresora: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
    }
  };

  // Función para abrir cajón de dinero (si la impresora lo soporta)
  const handleOpenCashDrawer = async () => {
    if (!formData.impresora_termica) {
      setAlert({
        type: 'warning',
        message: 'Seleccione una impresora primero'
      });
      return;
    }
    
    try {
      setPrinterTestStatus({ testing: true });
      
      const thermalPrintService = ThermalPrintService.getInstance();
      const result = await thermalPrintService.openCashDrawer(formData.impresora_termica);
      
      if (result.success) {
        setPrinterTestStatus({
          testing: false,
          success: true,
          message: 'Comando de apertura de cajón enviado'
        });
        setAlert({
          type: 'success',
          message: 'Comando de apertura de cajón enviado. Verifique si el cajón se abrió.'
        });
      } else {
        throw new Error(result.error || 'Error al enviar comando al cajón');
      }
    } catch (error) {
      console.error('Error al abrir cajón:', error);
      setPrinterTestStatus({
        testing: false,
        success: false,
        message: error instanceof Error ? error.message : 'Error al abrir cajón' 
      });
      setAlert({
        type: 'error',
        message: `Error al abrir cajón: ${error instanceof Error ? error.message : 'La impresora puede no soportar control de cajón'}`
      });
    }
  };

  // Renderizado de pestañas

  const renderTab = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-800">Información General</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="nombre_negocio" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Negocio
                </label>
                <div className="relative">
                  <Store className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    id="nombre_negocio"
                    name="nombre_negocio"
                    className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.nombre_negocio}
                    onChange={handleChange}
                    placeholder="Nombre de tu negocio"
                    disabled={!canEditSettings}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="rnc" className="block text-sm font-medium text-gray-700 mb-1">
                  RNC
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    id="rnc"
                    name="rnc"
                    className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.rnc || ''}
                    onChange={handleChange}
                    placeholder="Número de RNC"
                    disabled={!canEditSettings}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    id="telefono"
                    name="telefono"
                    className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.telefono || ''}
                    onChange={handleChange}
                    placeholder="Número de teléfono"
                    disabled={!canEditSettings}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.email || ''}
                    onChange={handleChange}
                    placeholder="correo@ejemplo.com"
                    disabled={!canEditSettings}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="sitio_web" className="block text-sm font-medium text-gray-700 mb-1">
                  Sitio Web
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    id="sitio_web"
                    name="sitio_web"
                    className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.sitio_web || ''}
                    onChange={handleChange}
                    placeholder="www.ejemplo.com"
                    disabled={!canEditSettings}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="moneda" className="block text-sm font-medium text-gray-700 mb-1">
                  Moneda
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <select
                    id="moneda"
                    name="moneda"
                    className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.moneda}
                    onChange={handleChange}
                    disabled={!canEditSettings}
                  >
                    <option value="RD$">Peso Dominicano (RD$)</option>
                    <option value="$">Dólar Estadounidense ($)</option>
                    <option value="€">Euro (€)</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <textarea
                id="direccion"
                name="direccion"
                rows={2}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.direccion || ''}
                onChange={handleChange}
                placeholder="Dirección completa del negocio"
                disabled={!canEditSettings}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo del Negocio
              </label>
              <div className="flex items-start space-x-5">
                {logoPreview ? (
                  <div className="relative">
                    <div className="h-32 w-32 rounded-lg overflow-hidden bg-gray-100 border">
                      <img 
                        src={logoPreview} 
                        alt="Logo" 
                        className="h-full w-full object-contain"
                      />
                    </div>
                    {canEditSettings && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 bg-red-100 rounded-full p-1 text-red-600 hover:bg-red-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div 
                    className={`h-32 w-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 
                    ${canEditSettings ? 'hover:border-blue-500 hover:text-blue-500 cursor-pointer' : 'cursor-not-allowed'}`}
                    onClick={() => canEditSettings && document.getElementById('logo-upload')?.click()}
                  >
                    <Upload className="h-8 w-8 mb-1" />
                    <span className="text-xs text-center">
                      {canEditSettings ? 'Subir logo' : 'No disponible'}
                    </span>
                  </div>
                )}
                
                {canEditSettings && (
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                )}
                
                <div className="text-xs text-gray-500 mt-2">
                  <p>Formatos: JPG, PNG, GIF</p>
                  <p>Tamaño recomendado: 200x200px</p>
                  <p>Tamaño máximo: 2MB</p>
                  <p className="mt-2">El logo aparecerá en las facturas y recibos</p>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'facturacion':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-800">Configuración de Facturación</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="impuesto_nombre" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Impuesto
                </label>
                <input
                  type="text"
                  id="impuesto_nombre"
                  name="impuesto_nombre"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.impuesto_nombre}
                  onChange={handleChange}
                  placeholder="ITEBIS"
                  disabled={!canEditSettings}
                />
              </div>
              
              <div>
                <label htmlFor="formato_fecha" className="block text-sm font-medium text-gray-700 mb-1">
                  Formato de Fecha
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <select
                    id="formato_fecha"
                    name="formato_fecha"
                    className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.formato_fecha}
                    onChange={handleChange}
                    disabled={!canEditSettings}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="mensaje_recibo" className="block text-sm font-medium text-gray-700 mb-1">
                Mensaje de Agradecimiento
              </label>
              <textarea
                id="mensaje_recibo"
                name="mensaje_recibo"
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.mensaje_recibo}
                onChange={handleChange}
                placeholder="Gracias por su compra"
                disabled={!canEditSettings}
              />
              <div className="text-xs text-gray-500 mt-1">
                Este mensaje aparecerá al final de cada factura.
              </div>
            </div>

            <div className="mt-6 space-y-6">
              <h3 className="text-lg font-medium">Configuración de Impresora</h3>
              
              <div>
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    name="guardar_pdf"
                    checked={formData.guardar_pdf}
                    onChange={(e) => setFormData({...formData, guardar_pdf: e.target.checked})}
                    className="form-checkbox h-5 w-5 text-blue-600"
                    disabled={!canConfigurePrinter}
                  />
                  <span className={!canConfigurePrinter ? 'text-gray-400' : ''}>
                    Guardar facturas como PDF automáticamente
                  </span>
                </label>
              </div>
            
              {formData.guardar_pdf && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Carpeta para PDFs
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formData.ruta_pdf}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={handleOpenFolder}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center"
                    >
                      <Folder className="h-4 w-4 mr-1" />
                      Abrir carpeta
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Las facturas se guardarán automáticamente como PDF en esta ubicación
                  </p>
                </div>
              )}
            
              <div>
                <label htmlFor="tipo_impresora" className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Impresora
                </label>
                <div className="relative">
                  <Printer className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <select
                    id="tipo_impresora"
                    name="tipo_impresora"
                    className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.tipo_impresora}
                    onChange={handleChange}
                    disabled={!canConfigurePrinter}
                  >
                    <option value="normal">Impresora Estándar</option>
                    <option value="termica">Impresora Térmica</option>
                  </select>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Seleccione el tipo de impresora para los recibos.
                </p>
              </div>
              
              <div className="mt-4">
                <label className="flex items-center space-x-3 mb-4">
                  <input
                    type="checkbox"
                    name="auto_cut"
                    checked={formData.auto_cut !== false}
                    onChange={(e) => setFormData({...formData, auto_cut: e.target.checked})}
                    className="form-checkbox h-5 w-5 text-blue-600"
                    disabled={!canConfigurePrinter || formData.tipo_impresora === 'normal'}
                  />
                  <span className={!canConfigurePrinter || formData.tipo_impresora === 'normal' ? 'text-gray-400' : ''}>
                    Corte automático de papel
                  </span>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    name="open_cash_drawer"
                    checked={formData.open_cash_drawer === true}
                    onChange={(e) => setFormData({...formData, open_cash_drawer: e.target.checked})}
                    className="form-checkbox h-5 w-5 text-blue-600"
                    disabled={!canConfigurePrinter || formData.tipo_impresora === 'normal'}
                  />
                  <span className={!canConfigurePrinter || formData.tipo_impresora === 'normal' ? 'text-gray-400' : ''}>
                    Abrir cajón automáticamente al imprimir
                  </span>
                </label>
              </div>
              
              <div>
                <label htmlFor="impresora_termica" className="block text-sm font-medium text-gray-700 mb-1">
                  Seleccionar Impresora
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="impresora_termica"
                    name="impresora_termica"
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.impresora_termica || ''}
                    onChange={handleChange}
                    disabled={!canConfigurePrinter || loadingPrinters}
                  >
                    <option value="">Seleccione una impresora</option>
                    {printerOptions.map((printer) => (
                      <option key={printer.value} value={printer.value}>
                        {printer.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={loadPrinters}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center justify-center"
                    title="Actualizar lista de impresoras"
                    disabled={loadingPrinters}
                  >
                    <RotateCcw className={`h-5 w-5 text-gray-600 ${loadingPrinters ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                
                <div className="mt-2 flex flex-wrap gap-2">
                  {loadingPrinters ? (
                    <div className="text-sm text-gray-500">Cargando impresoras...</div>
                  ) : printers.length === 0 ? (
                    <div className="text-sm text-yellow-500">No se encontraron impresoras disponibles</div>
                  ) : (
                    <div className="text-xs text-gray-500">
                      <span>{printers.length} impresoras disponibles. </span>
                      {printers.filter(p => p.isThermal).length > 0 ? (
                        <span className="text-green-600">{printers.filter(p => p.isThermal).length} impresoras térmicas detectadas.</span>
                      ) : (
                        <span className="text-yellow-600">No se detectaron impresoras térmicas.</span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleTestPrinter}
                    className={`py-2 px-4 rounded-lg flex items-center gap-2 ${
                      printerTestStatus.testing || !formData.impresora_termica || !canConfigurePrinter
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                    disabled={printerTestStatus.testing || !formData.impresora_termica || !canConfigurePrinter}
                  >
                    {printerTestStatus.testing ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        <span>Probando...</span>
                      </>
                    ) : (
                      <>
                        <Printer className="h-4 w-4" />
                        <span>Imprimir página de prueba</span>
                      </>
                    )}
                  </button>
                  
                  {formData.tipo_impresora !== 'normal' && (
                    <button
                      type="button"
                      onClick={handleOpenCashDrawer}
                      className={`py-2 px-4 rounded-lg flex items-center gap-2 ${
                        printerTestStatus.testing || !formData.impresora_termica || !canConfigurePrinter
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                      disabled={printerTestStatus.testing || !formData.impresora_termica || !canConfigurePrinter}
                    >
                      <DollarSign className="h-4 w-4" />
                      <span>Probar cajón</span>
                    </button>
                  )}
                </div>
                
                {/* Estado de prueba de impresora */}
                {printerTestStatus.message && !printerTestStatus.testing && (
                  <div className={`mt-2 p-2 rounded-md text-sm ${
                    printerTestStatus.success 
                      ? 'bg-green-50 text-green-700 border border-green-200' 
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {printerTestStatus.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
        
      case 'usuario':
        return (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-800">Información de Usuario</h2>
            
            {user && (
              <div className="bg-white p-6 rounded-lg border shadow-sm">
                <div className="flex items-center mb-6">
                  <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
                    {user.nombre.charAt(0)}
                  </div>
                  <div className="ml-4">
                    <h3 className="text-xl font-medium text-gray-800">{user.nombre}</h3>
                    <p className="text-gray-600">@{user.usuario}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm text-gray-500">Rol</p>
                    <p className="font-medium">
                      {user.rol === 'admin' ? 'Administrador' : 
                       user.rol === 'cajero' ? 'Cajero' : 'Empleado'}
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm text-gray-500">Fecha de registro</p>
                    <p className="font-medium">
                      {user.fecha_creacion ? new Date(user.fecha_creacion).toLocaleDateString('es-DO') : 'No disponible'}
                    </p>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h4 className="font-medium text-gray-700 mb-2">Permisos y accesos</h4>
                  <div className="grid grid-cols-2 gap-2">
                  {['inventario', 'ventas', 'clientes', 'reportes', 'configuracion', 'usuarios'].map((modulo) => (
                    <div key={modulo} className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${hasPermission(modulo as any, 'ver') ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="capitalize text-sm">{modulo}</span>
                    </div>
                  ))}
                  </div>
                </div>
                
                <div className="mt-8">
                  <button 
                    className="w-full py-2 px-4 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };
  
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
            <Settings className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Configuración</h1>
          </div>
        </div>
        {canEditSettings && (
          <button
            className="flex items-center gap-2 py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            onClick={handleSaveSettings}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Guardar cambios</span>
              </>
            )}
          </button>
        )}
      </header>
      
      {/* Contenido principal */}
      <main className="flex-1 px-6 pb-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="ml-3 text-gray-600">Cargando configuración...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Barra lateral */}
            <div className="md:col-span-1">
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <nav className="flex flex-col">
                  <button
                    className={`flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${activeTab === 'general' ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' : ''}`}
                    onClick={() => setActiveTab('general')}
                  >
                    <Store className="h-5 w-5" />
                    <span>Información General</span>
                  </button>
                  <button
                    className={`flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${activeTab === 'facturacion' ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' : ''}`}
                    onClick={() => setActiveTab('facturacion')}
                  >
                    <Printer className="h-5 w-5" />
                    <span>Facturación</span>
                  </button>
                  <button
                    className={`flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${activeTab === 'usuario' ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' : ''}`}
                    onClick={() => setActiveTab('usuario')}
                  >
                    <User className="h-5 w-5" />
                    <span>Usuario y Sesión</span>
                  </button>
                </nav>
              </div>
              
              {!canEditSettings && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-xl border border-yellow-200 text-yellow-800 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium">Modo de solo lectura</span>
                  </div>
                  <p>No tienes permisos para editar la configuración. Contacta a un administrador para realizar cambios.</p>
                </div>
              )}
            </div>
            
            {/* Contenido de la pestaña */}
            <div className="md:col-span-3">
              <div className="bg-white rounded-xl shadow-sm p-6">
                {settingsError ? (
                  <div className="bg-red-50 p-4 rounded-lg text-red-700 flex items-start">
                    <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Error al cargar configuración</p>
                      <p className="mt-1">{settingsError}</p>
                    </div>
                  </div>
                ) : (
                  renderTab()
                )}
              </div>
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

export default Configuracion;