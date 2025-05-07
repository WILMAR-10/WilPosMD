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
import PrinterDiagnostic from '../utils/PrinterDiagnostic';
import ThermalPrintService from '../services/ThermalPrintService';

type AlertType = 'success' | 'warning' | 'error' | 'info';

// Tipado para cola de alertas
type AlertItem = { id: string; type: AlertType; message: string };

// Cola de alertas
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
    tipo_impresora: 'normal',
    auto_cut: settings?.auto_cut !== false,       // default true
    open_cash_drawer: settings?.open_cash_drawer || false
  });

  // Cola de alertas
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const showAlert = (type: AlertType, message: string) => {
    const id = crypto.randomUUID();
    setAlerts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 5000);
  };

  // Estado para el logo
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setImageFile] = useState<File | null>(null);

  // Estados para manejo de UI
  const [activeTab, setActiveTab] = useState<'general' | 'facturacion' | 'usuario'>('general');
  const [isSaving, setIsSaving] = useState(false);

  // Diálogo de confirmación
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'warning' as 'warning' | 'danger' | 'info'
  });

  // Lista de impresoras
  const [printers, setPrinters] = useState<Array<{
    name: string;
    isDefault?: boolean;
    isThermal?: boolean;
  }>>([]);

  // Permiso de edición
  const canEditSettings = hasPermission('configuracion', 'editar');

  // Check user permissions
  const canViewSettings = hasPermission('configuracion', 'ver');
  const canConfigurePrinter = hasPermission('configuracion', 'config');

  // Cargar configuración inicial y datos necesarios
  useEffect(() => {
    const loadConfig = async () => {
      try {
        if (!settings) return;
        setFormData(prev => ({
          ...prev,
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
          impuesto_porcentaje: settings.impuesto_porcentaje ?? 0.18,
          guardar_pdf: settings.guardar_pdf ?? true,
          ruta_pdf: settings.ruta_pdf || '',
        }));
      } catch (error) {
        console.error('Error loading settings:', error);
        showAlert('error', 'Error loading configuration');
      }
    };

    loadConfig();
  }, [settings]);

  // Cuando cambie la pestaña y sea 'facturacion', refresca la lista
  useEffect(() => {
    const loadPrinters = async () => {
      if (activeTab !== 'facturacion') return;

      try {
        const api = window.printerApi;
        if (!api) throw new Error('Printer API no disponible');

        const res = await api.getPrinters();
        let lista: Array<{ name: string; isDefault?: boolean; isThermal?: boolean }> = [];

        // La API puede devolver directamente un array...
        if (Array.isArray(res)) {
          lista = res;
        }
        // ...o un objeto { success, printers, error }
        else if ((res as any).success) {
          lista = (res as any).printers;
        } else {
          throw new Error((res as any).error || 'Error desconocido al cargar impresoras');
        }

        setPrinters(lista);
      } catch (err: any) {
        console.error('Error loading printers:', err);
        showAlert('error', `Error al cargar impresoras: ${err.message}`);
      }
    };

    loadPrinters();
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
    setFormData(prev => ({
      ...prev,
      logo: ''      // ← empty string, stays a string
    }));
  };

  // Guardar configuración
  const handleSaveSettings = async () => {
    // Check if user has edit permission
    if (!canEditSettings) {
      showAlert('error', 'No tienes permiso para modificar la configuración');
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
        const api = window.api!;
        const paths = await api.getAppPaths();
        const carpeta = `${paths.userData}/facturas`;
        if (api.ensureDir) {
          const res = await api.ensureDir(carpeta);
          if (!res.success) {
            console.error('Error al crear carpeta de facturas:', res.error);
          }
        }
        updatedSettings.ruta_pdf = carpeta;
      }

      // Guardar configuración en la base de datos
      await saveSettings(updatedSettings);

      showAlert('success', 'Configuración guardada con éxito');

    } catch (error) {
      console.error('Error completo:', error);
      showAlert('error', `Error al guardar configuración: ${error instanceof Error ? error.message : 'Error desconocido'}`);
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
        showAlert('success', 'Carpeta de facturas abierta correctamente');
      } else {
        showAlert('info', `Ruta de facturas: ${facturaPath}`);
      }

    } catch (error) {
      console.error('Error al abrir carpeta:', error);
      showAlert('error', `No se pudo abrir la carpeta: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Function to test the selected printer
  const testSelectedPrinter = async () => {
    try {
      const name = formData.impresora_termica;
      if (!name) throw new Error('Por favor seleccione una impresora primero');
      showAlert('info', `Probando impresora: ${name}…`);
      // 1) ESC/POS raw
      if (window.printerApi?.printRaw) {
        const cmd = `\x1B\x40\x1B\x61\x01WilPOS Test Page\n\nPrinter: ${name}\nDate: ${new Date().toLocaleString()}\n\n\n\n\x1D\x56\x00`;
        const res = await window.printerApi.printRaw(cmd, name);
        console.log('printRaw→', res);
        if (res.success) {
          showAlert('success', 'Prueba enviada. Revise la impresora.');
          return;
        }
        if (res.error) throw new Error(res.error);
      }
      // 2) Fallback diagnóstico
      console.log('Falling back to PrinterDiagnostic');
      const diag = new PrinterDiagnostic();
      const dr = await diag.testPrinter(name);
      console.log('diag→', dr);
      if (dr.status === 'success') {
        showAlert('success', dr.message);
        return;
      }
      throw new Error(dr.message || 'La impresora no respondió correctamente');
    } catch (err) {
      console.error('Error in testSelectedPrinter:', err);
      showAlert('error', err instanceof Error ? err.message : 'Error desconocido');
    }
  };

  // Handler para diagnóstico completo
  const handleRunDiagnostic = useCallback(async () => {
    try {
      const diag = new PrinterDiagnostic();
      const result = await diag.runFullDiagnostic();
      console.log('Diagnostic result:', result);
      showAlert(
        result.status === 'success' ? 'success'
          : result.status === 'warning' ? 'warning'
            : 'error',
        result.message
      );
    } catch (error) {
      console.error('Error running diagnostic:', error);
      showAlert('error', 'Error al ejecutar diagnóstico');
    }
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
        <button onClick={() => setAlerts(prev => prev.filter(a => a.message !== message))} className="ml-2 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  // onTestPrint function with
  async function onTestPrint() {
    try {
      // Get thermal print service
      const service = ThermalPrintService.getInstance();

      // Get printer list
      const printers = await service.getAvailablePrinters();

      // Find the selected printer or use default
      const targetPrinter = formData.impresora_termica ||
        printers.find(p => p.isDefault)?.name;

      if (!targetPrinter) {
        showAlert('warning', 'No printer selected. Please select a printer first.');
        return;
      }

      // Prepare a more robust test message with formatting
      const testMessage =
        '\x1B\x40' +                      // Initialize printer
        '\x1B\x61\x01' +                  // Center align
        '\x1B\x45\x01' +                  // Emphasis ON
        'WilPOS TEST PAGE\n\n' +          // Title
        '\x1B\x45\x00' +                  // Emphasis OFF
        `Printer: ${targetPrinter}\n` +
        `Date: ${new Date().toLocaleString()}\n\n` +
        'This is a printer test page.\n' +
        'If you can read this, your printer\n' +
        'is working correctly.\n\n\n' +    // Content
        '\x1D\x56\x00';                   // Cut paper

      // Convert to Uint8Array for better compatibility
      const encoder = new TextEncoder();
      const commands = encoder.encode(testMessage);

      // Log what we're doing
      console.log(`Sending test print to: ${targetPrinter}`);

      // Check if printRaw method is available
      if (!window.printerApi?.printRaw) {
        throw new Error('Printer API not available');
      }

      // Send to printer - use service for better error handling
      const result = await service.printRaw(commands, targetPrinter);

      if (result.success) {
        showAlert('success', `Test print sent to ${targetPrinter}`);
      } else {
        throw new Error(result.error || 'Unknown printer error');
      }
    } catch (error) {
      console.error('Test print error:', error);
      showAlert('error', `Print error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

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

            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-800">Configuración de Impresora</h2>

              {/* Printer selection */}
              <div>
                <label htmlFor="impresora_termica" className="block text-sm font-medium text-gray-700 mb-1">
                  Impresora Térmica
                </label>
                <div className="flex space-x-2">
                  <select
                    id="impresora_termica"
                    name="impresora_termica"
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.impresora_termica || ''}
                    onChange={handleChange}
                    disabled={!canEditSettings}
                  >
                    <option value="">-- Seleccionar impresora --</option>
                    {printers.map((printer, i) => (
                      <option key={i} value={printer.name}>
                        {printer.name} {printer.isDefault ? '(Default)' : ''} {printer.isThermal ? '(Térmica)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={testSelectedPrinter}
                    disabled={!formData.impresora_termica || !canEditSettings}
                    className={`px-4 py-2 rounded-lg ${!formData.impresora_termica || !canEditSettings
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                  >
                    Probar
                  </button>
                  <button
                    type="button"
                    onClick={handleRunDiagnostic}
                    disabled={!canEditSettings}
                    className={`px-4 py-2 rounded-lg ${!canEditSettings
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                  >
                    Diagnóstico
                  </button>
                  <button
                    type="button"
                    onClick={onTestPrint}
                    disabled={!canEditSettings}
                    className={`px-4 py-2 rounded-lg ${!canEditSettings
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-yellow-600 text-white hover:bg-yellow-700'
                      }`}
                  >
                    Test Print
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Las impresoras marcadas como (Térmica) serán tratadas como impresoras de recibos.
                </p>
              </div>

              {/* Printer type */}
              <div>
                <label htmlFor="tipo_impresora" className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Impresora
                </label>
                <select
                  id="tipo_impresora"
                  name="tipo_impresora"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.tipo_impresora}
                  onChange={handleChange}
                  disabled={!canEditSettings}
                >
                  <option value="normal">Impresora Normal</option>
                  <option value="termica">Impresora Térmica 80mm</option>
                  <option value="termica58">Impresora Térmica 58mm</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Seleccione el tipo de impresora que utilizará para la facturación.
                </p>
              </div>

              {/* PDF saving options */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="guardar_pdf" className="text-sm font-medium text-gray-700">
                    Guardar copia en PDF
                  </label>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none">
                    <input
                      type="checkbox"
                      id="guardar_pdf"
                      name="guardar_pdf"
                      className="sr-only"
                      checked={formData.guardar_pdf}
                      onChange={(e) => setFormData({ ...formData, guardar_pdf: e.target.checked })}
                      disabled={!canEditSettings}
                    />
                    <div className={`block w-10 h-6 rounded-full ${formData.guardar_pdf ? 'bg-blue-600' : 'bg-gray-300'} transition`}></div>
                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.guardar_pdf ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                </div>

                {formData.guardar_pdf && (
                  <div className="mt-2">
                    <label htmlFor="ruta_pdf" className="block text-sm font-medium text-gray-700 mb-1">
                      Carpeta para facturas PDF
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        id="ruta_pdf"
                        name="ruta_pdf"
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.ruta_pdf || ''}
                        onChange={handleChange}
                        disabled={!canEditSettings}
                        placeholder="Carpeta para guardar facturas PDF"
                      />
                      <button
                        type="button"
                        onClick={handleOpenFolder}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        <Folder className="h-4 w-4" />
                      </button>
                    </div>
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
      {alerts.length > 0 && (
        <div className="fixed top-6 right-6 z-50 max-w-md w-full">
          {alerts.map(alert => (
            <Alert key={alert.id} type={alert.type} message={alert.message} />
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
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
      />
    </div>
  );
};

export default Configuracion;