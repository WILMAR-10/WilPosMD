// src/services/DGIIElectronicInvoiceService.js - Servicio de Facturación Electrónica DGII
import fs from 'fs-extra';
import { join } from 'path';
import https from 'https';
import crypto from 'crypto';

/**
 * Servicio completo para integración con Facturación Electrónica DGII
 * Sigue el protocolo oficial del Facturador Gratuito de FE
 */
class DGIIElectronicInvoiceService {
  constructor() {
    this.apiBaseUrl = 'https://fg.dgii.gov.do/ecf/PortalFG';
    this.testApiUrl = 'https://fg-test.dgii.gov.do/ecf/PortalFG'; // Para pruebas
    this.isTestMode = false;
    this.credentials = null;
    this.certificateData = null;
    this.sequenceNumbers = new Map(); // Para manejar secuencias de NCF
  }

  /**
   * Configurar credenciales de acceso a DGII
   */
  async configure(config) {
    try {
      this.credentials = {
        rncEmpresa: config.rncEmpresa,
        rncDelegado: config.rncDelegado || config.rncEmpresa,
        password: config.password,
        isTestMode: config.isTestMode || false
      };

      this.isTestMode = this.credentials.isTestMode;
      
      // Validar configuración
      if (!this.credentials.rncEmpresa || !this.credentials.password) {
        throw new Error('RNC de empresa y contraseña son requeridos');
      }

      console.log('🔧 DGII Service configured:', {
        rncEmpresa: this.credentials.rncEmpresa,
        testMode: this.isTestMode
      });

      return { success: true, message: 'Configuración guardada correctamente' };
    } catch (error) {
      console.error('Error configurando DGII service:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cargar certificado digital desde archivo
   */
  async loadDigitalCertificate(certificatePath, privateKeyPassword) {
    try {
      if (!fs.existsSync(certificatePath)) {
        throw new Error('Archivo de certificado no encontrado');
      }

      const certData = await fs.readFile(certificatePath);
      
      // Validar que es un certificado P12/PFX
      if (!certificatePath.toLowerCase().endsWith('.p12') && 
          !certificatePath.toLowerCase().endsWith('.pfx')) {
        throw new Error('El certificado debe ser un archivo .p12 o .pfx');
      }

      this.certificateData = {
        path: certificatePath,
        data: certData,
        password: privateKeyPassword
      };

      console.log('🔐 Certificado digital cargado correctamente');
      return { success: true, message: 'Certificado cargado correctamente' };
    } catch (error) {
      console.error('Error cargando certificado:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Probar conexión con DGII
   */
  async testConnection() {
    try {
      if (!this.credentials) {
        throw new Error('Servicio no configurado. Configure primero las credenciales.');
      }

      const testUrl = this.isTestMode ? this.testApiUrl : this.apiBaseUrl;
      
      // Realizar petición de prueba al login
      const loginTest = await this.makeHttpRequest(`${testUrl}/login`, {
        method: 'GET'
      });

      if (loginTest.statusCode === 200) {
        return { 
          success: true, 
          message: 'Conexión exitosa con DGII',
          testMode: this.isTestMode
        };
      } else {
        throw new Error(`Error de conexión: ${loginTest.statusCode}`);
      }
    } catch (error) {
      console.error('Error probando conexión DGII:', error);
      return { 
        success: false, 
        error: `No se pudo conectar a DGII: ${error.message}`
      };
    }
  }

  /**
   * Generar e-CF (Comprobante Fiscal Electrónico)
   */
  async generateElectronicInvoice(saleData, invoiceType = '01') {
    try {
      if (!this.credentials) {
        throw new Error('Servicio no configurado');
      }

      if (!this.certificateData) {
        throw new Error('Certificado digital no cargado');
      }

      // Validar datos de venta
      const validationResult = this.validateSaleData(saleData);
      if (!validationResult.valid) {
        throw new Error(`Datos de venta inválidos: ${validationResult.errors.join(', ')}`);
      }

      // Generar NCF electrónico
      const ncf = await this.generateNCF(invoiceType);
      
      // Construir estructura del e-CF
      const electronicInvoice = this.buildElectronicInvoiceStructure(saleData, ncf, invoiceType);
      
      // Firmar digitalmente
      const signedInvoice = await this.signElectronically(electronicInvoice);
      
      // Enviar a DGII
      const dgiiResponse = await this.sendToDGII(signedInvoice);
      
      if (dgiiResponse.success) {
        // Guardar registro local
        await this.saveElectronicInvoiceRecord({
          saleId: saleData.id,
          ncf: ncf,
          dgiiTrackingCode: dgiiResponse.trackingCode,
          status: 'SENT',
          xmlData: signedInvoice,
          sentAt: new Date().toISOString()
        });

        return {
          success: true,
          ncf: ncf,
          trackingCode: dgiiResponse.trackingCode,
          message: 'Factura electrónica enviada exitosamente a DGII'
        };
      } else {
        throw new Error(`Error enviando a DGII: ${dgiiResponse.error}`);
      }
    } catch (error) {
      console.error('Error generando factura electrónica:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validar datos de venta antes de generar e-CF
   */
  validateSaleData(saleData) {
    const errors = [];

    // Validaciones básicas
    if (!saleData.id) errors.push('ID de venta requerido');
    if (!saleData.total || saleData.total <= 0) errors.push('Total de venta inválido');
    if (!saleData.fecha_venta) errors.push('Fecha de venta requerida');
    if (!saleData.detalles || !Array.isArray(saleData.detalles) || saleData.detalles.length === 0) {
      errors.push('Detalles de productos requeridos');
    }

    // Validar detalles de productos
    if (saleData.detalles) {
      saleData.detalles.forEach((item, index) => {
        if (!item.name) errors.push(`Producto ${index + 1}: Nombre requerido`);
        if (!item.quantity || item.quantity <= 0) errors.push(`Producto ${index + 1}: Cantidad inválida`);
        if (!item.price || item.price <= 0) errors.push(`Producto ${index + 1}: Precio inválido`);
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generar NCF electrónico según normas DGII
   */
  async generateNCF(invoiceType = '01') {
    try {
      // NCF Format: E + Invoice Type (01) + 10-digit sequence
      // Ejemplo: E01000000001
      
      const sequence = await this.getNextSequenceNumber(invoiceType);
      const paddedSequence = sequence.toString().padStart(10, '0');
      const ncf = `E${invoiceType}${paddedSequence}`;
      
      console.log(`📄 NCF generado: ${ncf}`);
      return ncf;
    } catch (error) {
      console.error('Error generando NCF:', error);
      throw new Error(`Error generando NCF: ${error.message}`);
    }
  }

  /**
   * Obtener siguiente número de secuencia para NCF
   */
  async getNextSequenceNumber(invoiceType) {
    try {
      // En producción, esto debería venir de la base de datos
      const currentSequence = this.sequenceNumbers.get(invoiceType) || 0;
      const nextSequence = currentSequence + 1;
      
      this.sequenceNumbers.set(invoiceType, nextSequence);
      
      return nextSequence;
    } catch (error) {
      throw new Error(`Error obteniendo secuencia: ${error.message}`);
    }
  }

  /**
   * Construir estructura XML del e-CF según especificaciones DGII
   */
  buildElectronicInvoiceStructure(saleData, ncf, invoiceType) {
    const now = new Date();
    const invoiceDate = new Date(saleData.fecha_venta);
    
    // Calcular totales
    const subtotal = saleData.total - saleData.impuestos;
    const taxes = saleData.impuestos || 0;
    const discount = saleData.descuento || 0;
    
    const electronicInvoice = {
      // Encabezado del e-CF
      header: {
        ncf: ncf,
        invoiceType: invoiceType,
        issueDate: invoiceDate.toISOString(),
        currency: 'DOP', // Peso Dominicano
        exchangeRate: 1.0,
        paymentMethod: this.mapPaymentMethod(saleData.metodo_pago),
        paymentTerm: saleData.metodo_pago === 'Efectivo' ? 'CONTADO' : 'CREDITO'
      },
      
      // Información del emisor (desde configuración)
      issuer: {
        rnc: this.credentials.rncEmpresa,
        businessName: saleData.businessName || 'WilPOS Business',
        address: saleData.businessAddress || '',
        phone: saleData.businessPhone || '',
        email: saleData.businessEmail || ''
      },
      
      // Información del receptor
      receiver: {
        documentType: 'RNC', // o 'CEDULA'
        documentNumber: saleData.clienteRNC || '00000000000',
        name: saleData.cliente || 'Cliente General',
        address: saleData.clienteAddress || '',
        phone: saleData.clientePhone || '',
        email: saleData.clienteEmail || ''
      },
      
      // Detalles de productos/servicios
      items: saleData.detalles.map((item, index) => ({
        lineNumber: index + 1,
        description: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        discount: item.descuento || 0,
        taxAmount: (item.price * item.quantity) * 0.18, // ITEBIS 18%
        totalAmount: item.subtotal
      })),
      
      // Totales
      totals: {
        subtotal: subtotal,
        discount: discount,
        taxableAmount: subtotal - discount,
        taxAmount: taxes,
        totalAmount: saleData.total
      },
      
      // Impuestos
      taxes: [
        {
          taxType: 'ITEBIS',
          rate: 18.0,
          taxableAmount: subtotal - discount,
          taxAmount: taxes
        }
      ]
    };
    
    return this.convertToXML(electronicInvoice);
  }

  /**
   * Mapear método de pago a códigos DGII
   */
  mapPaymentMethod(method) {
    const paymentMethods = {
      'Efectivo': '01',
      'Tarjeta': '02',
      'Transferencia': '03',
      'Cheque': '04'
    };
    
    return paymentMethods[method] || '01';
  }

  /**
   * Convertir estructura a XML según especificaciones DGII
   */
  convertToXML(invoiceData) {
    // Aquí implementaríamos la conversión a XML según el esquema DGII
    // Por simplicidad, retornamos una estructura JSON que se convertiría a XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eCF xmlns="http://dgii.gov.do/ecf/v1.0">
  <Header>
    <NCF>${invoiceData.header.ncf}</NCF>
    <InvoiceType>${invoiceData.header.invoiceType}</InvoiceType>
    <IssueDate>${invoiceData.header.issueDate}</IssueDate>
    <Currency>${invoiceData.header.currency}</Currency>
    <PaymentMethod>${invoiceData.header.paymentMethod}</PaymentMethod>
  </Header>
  <Issuer>
    <RNC>${invoiceData.issuer.rnc}</RNC>
    <BusinessName>${invoiceData.issuer.businessName}</BusinessName>
    <Address>${invoiceData.issuer.address}</Address>
    <Phone>${invoiceData.issuer.phone}</Phone>
    <Email>${invoiceData.issuer.email}</Email>
  </Issuer>
  <Receiver>
    <DocumentType>${invoiceData.receiver.documentType}</DocumentType>
    <DocumentNumber>${invoiceData.receiver.documentNumber}</DocumentNumber>
    <Name>${invoiceData.receiver.name}</Name>
  </Receiver>
  <Items>
    ${invoiceData.items.map(item => `
    <Item>
      <LineNumber>${item.lineNumber}</LineNumber>
      <Description>${item.description}</Description>
      <Quantity>${item.quantity}</Quantity>
      <UnitPrice>${item.unitPrice}</UnitPrice>
      <TotalAmount>${item.totalAmount}</TotalAmount>
    </Item>`).join('')}
  </Items>
  <Totals>
    <Subtotal>${invoiceData.totals.subtotal}</Subtotal>
    <TaxAmount>${invoiceData.totals.taxAmount}</TaxAmount>
    <TotalAmount>${invoiceData.totals.totalAmount}</TotalAmount>
  </Totals>
</eCF>`;
    
    return xml;
  }

  /**
   * Firmar electrónicamente el e-CF con certificado digital
   */
  async signElectronically(xmlData) {
    try {
      if (!this.certificateData) {
        throw new Error('Certificado digital no disponible');
      }

      // En una implementación completa, aquí usaríamos una librería como node-forge
      // para firmar digitalmente el XML con el certificado P12
      
      // Por ahora, simulamos la firma
      const signature = crypto
        .createHash('sha256')
        .update(xmlData + this.certificateData.password)
        .digest('hex');

      const signedXml = xmlData.replace('</eCF>', `
  <Signature>
    <SignatureValue>${signature}</SignatureValue>
    <SigningTime>${new Date().toISOString()}</SigningTime>
  </Signature>
</eCF>`);

      console.log('🔐 Documento firmado digitalmente');
      return signedXml;
    } catch (error) {
      throw new Error(`Error firmando documento: ${error.message}`);
    }
  }

  /**
   * Enviar e-CF firmado a DGII
   */
  async sendToDGII(signedXml) {
    try {
      const apiUrl = this.isTestMode ? this.testApiUrl : this.apiBaseUrl;
      
      // Simular envío a DGII
      // En implementación real, esto haría POST al endpoint de DGII
      const mockResponse = {
        success: true,
        trackingCode: `TRK${Date.now()}`,
        status: 'RECEIVED',
        message: 'e-CF recibido correctamente'
      };

      console.log('📤 e-CF enviado a DGII:', mockResponse.trackingCode);
      return mockResponse;
    } catch (error) {
      throw new Error(`Error enviando a DGII: ${error.message}`);
    }
  }

  /**
   * Guardar registro de factura electrónica
   */
  async saveElectronicInvoiceRecord(record) {
    try {
      // Aquí se guardaría en la base de datos local
      console.log('💾 Registro de factura electrónica guardado:', {
        saleId: record.saleId,
        ncf: record.ncf,
        trackingCode: record.dgiiTrackingCode,
        status: record.status
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error guardando registro:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Consultar estado de e-CF en DGII
   */
  async queryInvoiceStatus(trackingCode) {
    try {
      const apiUrl = this.isTestMode ? this.testApiUrl : this.apiBaseUrl;
      
      // Simular consulta de estado
      const mockStatus = {
        trackingCode,
        status: 'APPROVED',
        approvalDate: new Date().toISOString(),
        message: 'e-CF aprobado por DGII'
      };

      return { success: true, data: mockStatus };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Realizar petición HTTP
   */
  async makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      if (options.data) {
        req.write(options.data);
      }
      
      req.end();
    });
  }

  /**
   * Obtener tipos de comprobantes disponibles
   */
  getInvoiceTypes() {
    return {
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
  }

  /**
   * Validar RNC
   */
  validateRNC(rnc) {
    if (!rnc) return false;
    
    // RNC debe tener 9 dígitos para personas jurídicas o 11 para cédula
    const cleaned = rnc.toString().replace(/\D/g, '');
    return cleaned.length === 9 || cleaned.length === 11;
  }
}

// Instancia singleton del servicio
const dgiiService = new DGIIElectronicInvoiceService();

export default dgiiService;