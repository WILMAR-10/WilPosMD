﻿// src/pages/Configuracion.tsx - Updated with enhanced printer options

import React, { useState, useEffect, useRef } from 'react';
import {
  Save, Settings, Printer, ChevronLeft,
  User, LogOut, Store, Phone, Mail,
  Globe, FileText, DollarSign, Calendar,
  Upload, Check, AlertTriangle, X, Folder,
  ShieldAlert, ShieldCheck, RotateCcw, Info,
  Barcode
} from 'lucide-react';
import { useAuth } from '../services/AuthContext';
import { useSettings } from '../services/DatabaseService';
import ConfirmDialog from '../components/ConfirmDialog';
import PrinterDiagnostic from '../utils/PrinterDiagnostic';
import ThermalPrintService from '../services/ThermalPrintService';

type AlertType = 'success' | 'warning' | 'error' | 'info';

// Type for alert queue
type AlertItem = { id: string; type: AlertType; message: string };

type Printer = {
  name: string;
  isDefault?: boolean;
  isThermal?: boolean;
};

const Configuracion: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const { settings, loading: settingsLoading, error: settingsError, saveSettings } = useSettings();

  // Form state
  const [formData, setFormData] = useState({
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
    impresora_termica_secundaria: '',
    impresora_etiquetas: '',
    guardar_pdf: true,
    ruta_pdf: '',
    tipo_impresora: 'normal' as 'normal' | 'termica' | 'termica58',
    auto_cut: true,
    open_cash_drawer: false,
    logo: undefined as string | undefined
  });

  // Alert queue
  const [alerts, setAlerts] = useState<string[]>([]);
  const addAlert = (msg: string) => {
    setAlerts(prev => [...prev, msg]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a !== msg)), 5000);
  };

  // Logo state
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setImageFile] = useState<File | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'general' | 'facturacion' | 'usuario'>('general');
  const [isSaving, setIsSaving] = useState(false);

  // Printer service
  const thermalPrintService = ThermalPrintService.getInstance();
  const printerDiagnostic = new PrinterDiagnostic();

  // Printers list
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(false);

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'warning' as 'warning' | 'danger' | 'info'
  });

  // Permissions
  const canEditSettings = hasPermission('configuracion', 'editar');
  const canViewSettings = hasPermission('configuracion', 'ver');
  const canConfigurePrinter = hasPermission('configuracion', 'config');

  // Load initial settings and data
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
          impresora_termica: settings.impresora_termica || '',
          impresora_termica_secundaria: settings.impresora_termica_secundaria || '',
          impresora_etiquetas: settings.impresora_etiquetas || '',
          guardar_pdf: settings.guardar_pdf ?? true,
          ruta_pdf: settings.ruta_pdf || '',
          tipo_impresora: settings.tipo_impresora || 'normal',
          auto_cut: settings.auto_cut !== false, // Default to true if not set
          open_cash_drawer: settings.open_cash_drawer || false,
          logo: settings.logo
        }));

        // Set logo preview if exists
        if (settings.logo) {
          setLogoPreview(settings.logo);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        addAlert('Error loading configuration');
      }
    };

    loadConfig();
  }, [settings]);

  // Load printers
  useEffect(() => {
    const fetchPrinters = async () => {
      try {
        setLoading(true);
        const { success, printers: list, error } = await window.printerApi.getPrinters();
        if (success) {
          setPrinters(list);
        } else {
          addAlert(`Error al obtener impresoras: ${error}`);
        }
      } catch (err: any) {
        addAlert(`Error inesperado al obtener impresoras: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchPrinters();
  }, []);

  // Form change handler
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

  // Logo upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove logo handler
  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setImageFile(null);
    setFormData(prev => ({
      ...prev,
      logo: undefined
    }));
  };

  // Test printer
  const handleTestPrinter = async (printerName: string) => {
    if (!printerName) {
      addAlert('Por favor, seleccione una impresora.');
      return;
    }

    try {
      // Try printerApi first, then fallback to api
      const api = window.printerApi || window.api;
      if (!api?.testPrinter) {
        addAlert('La API de prueba de impresora no está disponible.');
        return;
      }

      const { success, error } = await api.testPrinter(printerName);
      if (success) {
        addAlert(`Prueba de impresora exitosa: ${printerName}`);
      } else {
        addAlert(`Error al probar la impresora: ${error}`);
      }
    } catch (err: any) {
      addAlert(`Error inesperado al probar impresora: ${err.message}`);
    }
  };

  /** Run a quick or full diagnostic on the selected thermal printer */
  const testPrinter = async (mode: 'diagnostic' | 'full') => {
    const printerName = formData.impresora_termica;
    if (!printerName) {
      addAlert('Por favor, selecciona la impresora térmica primero.');
      return;
    }
    try {
      // Usa los métodos correctos
      const result =
        mode === 'diagnostic'
          ? await printerDiagnostic.runFullDiagnostic()
          : await printerDiagnostic.testPrinter(printerName);

      if (result.status === 'success') {
        addAlert(`${mode === 'diagnostic' ? 'Diagnóstico' : 'Test completo'} exitoso: ${printerName}`);
      } else {
        addAlert(`${mode === 'diagnostic' ? 'Diagnóstico' : 'Test completo'} fallido: ${result.message}`);
      }
    } catch (err: any) {
      addAlert(`Fallo al ejecutar ${mode}: ${err.message}`);
    }
  };

  // Save settings handler
  const handleSaveSettings = async () => {
    if (!canEditSettings) {
      addAlert('No tienes permiso para modificar la configuración');
      return;
    }

    setIsSaving(true);

    try {
      // Create a clean copy of formData
      let updatedSettings = { ...formData };

      // Process logo if there's a new one
      if (logoFile) {
        const logoBase64 = await convertFileToBase64(logoFile);
        updatedSettings.logo = logoBase64;
      } else if (logoPreview) {
        // If there's a preview but no file, it might be the existing logo
        updatedSettings.logo = logoPreview;
      }

      // Ensure printer settings are properly set
      if (updatedSettings.impresora_termica === '') {
        updatedSettings.impresora_termica = '';
      }

      // Ensure boolean values are correctly set
      updatedSettings.guardar_pdf = !!updatedSettings.guardar_pdf;
      updatedSettings.auto_cut = updatedSettings.auto_cut !== false;
      updatedSettings.open_cash_drawer = !!updatedSettings.open_cash_drawer;

      // Ensure PDF directory exists if PDF saving is enabled
      if (updatedSettings.guardar_pdf && !updatedSettings.ruta_pdf) {
        const api = window.api;
        if (api?.getAppPaths) {
          const paths = await api.getAppPaths();
          const defaultPath = `${paths.userData}/facturas`;

          if (api.ensureDir) {
            await api.ensureDir(defaultPath);
          }

          updatedSettings.ruta_pdf = defaultPath;
        }
      }

      // Log what we're saving for debugging
      console.log('Saving settings:', JSON.stringify(updatedSettings, null, 2));

      // Save to database
      const result = await saveSettings(updatedSettings);

      // Verify the save was successful
      if (result) {
        addAlert('Configuración guardada con éxito');

        // Update the thermal print service with the new printer
        thermalPrintService.setActivePrinter(updatedSettings.impresora_termica);
      } else {
        throw new Error('No se recibió respuesta del servidor');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      addAlert(`Error al guardar configuración: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Convert File to base64
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('FileReader did not return a string'));
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Logout confirmation
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

  // Return to home
  const handleGoBack = () => {
    const event = new CustomEvent('componentChange', {
      detail: { component: 'Home' }
    });
    window.dispatchEvent(event);
  };

  // Open PDF folder
  const handleOpenFolder = async () => {
    try {
      const api = window.api;

      if (!api?.getAppPaths) {
        throw new Error("La API no está disponible");
      }

      // Define path for invoices
      const paths = await api.getAppPaths();
      const docsPath = paths.documents;
      const facturaPath = formData.ruta_pdf || `${docsPath}/WilPOS/Facturas`;

      // Ensure directory exists
      if (api.ensureDir) {
        const dirResult = await api.ensureDir(facturaPath);
        if (!dirResult.success) {
          throw new Error(`No se pudo crear la carpeta: ${dirResult.error}`);
        }
      }

      // Update path in form if needed
      if (!formData.ruta_pdf) {
        setFormData(prev => ({
          ...prev,
          ruta_pdf: facturaPath
        }));
      }

      // Open folder
      if (api.openFolder) {
        await api.openFolder(facturaPath);
        addAlert('Carpeta de facturas abierta correctamente');
      } else {
        addAlert(`Ruta de facturas: ${facturaPath}`);
      }

    } catch (error) {
      console.error('Error al abrir carpeta:', error);
      addAlert(`No se pudo abrir la carpeta: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Show confirmation dialog
  const showConfirmDialog = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'danger' | 'info' = 'warning') => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
      type
    });
  };

  // Alert component
  const Alert = ({ type, message }: { type: AlertType; message: string }) => {
    const colors = {
      success: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', icon: Check },
      warning: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', icon: AlertTriangle },
      error: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', icon: X },
      info: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', icon: Info }
    };

    const style = colors[type] || colors.info;
    const Icon = style.icon;

    return (
      <div className={`${style.bg} ${style.text} ${style.border} border p-4 rounded-lg flex items-start mb-4`}>
        <Icon className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
        <div className="flex-grow">{message}</div>
        <button onClick={() => setAlerts(prev => prev.filter(a => a !== message))} className="ml-2 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  // Render tab content
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
            <h2 className="text-lg font-medium text-gray-800 mb-4">Configuración de Impresoras</h2>

            {/* Invoice Printer */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <Printer className="h-5 w-5 text-blue-600" />
                <h3 className="font-medium text-blue-800">Impresora de Facturas</h3>
              </div>

              <div className="space-y-4">
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
                    onClick={() => handleTestPrinter(formData.impresora_termica)}
                    disabled={!formData.impresora_termica || !canEditSettings}
                    className={`px-4 py-2 rounded-lg ${!formData.impresora_termica || !canEditSettings
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                  >
                    Probar
                  </button>
                </div>

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
                </div>

                {/* Printer Options */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="auto_cut"
                      name="auto_cut"
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      checked={formData.auto_cut !== false}
                      onChange={(e) => setFormData({ ...formData, auto_cut: e.target.checked })}
                      disabled={!canEditSettings}
                    />
                    <label htmlFor="auto_cut" className="ml-2 block text-sm text-gray-700">
                      Corte automático
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="open_cash_drawer"
                      name="open_cash_drawer"
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      checked={formData.open_cash_drawer === true}
                      onChange={(e) => setFormData({ ...formData, open_cash_drawer: e.target.checked })}
                      disabled={!canEditSettings}
                    />
                    <label htmlFor="open_cash_drawer" className="ml-2 block text-sm text-gray-700">
                      Abrir cajón al imprimir
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Barcode Printer */}
            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-100">
              <div className="flex items-center gap-2 mb-3">
                <Barcode className="h-5 w-5 text-green-600" />
                <h3 className="font-medium text-green-800">Impresora de Etiquetas/Códigos</h3>
              </div>

              <div className="space-y-4">
                <div className="flex space-x-2">
                  <select
                    id="impresora_etiquetas"
                    name="impresora_etiquetas"
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={formData.impresora_etiquetas || ''}
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
                    onClick={() => handleTestPrinter(formData.impresora_etiquetas)}
                    disabled={!formData.impresora_etiquetas || !canEditSettings}
                    className={`px-4 py-2 rounded-lg ${!formData.impresora_etiquetas || !canEditSettings
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                  >
                    Probar
                  </button>
                </div>

                <div className="text-sm text-gray-600">
                  <p>Esta impresora se utilizará para imprimir etiquetas de productos y códigos de barras.</p>
                  <p className="mt-1">Recomendamos usar una impresora de etiquetas especializada para mejor calidad.</p>
                </div>
              </div>
            </div>


            {/* PDF Configuration */}
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

            {/* Diagnostics buttons */}
            {canConfigurePrinter && (
              <div className="border-t pt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() => testPrinter('diagnostic')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Ejecutar Diagnóstico
                </button>

                <button
                  type="button"
                  onClick={() => testPrinter('full')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Test Completo
                </button>
              </div>
            )}
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
          {alerts.map((alert, index) => (
            <Alert key={index} type="info" message={alert} />
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
        {settingsLoading ? (
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