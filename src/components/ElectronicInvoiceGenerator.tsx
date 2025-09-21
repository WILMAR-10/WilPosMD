// src/components/ElectronicInvoiceGenerator.tsx - Generador de Facturas Electrónicas integrado
import React, { useState, useEffect } from 'react';
import {
  FileText, Send, CheckCircle, AlertTriangle, Clock,
  Eye, Download, RefreshCw, Shield, ExternalLink,
  X, Info, Loader, Globe, Key, Building2
} from 'lucide-react';

interface Sale {
  id: number;
  total: number;
  fecha_venta: string;
  cliente: string;
  metodo_pago: string;
  detalles: SaleItem[];
  impuestos: number;
  descuento: number;
  estado: string;
}

interface SaleItem {
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface ElectronicInvoice {
  id?: number;
  venta_id: number;
  ncf_electronico: string;
  estado: 'PENDIENTE' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'ERROR';
  fecha_emision: string;
  codigo_seguimiento?: string;
  tipo_comprobante: string;
}

interface ElectronicInvoiceGeneratorProps {
  sale: Sale;
  onClose: () => void;
  onGenerated: (invoice: ElectronicInvoice) => void;
}

const ElectronicInvoiceGenerator: React.FC<ElectronicInvoiceGeneratorProps> = ({
  sale,
  onClose,
  onGenerated
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [electronicInvoice, setElectronicInvoice] = useState<ElectronicInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invoiceType, setInvoiceType] = useState('01'); // Factura de Crédito Fiscal por defecto
  const [certificateStatus, setCertificateStatus] = useState({
    available: false,
    valid: false,
    expiryDate: null as string | null
  });

  useEffect(() => {
    checkCertificateStatus();
    checkExistingInvoice();
  }, [sale.id]);

  const checkCertificateStatus = async () => {
    try {
      // En implementación real, esto verificaría el estado del certificado
      const mockStatus = {
        available: true,
        valid: true,
        expiryDate: '2025-09-30'
      };
      
      setCertificateStatus(mockStatus);
    } catch (error) {
      console.error('Error verificando certificado:', error);
    }
  };

  const checkExistingInvoice = async () => {
    try {
      // Verificar si ya existe una factura electrónica para esta venta
      // En implementación real, esto consultaría la base de datos
      const existingInvoice = null; // await FacturacionElectronicaDAO.getByVentaId(sale.id);
      
      if (existingInvoice) {
        setElectronicInvoice(existingInvoice);
      }
    } catch (error) {
      console.error('Error verificando factura existente:', error);
    }
  };

  const generateElectronicInvoice = async () => {
    if (!certificateStatus.available || !certificateStatus.valid) {
      setError('Certificado digital no disponible o no válido');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCurrentStep(0);

    try {
      // Paso 1: Validar datos de la venta
      setCurrentStep(1);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!sale.detalles || sale.detalles.length === 0) {
        throw new Error('La venta debe tener productos para generar factura electrónica');
      }

      // Paso 2: Generar NCF electrónico
      setCurrentStep(2);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const sequence = Math.floor(Math.random() * 1000000) + 1;
      const ncf = `E${invoiceType}${sequence.toString().padStart(10, '0')}`;

      // Paso 3: Construir estructura del e-CF
      setCurrentStep(3);
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const invoiceData = {
        venta_id: sale.id,
        ncf_electronico: ncf,
        tipo_comprobante: invoiceType,
        estado: 'PENDIENTE' as const,
        fecha_emision: new Date().toISOString(),
        xml_data: generateInvoiceXML(sale, ncf)
      };

      // Paso 4: Firmar digitalmente
      setCurrentStep(4);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const signedXML = await signElectronically(invoiceData.xml_data);

      // Paso 5: Enviar a DGII (simulado)
      setCurrentStep(5);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const trackingCode = `TRK${Date.now()}`;
      
      // Simular respuesta exitosa de DGII
      const finalInvoice: ElectronicInvoice = {
        id: Math.floor(Math.random() * 10000),
        venta_id: sale.id,
        ncf_electronico: ncf,
        estado: 'ENVIADA',
        fecha_emision: invoiceData.fecha_emision,
        codigo_seguimiento: trackingCode,
        tipo_comprobante: invoiceType
      };

      setElectronicInvoice(finalInvoice);
      onGenerated(finalInvoice);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsGenerating(false);
      setCurrentStep(0);
    }
  };

  const generateInvoiceXML = (saleData: Sale, ncf: string): string => {
    // Generar XML básico según especificaciones DGII
    return `<?xml version="1.0" encoding="UTF-8"?>
<eCF xmlns="http://dgii.gov.do/ecf/v1.0">
  <Header>
    <NCF>${ncf}</NCF>
    <InvoiceType>${invoiceType}</InvoiceType>
    <IssueDate>${new Date().toISOString()}</IssueDate>
    <Currency>DOP</Currency>
  </Header>
  <Issuer>
    <BusinessName>WilPOS Business</BusinessName>
  </Issuer>
  <Receiver>
    <Name>${saleData.cliente}</Name>
  </Receiver>
  <Items>
    ${saleData.detalles.map((item, index) => `
    <Item>
      <LineNumber>${index + 1}</LineNumber>
      <Description>${item.name}</Description>
      <Quantity>${item.quantity}</Quantity>
      <UnitPrice>${item.price}</UnitPrice>
      <TotalAmount>${item.subtotal}</TotalAmount>
    </Item>`).join('')}
  </Items>
  <Totals>
    <Subtotal>${saleData.total - saleData.impuestos}</Subtotal>
    <TaxAmount>${saleData.impuestos}</TaxAmount>
    <TotalAmount>${saleData.total}</TotalAmount>
  </Totals>
</eCF>`;
  };

  const signElectronically = async (xmlData: string): Promise<string> => {
    // Simular firma digital
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const signature = btoa(xmlData).slice(0, 64); // Simulado
    
    return xmlData.replace('</eCF>', `
  <Signature>
    <SignatureValue>${signature}</SignatureValue>
    <SigningTime>${new Date().toISOString()}</SigningTime>
  </Signature>
</eCF>`);
  };

  const openFreeInvoicer = () => {
    window.open('https://fg.dgii.gov.do/ecf/PortalFG/login', '_blank');
  };

  const downloadXML = () => {
    if (!electronicInvoice) return;

    const xmlContent = generateInvoiceXML(sale, electronicInvoice.ncf_electronico);
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${electronicInvoice.ncf_electronico}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const steps = [
    'Validando datos de venta',
    'Generando NCF electrónico',
    'Construyendo estructura e-CF',
    'Firmando digitalmente',
    'Enviando a DGII'
  ];

  const invoiceTypes = {
    '01': 'Factura de Crédito Fiscal',
    '02': 'Factura de Consumo',
    '03': 'Nota de Débito',
    '04': 'Nota de Crédito',
    '11': 'Factura de Regímenes Especiales',
    '12': 'Factura Gubernamental',
    '13': 'Factura para Exportaciones',
    '14': 'Factura Especial',
    '15': 'Factura de Compras'
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'APROBADA': return 'text-green-700 bg-green-50 border-green-200';
      case 'ENVIADA': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'PENDIENTE': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'RECHAZADA': return 'text-red-700 bg-red-50 border-red-200';
      case 'ERROR': return 'text-red-700 bg-red-50 border-red-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Generar Factura Electrónica</h2>
              <p className="text-gray-600">Venta #{sale.id} - {sale.cliente}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Estado del certificado */}
          <div className={`p-4 rounded-lg border ${
            certificateStatus.available && certificateStatus.valid
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center gap-3">
              <Shield className={`h-5 w-5 ${
                certificateStatus.available && certificateStatus.valid
                  ? 'text-green-600'
                  : 'text-red-600'
              }`} />
              <div>
                <p className={`font-medium ${
                  certificateStatus.available && certificateStatus.valid
                    ? 'text-green-800'
                    : 'text-red-800'
                }`}>
                  {certificateStatus.available && certificateStatus.valid
                    ? 'Certificado Digital Válido'
                    : 'Certificado Digital No Disponible'
                  }
                </p>
                {certificateStatus.expiryDate && (
                  <p className="text-sm opacity-75">
                    Válido hasta: {new Date(certificateStatus.expiryDate).toLocaleDateString('es-DO')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Selección de tipo de comprobante */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Comprobante Fiscal Electrónico
            </label>
            <select
              value={invoiceType}
              onChange={(e) => setInvoiceType(e.target.value)}
              disabled={isGenerating || !!electronicInvoice}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            >
              {Object.entries(invoiceTypes).map(([code, name]) => (
                <option key={code} value={code}>
                  {code} - {name}
                </option>
              ))}
            </select>
          </div>

          {/* Resumen de la venta */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-800 mb-3">Resumen de la Venta</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Fecha:</span>
                <span className="ml-2 font-medium">
                  {new Date(sale.fecha_venta).toLocaleDateString('es-DO')}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Método de Pago:</span>
                <span className="ml-2 font-medium">{sale.metodo_pago}</span>
              </div>
              <div>
                <span className="text-gray-600">Subtotal:</span>
                <span className="ml-2 font-medium">
                  RD$ {(sale.total - sale.impuestos).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">ITEBIS:</span>
                <span className="ml-2 font-medium">RD$ {sale.impuestos.toFixed(2)}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600">Total:</span>
                <span className="ml-2 font-bold text-lg">RD$ {sale.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Estado de la factura electrónica existente */}
          {electronicInvoice && (
            <div className={`p-4 rounded-lg border ${getStatusColor(electronicInvoice.estado)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {electronicInvoice.estado === 'APROBADA' && <CheckCircle className="h-5 w-5" />}
                  {electronicInvoice.estado === 'ENVIADA' && <Clock className="h-5 w-5" />}
                  {electronicInvoice.estado === 'PENDIENTE' && <Clock className="h-5 w-5" />}
                  {(electronicInvoice.estado === 'RECHAZADA' || electronicInvoice.estado === 'ERROR') && <AlertTriangle className="h-5 w-5" />}
                  
                  <div>
                    <p className="font-medium">
                      Factura Electrónica {electronicInvoice.estado}
                    </p>
                    <p className="text-sm opacity-75">
                      NCF: {electronicInvoice.ncf_electronico}
                    </p>
                    {electronicInvoice.codigo_seguimiento && (
                      <p className="text-sm opacity-75">
                        Código de Seguimiento: {electronicInvoice.codigo_seguimiento}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={downloadXML}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                    title="Descargar XML"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={openFreeInvoicer}
                    className="p-2 text-gray-600 hover:text-gray-800 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                    title="Ver en Facturador DGII"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Progreso de generación */}
          {isGenerating && (
            <div className="space-y-4">
              <div className="text-center">
                <Loader className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-gray-600">Generando factura electrónica...</p>
              </div>
              
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      index < currentStep ? 'bg-green-100 text-green-600' :
                      index === currentStep ? 'bg-blue-100 text-blue-600' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {index < currentStep ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : index === currentStep ? (
                        <Loader className="h-3 w-3 animate-spin" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <span className={`text-sm ${
                      index < currentStep ? 'text-green-700' :
                      index === currentStep ? 'text-blue-700' :
                      'text-gray-500'
                    }`}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">Error generando factura electrónica</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Información importante */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Información Importante</p>
                <ul className="space-y-1 text-blue-700">
                  <li>• La factura electrónica se enviará automáticamente a DGII</li>
                  <li>• Puede tomar unos minutos recibir la aprobación</li>
                  <li>• El XML firmado estará disponible para descarga</li>
                  <li>• Mantenga una copia del código de seguimiento</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-between">
          <button
            onClick={openFreeInvoicer}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Globe className="h-4 w-4" />
            Abrir Facturador DGII
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cerrar
            </button>
            
            {!electronicInvoice && certificateStatus.available && certificateStatus.valid && (
              <button
                onClick={generateElectronicInvoice}
                disabled={isGenerating}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Generar e-CF
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectronicInvoiceGenerator;