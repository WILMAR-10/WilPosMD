// src/components/PrinterConfig.tsx - Configuración de impresoras mejorada con guardado en DB

import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer, Settings, AlertTriangle, RotateCcw, 
  DollarSign, Package, Check, X, TestTube,
  Loader, CheckCircle, XCircle, Info
} from 'lucide-react';
import { useSettings } from '../services/DatabaseService';

interface Printer {
  name: string;
  isDefault: boolean;
  status: string;
  isThermal: boolean;
  paperWidth?: number;
}

interface PrinterConfigProps {
  className?: string;
}

const PrinterConfig: React.FC<PrinterConfigProps> = ({ className = '' }) => {
  // Estados principales
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');
  
  // Estados de configuración
  const [selectedInvoice, setSelectedInvoice] = useState<string>('');
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  
  // Estados de UI
  const [isSaving, setIsSaving] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  // Hook de configuración
  const { settings, saveSettings } = useSettings();

  // Cargar configuración actual desde la BD
  useEffect(() => {
    if (settings) {
      setSelectedInvoice(settings.impresora_termica || '');
      setSelectedLabel(settings.impresora_etiquetas || '');
    }
  }, [settings]);

  // Cargar impresoras al montar
  useEffect(() => {
    loadPrinters();
  }, []);

  // Función para mostrar mensajes temporales
  const showMessage = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  }, []);

  // Limpiar error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Cargar lista de impresoras
  const loadPrinters = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Verificar disponibilidad de API
      if (!window.printerAPI) {
        throw new Error('API de impresión no disponible');
      }

      const result = await window.printerAPI.getPrinters();
      
      if (result.success && Array.isArray(result.printers)) {
        setPrinters(result.printers);
        
        if (result.printers.length === 0) {
          showMessage('⚠️ No se encontraron impresoras conectadas');
        } else {
          showMessage(`✅ ${result.printers.length} impresora(s) encontrada(s)`);
        }
      } else {
        throw new Error(result.error || 'No se pudieron obtener las impresoras');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error cargando impresoras:', err);
      setError(`Error al cargar impresoras: ${errorMsg}`);
      setPrinters([]);
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  // Probar impresora
  const handleTestPrinter = async (printerName: string, type: 'print' | 'drawer') => {
    if (!printerName) {
      showMessage('❌ Selecciona una impresora para probar');
      return;
    }

    const testKey = `${printerName}_${type}`;
    setTesting(prev => ({ ...prev, [testKey]: true }));

    try {
      let result;
      
      if (type === 'print') {
        result = await window.printerAPI.testPrinter(printerName);
      } else {
        result = await window.printerAPI.openCashDrawer(printerName);
      }

      if (result.success) {
        showMessage(`✅ ${type === 'print' ? 'Prueba de impresión' : 'Cajón'} ejecutado correctamente en ${printerName}`);
      } else {
        showMessage(`❌ Error en ${printerName}: ${result.error || 'Operación fallida'}`);
      }
    } catch (err) {
      console.error(`Error testing ${type}:`, err);
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      showMessage(`❌ Error probando ${printerName}: ${errorMsg}`);
    } finally {
      setTesting(prev => ({ ...prev, [testKey]: false }));
    }
  };

  // Guardar configuración en la base de datos
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      if (!settings) {
        throw new Error('No se pueden cargar las configuraciones actuales');
      }

      // Preparar configuración actualizada
      const updatedSettings = {
        ...settings,
        impresora_termica: selectedInvoice || '',
        impresora_etiquetas: selectedLabel || ''
      };

      // Guardar en la base de datos usando el hook
      const result = await saveSettings(updatedSettings);
      
      if (result) {
        showMessage('✅ Configuración de impresoras guardada correctamente');

        // Disparar evento de sincronización para otros componentes
        const syncEvent = new CustomEvent('printer-config-updated', {
          detail: {
            invoicePrinter: selectedInvoice,
            labelPrinter: selectedLabel
          }
        });
        window.dispatchEvent(syncEvent);

      } else {
        throw new Error('No se recibió confirmación del guardado');
      }
    } catch (err) {
      console.error('Error saving printer config:', err);
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      showMessage(`❌ Error al guardar: ${errorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Refrescar impresoras
  const handleRefresh = () => {
    clearError();
    loadPrinters();
    showMessage('🔄 Actualizando lista de impresoras...');
  };

  // Filtrar impresoras por tipo
  const thermalPrinters = printers.filter(p => p.isThermal);
  const regularPrinters = printers.filter(p => !p.isThermal);

  // Verificar si hay cambios pendientes
  const hasChanges = () => {
    return (selectedInvoice !== (settings?.impresora_termica || '')) ||
           (selectedLabel !== (settings?.impresora_etiquetas || ''));
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Mensaje de estado */}
      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm flex items-center gap-2">
          <Info className="h-4 w-4 flex-shrink-0" />
          {message}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="flex-grow">{error}</div>
          <button 
            onClick={handleRefresh}
            className="text-red-600 hover:text-red-800 underline text-xs"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center p-6">
          <Loader className="animate-spin h-6 w-6 text-blue-500" />
          <span className="ml-3 text-gray-600">Cargando impresoras...</span>
        </div>
      )}

      {/* Configuración principal */}
      {!loading && (
        <div className="space-y-6">
          {/* Header con botón refrescar */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuración de Impresoras
            </h3>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Actualizar
            </button>
          </div>

          {/* Información del sistema */}
          <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
            <div className="flex items-center gap-2 mb-2">
              <Printer className="h-4 w-4" />
              <span className="font-medium">Estado del Sistema</span>
            </div>
            <div className="space-y-1">
              <div>• Impresoras disponibles: {printers.length}</div>
              <div>• Impresoras térmicas: {thermalPrinters.length}</div>
              <div>• API de impresión: {window.printerAPI ? 'Disponible' : 'No disponible'}</div>
            </div>
          </div>

          {printers.length > 0 && (
            <>
              {/* Configuración de impresora para facturas */}
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <h4 className="font-medium text-gray-800">Impresora para Facturas</h4>
                </div>
                
                <div className="space-y-4">
                  <select
                    value={selectedInvoice}
                    onChange={(e) => setSelectedInvoice(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar impresora...</option>
                    {thermalPrinters.length > 0 && (
                      <optgroup label="🔥 Impresoras Térmicas (Recomendadas)">
                        {thermalPrinters.map((printer) => (
                          <option key={printer.name} value={printer.name}>
                            {printer.name} {printer.isDefault ? '(Por defecto)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {regularPrinters.length > 0 && (
                      <optgroup label="🖨️ Impresoras Regulares">
                        {regularPrinters.map((printer) => (
                          <option key={printer.name} value={printer.name}>
                            {printer.name} {printer.isDefault ? '(Por defecto)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  {/* Botones de prueba para factura */}
                  {selectedInvoice && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTestPrinter(selectedInvoice, 'print')}
                        disabled={testing[`${selectedInvoice}_print`]}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {testing[`${selectedInvoice}_print`] ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                        Probar Impresión
                      </button>
                      
                      <button
                        onClick={() => handleTestPrinter(selectedInvoice, 'drawer')}
                        disabled={testing[`${selectedInvoice}_drawer`]}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {testing[`${selectedInvoice}_drawer`] ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <Package className="h-4 w-4" />
                        )}
                        Abrir Cajón
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Configuración de impresora para etiquetas */}
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="h-5 w-5 text-blue-600" />
                  <h4 className="font-medium text-gray-800">Impresora para Etiquetas (Opcional)</h4>
                </div>
                
                <div className="space-y-4">
                  <select
                    value={selectedLabel}
                    onChange={(e) => setSelectedLabel(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar impresora...</option>
                    {thermalPrinters.length > 0 && (
                      <optgroup label="🔥 Impresoras Térmicas (Recomendadas)">
                        {thermalPrinters.map((printer) => (
                          <option key={printer.name} value={printer.name}>
                            {printer.name} {printer.isDefault ? '(Por defecto)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {regularPrinters.length > 0 && (
                      <optgroup label="🖨️ Impresoras Regulares">
                        {regularPrinters.map((printer) => (
                          <option key={printer.name} value={printer.name}>
                            {printer.name} {printer.isDefault ? '(Por defecto)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  {/* Botón de prueba para etiquetas */}
                  {selectedLabel && (
                    <button
                      onClick={() => handleTestPrinter(selectedLabel, 'print')}
                      disabled={testing[`${selectedLabel}_print`]}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {testing[`${selectedLabel}_print`] ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                      Probar Etiqueta
                    </button>
                  )}
                </div>
              </div>

              {/* Estado actual */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-3">Estado Actual</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Impresora de facturas:</span>
                    <span className={`font-medium flex items-center gap-1 ${
                      selectedInvoice ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {selectedInvoice ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          {selectedInvoice}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          No configurada
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Impresora de etiquetas:</span>
                    <span className={`font-medium flex items-center gap-1 ${
                      selectedLabel ? 'text-green-700' : 'text-gray-500'
                    }`}>
                      {selectedLabel ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          {selectedLabel}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          No configurada
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botón guardar */}
              <button
                onClick={handleSave}
                disabled={isSaving || !hasChanges()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    {hasChanges() ? 'Guardar Cambios' : 'Configuración Guardada'}
                  </>
                )}
              </button>
            </>
          )}

          {/* Mensaje si no hay impresoras */}
          {!loading && printers.length === 0 && (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-800 mb-2">No hay impresoras disponibles</h3>
              <p className="text-gray-600 mb-4">
                Asegúrate de que las impresoras estén conectadas y encendidas.
              </p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Buscar de nuevo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PrinterConfig;