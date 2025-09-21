// src/components/PrinterConfig.tsx - Componente actualizado con guardado de configuración
import React, { useState, useEffect } from 'react';
import {
  Printer, TestTube, Check, AlertTriangle, RotateCcw, 
  DollarSign, Tag, Archive, Settings, Save
} from 'lucide-react';
import { usePrinter } from '../hooks/usePrinter';
import { useSettings } from '../services/DatabaseService';

interface PrinterConfigProps {
  className?: string;
  onConfigSave?: (config: { invoicePrinter: string; labelPrinter: string }) => void;
}

const PrinterConfig: React.FC<PrinterConfigProps> = ({ 
  className = '',
  onConfigSave 
}) => {
  const {
    printers,
    loading,
    error,
    invoicePrinter,
    labelPrinter,
    refreshPrinters,
    testPrinter,
    openCashDrawer,
    clearError
  } = usePrinter();

  const { settings, saveSettings } = useSettings();

  const [selectedInvoice, setSelectedInvoice] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sincronizar con configuración actual
  useEffect(() => {
    setSelectedInvoice(invoicePrinter || '');
    setSelectedLabel(labelPrinter || '');
  }, [invoicePrinter, labelPrinter]);

  const showMessage = (msg: string, duration: number = 3000) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), duration);
  };

  const handleTest = async (printerName: string, type: 'print' | 'drawer') => {
    if (!printerName) {
      showMessage('❌ Selecciona una impresora primero');
      return;
    }

    setTesting(prev => ({ ...prev, [`${printerName}_${type}`]: true }));
    
    try {
      const result = type === 'print' 
        ? await testPrinter(printerName)
        : await openCashDrawer(printerName);
        
      if (result.success) {
        showMessage(`✅ ${type === 'print' ? 'Impresión de prueba' : 'Cajón'} ejecutado correctamente`);
      } else {
        showMessage(`❌ Error: ${result.error || 'Operación fallida'}`);
      }
    } catch (err) {
      console.error(`Error testing ${type}:`, err);
      showMessage(`❌ Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setTesting(prev => ({ ...prev, [`${printerName}_${type}`]: false }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      if (!settings) {
        throw new Error('No se pueden cargar las configuraciones actuales');
      }

      // Preparar la configuración actualizada
      const updatedSettings = {
        ...settings,
        impresora_termica: selectedInvoice || '',
        impresora_etiquetas: selectedLabel || ''
      };

      // Guardar en la base de datos
      const result = await saveSettings(updatedSettings);
      
      if (result) {
        showMessage('✅ Configuración de impresoras guardada correctamente');
        
        // Notificar al componente padre si está disponible
        if (onConfigSave) {
          onConfigSave({
            invoicePrinter: selectedInvoice,
            labelPrinter: selectedLabel
          });
        }

        // Disparar evento de sincronización para actualizar otros componentes
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
      showMessage(`❌ Error al guardar: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = () => {
    clearError();
    refreshPrinters();
    showMessage('🔄 Actualizando lista de impresoras...');
  };

  // Filtrar impresoras por tipo
  const thermalPrinters = printers.filter(p => p.isThermal);
  const regularPrinters = printers.filter(p => !p.isThermal);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Mensaje de estado */}
      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
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
          <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="ml-3 text-gray-600">Cargando impresoras...</span>
        </div>
      )}

      {/* Configuración principal */}
      {!loading && (
        <div className="space-y-6">
          {/* Header con botón refrescar */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-800">Seleccionar Impresoras</h3>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Actualizar
            </button>
          </div>

          {/* Configuración de impresora para facturas */}
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-5 w-5 text-green-600" />
              <h4 className="font-medium text-gray-800">Impresora para Facturas</h4>
            </div>
            
            <div className="space-y-3">
              <select
                value={selectedInvoice}
                onChange={(e) => setSelectedInvoice(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar impresora...</option>
                <optgroup label="Impresoras Térmicas (Recomendadas)">
                  {thermalPrinters.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name} {printer.isDefault ? '(Por defecto)' : ''}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Impresoras Regulares">
                  {regularPrinters.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name} {printer.isDefault ? '(Por defecto)' : ''}
                    </option>
                  ))}
                </optgroup>
              </select>

              {selectedInvoice && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTest(selectedInvoice, 'print')}
                    disabled={testing[`${selectedInvoice}_print`]}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {testing[`${selectedInvoice}_print`] ? (
                      <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full" />
                    ) : (
                      <TestTube className="h-3 w-3" />
                    )}
                    Probar Factura
                  </button>

                  <button
                    onClick={() => handleTest(selectedInvoice, 'drawer')}
                    disabled={testing[`${selectedInvoice}_drawer`]}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {testing[`${selectedInvoice}_drawer`] ? (
                      <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full" />
                    ) : (
                      <Archive className="h-3 w-3" />
                    )}
                    Abrir Cajón
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Configuración de impresora para etiquetas */}
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-5 w-5 text-purple-600" />
              <h4 className="font-medium text-gray-800">Impresora para Etiquetas</h4>
            </div>
            
            <div className="space-y-3">
              <select
                value={selectedLabel}
                onChange={(e) => setSelectedLabel(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar impresora...</option>
                <optgroup label="Impresoras Térmicas (Recomendadas)">
                  {thermalPrinters.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name} {printer.isDefault ? '(Por defecto)' : ''}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Impresoras Regulares">
                  {regularPrinters.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name} {printer.isDefault ? '(Por defecto)' : ''}
                    </option>
                  ))}
                </optgroup>
              </select>

              {selectedLabel && (
                <button
                  onClick={() => handleTest(selectedLabel, 'print')}
                  disabled={testing[`${selectedLabel}_print`]}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  {testing[`${selectedLabel}_print`] ? (
                    <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full" />
                  ) : (
                    <TestTube className="h-3 w-3" />
                  )}
                  Probar Etiqueta
                </button>
              )}
            </div>
          </div>

          {/* Información de impresoras disponibles */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Impresoras Detectadas ({printers.length})
            </h4>
            
            {printers.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <Printer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No se encontraron impresoras</p>
                <button 
                  onClick={handleRefresh}
                  className="mt-2 text-blue-600 hover:text-blue-800 underline text-sm"
                >
                  Actualizar lista
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {printers.map((printer, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex items-center gap-2">
                      <Printer className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">{printer.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {printer.isThermal && (
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                          Térmica
                        </span>
                      )}
                      {printer.isDefault && (
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                          Por defecto
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded text-xs ${
                        printer.status === 'ready' ? 'bg-green-100 text-green-700' : 
                        printer.status === 'offline' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {printer.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón guardar configuración */}
          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Guardar Configuración</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrinterConfig;