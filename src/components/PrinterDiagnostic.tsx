// src/components/PrinterDiagnostic.tsx - Componente de diagnóstico de impresoras
import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Settings,
  Monitor,
  Printer,
  Wifi,
  Usb
} from 'lucide-react';

interface DiagnosticInfo {
  apis: {
    printerAPI: boolean;
    printerApi: boolean;
    printApi: boolean;
  };
  system: {
    platform: string;
    userAgent: string;
    online: boolean;
  };
  electron: {
    available: boolean;
    versions?: {
      electron?: string;
      node?: string;
      chrome?: string;
    };
  };
}

interface PrinterDiagnosticProps {
  onRefresh?: () => void;
  loading?: boolean;
}

const PrinterDiagnostic: React.FC<PrinterDiagnosticProps> = ({ 
  onRefresh, 
  loading = false 
}) => {
  const [diagnosticInfo, setDiagnosticInfo] = useState<DiagnosticInfo | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    runDiagnostic();
  }, []);

  const runDiagnostic = () => {
    const info: DiagnosticInfo = {
      apis: {
        printerAPI: !!window.printerAPI,
        printerApi: !!window.printerApi,
        printApi: !!window.printApi
      },
      system: {
        platform: navigator.platform || 'Desconocido',
        userAgent: navigator.userAgent || 'Desconocido',
        online: navigator.onLine
      },
      electron: {
        available: !!window.versions,
        versions: window.versions ? {
          electron: window.versions.electron?.(),
          node: window.versions.node?.(),
          chrome: window.versions.chrome?.()
        } : undefined
      }
    };

    setDiagnosticInfo(info);
  };

  const getApiStatus = () => {
    if (!diagnosticInfo) return 'unknown';
    
    const { apis } = diagnosticInfo;
    if (apis.printerAPI || apis.printerApi || apis.printApi) {
      return 'available';
    }
    return 'unavailable';
  };

  const getSystemStatus = () => {
    if (!diagnosticInfo) return 'unknown';
    
    const { electron, system } = diagnosticInfo;
    if (electron.available && system.online) {
      return 'healthy';
    } else if (electron.available) {
      return 'warning';
    }
    return 'error';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'unavailable':
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
      case 'healthy':
        return 'border-green-200 bg-green-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'unavailable':
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const handleRefresh = () => {
    runDiagnostic();
    if (onRefresh) {
      onRefresh();
    }
  };

  if (!diagnosticInfo) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm text-gray-600">Ejecutando diagnóstico...</span>
        </div>
      </div>
    );
  }

  const apiStatus = getApiStatus();
  const systemStatus = getSystemStatus();

  return (
    <div className={`border rounded-lg ${getStatusColor(apiStatus)}`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-600" />
            <h4 className="font-medium text-gray-800">Diagnóstico del Sistema</h4>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-1 rounded hover:bg-gray-200 transition-colors"
              title="Actualizar diagnóstico"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {expanded ? 'Ocultar' : 'Ver detalles'}
            </button>
          </div>
        </div>

        {/* Status Summary */}
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            {getStatusIcon(apiStatus)}
            <div>
              <div className="text-sm font-medium text-gray-800">APIs de Impresión</div>
              <div className="text-xs text-gray-600">
                {apiStatus === 'available' ? 'Disponibles' : 'No disponibles'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {getStatusIcon(systemStatus)}
            <div>
              <div className="text-sm font-medium text-gray-800">Sistema</div>
              <div className="text-xs text-gray-600">
                {systemStatus === 'healthy' ? 'Saludable' : 
                 systemStatus === 'warning' ? 'Con advertencias' : 'Con errores'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Information */}
      {expanded && (
        <div className="border-t p-4 bg-white/50">
          <div className="space-y-4">
            {/* API Status */}
            <div>
              <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                <Printer className="h-4 w-4" />
                APIs de Impresión
              </h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>printerAPI:</span>
                  <span className={diagnosticInfo.apis.printerAPI ? 'text-green-600' : 'text-red-600'}>
                    {diagnosticInfo.apis.printerAPI ? '✅ Disponible' : '❌ No disponible'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>printerApi:</span>
                  <span className={diagnosticInfo.apis.printerApi ? 'text-green-600' : 'text-red-600'}>
                    {diagnosticInfo.apis.printerApi ? '✅ Disponible' : '❌ No disponible'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>printApi:</span>
                  <span className={diagnosticInfo.apis.printApi ? 'text-green-600' : 'text-red-600'}>
                    {diagnosticInfo.apis.printApi ? '✅ Disponible' : '❌ No disponible'}
                  </span>
                </div>
              </div>
            </div>

            {/* Electron Status */}
            <div>
              <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Entorno Electron
              </h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Electron disponible:</span>
                  <span className={diagnosticInfo.electron.available ? 'text-green-600' : 'text-red-600'}>
                    {diagnosticInfo.electron.available ? '✅ Sí' : '❌ No'}
                  </span>
                </div>
                {diagnosticInfo.electron.versions && (
                  <>
                    <div className="flex justify-between">
                      <span>Versión Electron:</span>
                      <span className="text-gray-600">{diagnosticInfo.electron.versions.electron || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Versión Node:</span>
                      <span className="text-gray-600">{diagnosticInfo.electron.versions.node || 'N/A'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* System Status */}
            <div>
              <h5 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                Sistema
              </h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Plataforma:</span>
                  <span className="text-gray-600">{diagnosticInfo.system.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span>Conexión:</span>
                  <span className={diagnosticInfo.system.online ? 'text-green-600' : 'text-red-600'}>
                    {diagnosticInfo.system.online ? '✅ Online' : '❌ Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <h5 className="font-medium text-blue-800 mb-2">💡 Recomendaciones</h5>
              <ul className="text-sm text-blue-700 space-y-1">
                {!diagnosticInfo.apis.printerAPI && !diagnosticInfo.apis.printerApi && !diagnosticInfo.apis.printApi && (
                  <li>• Verificar que la aplicación Electron esté correctamente configurada</li>
                )}
                {!diagnosticInfo.electron.available && (
                  <li>• Esta aplicación debe ejecutarse en el entorno Electron</li>
                )}
                <li>• Asegurar que haya impresoras instaladas en el sistema</li>
                <li>• Verificar que las impresoras estén encendidas y conectadas</li>
                <li>• Reiniciar la aplicación si persisten los problemas</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrinterDiagnostic;