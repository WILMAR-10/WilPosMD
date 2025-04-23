// Configuracion.tsx 
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Save, Settings, Printer, ChevronLeft, 
  User, LogOut, Store, Phone, Mail, 
  Globe, FileText, DollarSign, Calendar, 
  Upload, Check, AlertTriangle, X, Folder,
  ShieldAlert, ShieldCheck, RotateCcw
} from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { useSettings, Settings as SettingsType } from '../services/DatabaseService';
import ConfirmDialog from '../components/ConfirmDialog';
import ProtectedRoute from '../components/ProtectedRoute';
import Unauthorized from '../components/Unauthorized';
import ThermalPrintService from '../services/ThermalPrintService';

// Define types
interface Printer {
  name: string;
  description?: string;
  status?: number;
  isDefault?: boolean;
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
    impresora_termica: '',
    guardar_pdf: true,
    ruta_pdf: '',
    tipo_impresora: 'normal',
  });
  
  // Estado para el logo
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setImageFile] = useState<File | null>(null);
  
  // Estados para manejo de UI
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: AlertType; message: string } | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  
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
  useEffect(() => {
    const init = async () => {
      if (!window.api) {
        console.error('API no disponible');
        return;
      }
      
      try {
        if (window.api.getAppPaths) {
          const paths = await window.api.getAppPaths();
          
          setFormData(prev => ({
            ...prev,
            ruta_pdf: prev.ruta_pdf || `${paths.documents}/WilPOS/Facturas`
          }));
        }
        
        await loadPrinters();
      } catch (error) {
        console.error('Error initializing settings:', error);
        setAlert({
          type: 'error',
          message: 'Error al cargar la configuración inicial'
        });
      }
    };
    
    init();
  }, []);
  
  // Cuando cambie la pestaña y sea 'facturacion', refresca la lista
  useEffect(() => {
    if (activeTab === 'facturacion') {
      loadPrinters();
    }
  }, [activeTab]);

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
    setFormData({ ...formData, logo: undefined });
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
      
      // Guardar configuración
      await saveSettings(updatedSettings);
      
      setAlert({
        type: 'success',
        message: 'Configuración guardada con éxito'
      });
      
    } catch (error) {
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
    if (!formData.ruta_pdf) {
      setAlert({
        type: 'warning',
        message: 'No hay una ruta configurada para las facturas'
      });
      return;
    }
    
    try {
      if (window.api?.openFolder) {
        await window.api.openFolder(formData.ruta_pdf);
      } else {
        setAlert({
          type: 'info',
          message: `Ruta de facturas: ${formData.ruta_pdf}`
        });
      }
    } catch (error) {
      console.error('Error al abrir carpeta:', error);
      setAlert({
        type: 'error',
        message: 'No se pudo abrir la carpeta de facturas'
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
  
  // Función para cargar impresoras
  const loadPrinters = async () => {
    const thermalService = ThermalPrintService.getInstance();
    try {
      const { printers } = await thermalService.getAllPrinters();
      if (printers?.length) {
        console.log('Impresoras cargadas correctamente:', printers.map(p => p.name));
        setPrinters(printers);
        return;
      }
      if (formData.impresora_termica) {
        const fallback = [
          {
            name: formData.impresora_termica,
            description: 'Configurada en el sistema',
            isDefault: true,
            isThermal: true
          },
          { name: 'Microsoft Print to PDF', isDefault: false, isThermal: false }
        ];
        console.log('Usando impresoras de respaldo:', fallback);
        setPrinters(fallback);
        return;
      }
      console.warn('No se encontraron impresoras disponibles');
      setPrinters([]);
      setAlert({ type: 'info', message: 'No se detectaron impresoras. Revise la conexión.' });
    } catch (error) {
      console.error('Error al cargar impresoras:', error);
      if (formData.impresora_termica) {
        const fallback = [{
          name: formData.impresora_termica,
          isDefault: true,
          isThermal: true
        }];
        console.log('Usando impresora configurada como respaldo:', fallback);
        setPrinters(fallback);
        return;
      }
      setPrinters([]);
      setAlert({
        type: 'warning',
        message: 'Error al obtener lista de impresoras: ' +
                 (error instanceof Error ? error.message : 'Error desconocido')
      });
    }
  };

  // Función para probar impresora térmica
  const testThermalPrinter = async () => {
    try {
      setAlert({ type: 'info', message: 'Probando impresora térmica...' });
      const thermalService = ThermalPrintService.getInstance();
      const result = await thermalService.testPrinter();
      setAlert({
        type: result.success ? 'success' : 'error',
        message: result.message
      });
    } catch (error) {
      console.error('Error probando impresora térmica:', error);
      setAlert({
        type: 'error',
        message: 'Error al probar impresora: ' +
                 (error instanceof Error ? error.message : 'Error desconocido')
      });
    }
  };

  // Si el usuario no tiene permiso para ver la configuración, mostrar el componente de acceso no autorizado
  if (!canViewSettings) {
    return <Unauthorized />;
  }
  
  // Renderizado de pestañas
  const renderPrinterSelect = () => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Impresora Térmica
      </label>
      
      {/* Estado de carga de impresoras */}
      {printers.length === 0 && (
        <div className="p-3 mb-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
          <div className="flex items-center mb-1">
            <AlertTriangle className="h-4 w-4 mr-2 text-yellow-600" />
            <span className="font-medium">No se detectaron impresoras</span>
          </div>
          <p className="text-xs">
            Asegúrese de que su impresora está conectada y encendida,
            luego haga clic en "Diagnóstico de impresoras" para volver a intentarlo.
          </p>
        </div>
      )}
      
      <select
        name="impresora_termica"
        value={formData.impresora_termica}
        onChange={handleChange}
        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={!canConfigurePrinter}
      >
        <option value="">Usar impresora predeterminada del sistema</option>
        {printers.map((printer) => (
          <option 
            key={printer.name} 
            value={printer.name}
            // Añadir class para destacar impresoras térmicas
            className={printer.isThermal ? 'font-medium text-blue-600' : ''}
          >
            {printer.name}
            {printer.isDefault ? ' (Predeterminada)' : ''}
            {printer.isThermal ? ' (Térmica)' : ''}
          </option>
        ))}
      </select>
      
      {/* Botón para refrescar la lista de impresoras */}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={loadPrinters}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
          disabled={!canConfigurePrinter}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Actualizar lista de impresoras
        </button>
      </div>
      
      {!canConfigurePrinter && (
        <p className="text-xs text-yellow-600 mt-1">
          Se requieren permisos de configuración para cambiar la impresora
        </p>
      )}
      
      {/* Add helper text explaining printer selection */}
      <p className="text-xs text-gray-500 mt-1">
        Si no selecciona ninguna impresora, se usará la impresora predeterminada del sistema.
        Las impresoras térmicas suelen ser de 80mm o 58mm para tickets.
      </p>
    </div>
  );

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

            <div className="mt-6 space-y-4">
              <h3 className="text-lg font-medium">Configuración de Impresión</h3>
              
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
            
              {renderPrinterSelect()}

              <div className="mt-4">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setAlert({ type: 'info', message: 'Ejecutando diagnóstico de impresoras...' });
                      const { runPrinterDiagnostic } = await import('../utils/PrinterDiagnostic');
                      await runPrinterDiagnostic();
                      setAlert({ 
                        type: 'success', 
                        message: 'Diagnóstico completado. Revisa la consola para más detalles (F12)' 
                      });
                    } catch (error) {
                      setAlert({ 
                        type: 'error', 
                        message: 'Error durante el diagnóstico. Revisa la consola para más detalles.' 
                      });
                    }
                  }}
                  className="flex items-center gap-2 py-2 px-4 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition"
                >
                  <Printer className="h-4 w-4" />
                  Ejecutar diagnóstico de impresoras
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  Esto mostrará información detallada sobre las impresoras en la consola (F12)
                </p>
              </div>

              <div className="mt-2">
                <button
                  type="button"
                  onClick={testThermalPrinter}
                  className="flex items-center gap-2 py-2 px-4 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition"
                  disabled={!formData.impresora_termica}
                >
                  <Printer className="h-4 w-4" />
                  Probar impresora térmica
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  Esto enviará una página de prueba a la impresora térmica seleccionada
                </p>
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