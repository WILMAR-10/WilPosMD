// src/components/DGIIFreeDigitalCertificate.tsx - Componente para Certificados Digitales Gratuitos DGII
import React, { useState, useEffect } from 'react';
import {
  Shield, FileText, CheckCircle, AlertTriangle, Clock,
  ExternalLink, Download, RefreshCw, Info, Calendar,
  User, Building2, Globe, Key, Lock, Unlock, Award
} from 'lucide-react';

interface CertificateStatus {
  hasAccess: boolean;
  status: 'pending' | 'approved' | 'active' | 'expired' | 'not_requested';
  expiryDate?: string;
  certificateId?: string;
  remainingDays?: number;
}

interface RequirementsCheck {
  rncActive: boolean;
  officeVirtualAccess: boolean;
  taxObligationsCompliant: boolean;
  noOtherSystem: boolean;
  allCompliant: boolean;
}

const DGIIFreeDigitalCertificate: React.FC = () => {
  const [certificateStatus, setCertificateStatus] = useState<CertificateStatus>({
    hasAccess: false,
    status: 'not_requested'
  });
  
  const [requirements, setRequirements] = useState<RequirementsCheck>({
    rncActive: false,
    officeVirtualAccess: false,
    taxObligationsCompliant: false,
    noOtherSystem: false,
    allCompliant: false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    checkRequirements();
    loadCertificateStatus();
  }, []);

  const checkRequirements = async () => {
    try {
      setIsLoading(true);
      
      // En implementación real, esto verificaría los requisitos con la DGII
      // Por ahora simulamos la verificación
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockRequirements: RequirementsCheck = {
        rncActive: true,
        officeVirtualAccess: true,
        taxObligationsCompliant: true,
        noOtherSystem: true,
        allCompliant: true
      };

      mockRequirements.allCompliant = Object.values(mockRequirements).every(Boolean);
      setRequirements(mockRequirements);
    } catch (error) {
      console.error('Error verificando requisitos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCertificateStatus = async () => {
    try {
      // En implementación real, esto consultaría el estado del certificado
      const mockStatus: CertificateStatus = {
        hasAccess: true,
        status: 'active',
        expiryDate: '2025-09-30',
        certificateId: 'CERT-FREE-2024-001234',
        remainingDays: 195
      };
      
      setCertificateStatus(mockStatus);
    } catch (error) {
      console.error('Error cargando estado del certificado:', error);
    }
  };

  const requestFreeCertificate = async () => {
    try {
      setIsLoading(true);
      
      if (!requirements.allCompliant) {
        throw new Error('No cumple con todos los requisitos necesarios');
      }

      // Simular solicitud a la Oficina Virtual
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Actualizar estado
      setCertificateStatus(prev => ({
        ...prev,
        status: 'pending',
        hasAccess: true
      }));

      // Mostrar mensaje de éxito
      alert('Solicitud enviada correctamente. Recibirá una notificación cuando sea procesada.');
    } catch (error) {
      alert(`Error en la solicitud: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openOfficeVirtual = () => {
    window.open('https://dgii.gov.do/oficinavirtual/', '_blank');
  };

  const openFreeInvoicer = () => {
    window.open('https://fg.dgii.gov.do/ecf/PortalFG/login', '_blank');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-700 bg-green-50 border-green-200';
      case 'pending': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'expired': return 'text-red-700 bg-red-50 border-red-200';
      case 'approved': return 'text-blue-700 bg-blue-50 border-blue-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Certificado Activo';
      case 'pending': return 'Solicitud Pendiente';
      case 'expired': return 'Certificado Vencido';
      case 'approved': return 'Solicitud Aprobada';
      case 'not_requested': return 'No Solicitado';
      default: return 'Estado Desconocido';
    }
  };

  const steps = [
    {
      title: 'Verificar Requisitos',
      description: 'Confirmar que cumple con todos los requisitos',
      icon: CheckCircle,
      completed: requirements.allCompliant
    },
    {
      title: 'Solicitar Acceso',
      description: 'Solicitar el Facturador Gratuito en la OFV',
      icon: FileText,
      completed: certificateStatus.status !== 'not_requested'
    },
    {
      title: 'Recibir Certificado',
      description: 'DGII entrega el certificado digital gratuito',
      icon: Shield,
      completed: certificateStatus.status === 'active' || certificateStatus.status === 'approved'
    },
    {
      title: 'Usar Facturador',
      description: 'Emitir e-CF desde el Facturador Gratuito',
      icon: Globe,
      completed: certificateStatus.status === 'active'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header con información del programa */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 rounded-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-lg">
              <Award className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Certificados Digitales Gratuitos DGII</h1>
              <p className="text-blue-100 text-lg leading-relaxed">
                Obtenga su certificado digital gratuito para facturación electrónica.<br/>
                <strong>30,000 certificados disponibles</strong> hasta el 30 de septiembre de 2025.
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-white bg-opacity-20 px-4 py-2 rounded-lg">
              <p className="text-sm text-blue-100">Vigencia</p>
              <p className="text-xl font-bold">1 Año</p>
            </div>
          </div>
        </div>
      </div>

      {/* Estado actual del certificado */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Estado de su Certificado Digital</h2>
          <button
            onClick={loadCertificateStatus}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>

        <div className={`border rounded-lg p-4 ${getStatusColor(certificateStatus.status)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {certificateStatus.status === 'active' && <Shield className="h-6 w-6" />}
              {certificateStatus.status === 'pending' && <Clock className="h-6 w-6" />}
              {certificateStatus.status === 'expired' && <AlertTriangle className="h-6 w-6" />}
              {certificateStatus.status === 'not_requested' && <Lock className="h-6 w-6" />}
              
              <div>
                <p className="font-semibold text-lg">{getStatusText(certificateStatus.status)}</p>
                {certificateStatus.certificateId && (
                  <p className="text-sm opacity-75">ID: {certificateStatus.certificateId}</p>
                )}
              </div>
            </div>

            {certificateStatus.status === 'active' && certificateStatus.remainingDays && (
              <div className="text-right">
                <p className="text-sm opacity-75">Días restantes</p>
                <p className="text-2xl font-bold">{certificateStatus.remainingDays}</p>
              </div>
            )}
          </div>

          {certificateStatus.expiryDate && (
            <div className="mt-3 pt-3 border-t border-current border-opacity-20">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>Vence el: {new Date(certificateStatus.expiryDate).toLocaleDateString('es-DO')}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Proceso paso a paso */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Proceso de Obtención</h2>
        
        <div className="space-y-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            
            return (
              <div key={index} className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  step.completed 
                    ? 'bg-green-100 text-green-600' 
                    : isActive 
                      ? 'bg-blue-100 text-blue-600' 
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  {step.completed ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                
                <div className="flex-grow">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={`font-medium ${step.completed ? 'text-green-700' : 'text-gray-800'}`}>
                        {step.title}
                      </h3>
                      <p className="text-gray-600 text-sm">{step.description}</p>
                    </div>
                    
                    {step.completed && (
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                        Completado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Verificación de requisitos */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Verificación de Requisitos</h2>
          <button
            onClick={checkRequirements}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Verificar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-4 border rounded-lg ${requirements.rncActive ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-3">
              {requirements.rncActive ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p className="font-medium">RNC Activo</p>
                <p className="text-sm text-gray-600">Inscrito y activo en el RNC</p>
              </div>
            </div>
          </div>

          <div className={`p-4 border rounded-lg ${requirements.officeVirtualAccess ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-3">
              {requirements.officeVirtualAccess ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p className="font-medium">Acceso a Oficina Virtual</p>
                <p className="text-sm text-gray-600">Clave de acceso a la OFV</p>
              </div>
            </div>
          </div>

          <div className={`p-4 border rounded-lg ${requirements.taxObligationsCompliant ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-3">
              {requirements.taxObligationsCompliant ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p className="font-medium">Obligaciones al Día</p>
                <p className="text-sm text-gray-600">Cumplimiento tributario vigente</p>
              </div>
            </div>
          </div>

          <div className={`p-4 border rounded-lg ${requirements.noOtherSystem ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center gap-3">
              {requirements.noOtherSystem ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p className="font-medium">Sin Otro Sistema</p>
                <p className="text-sm text-gray-600">No usar otro sistema autorizado</p>
              </div>
            </div>
          </div>
        </div>

        {requirements.allCompliant && certificateStatus.status === 'not_requested' && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">¡Cumple con todos los requisitos!</p>
                <p className="text-sm text-green-700">Puede proceder a solicitar su certificado digital gratuito.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Acciones Disponibles</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={openOfficeVirtual}
            className="flex flex-col items-center gap-3 p-6 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <Building2 className="h-8 w-8 text-blue-600" />
            <div className="text-center">
              <p className="font-medium text-gray-800">Oficina Virtual</p>
              <p className="text-sm text-gray-600">Acceder a la OFV de DGII</p>
            </div>
            <ExternalLink className="h-4 w-4 text-gray-400" />
          </button>

          {requirements.allCompliant && certificateStatus.status === 'not_requested' && (
            <button
              onClick={requestFreeCertificate}
              disabled={isLoading}
              className="flex flex-col items-center gap-3 p-6 border border-green-300 bg-green-50 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              <Shield className="h-8 w-8 text-green-600" />
              <div className="text-center">
                <p className="font-medium text-green-800">Solicitar Certificado</p>
                <p className="text-sm text-green-700">Obtener certificado gratuito</p>
              </div>
              {isLoading && <RefreshCw className="h-4 w-4 text-green-600 animate-spin" />}
            </button>
          )}

          <button
            onClick={openFreeInvoicer}
            className="flex flex-col items-center gap-3 p-6 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
          >
            <Globe className="h-8 w-8 text-purple-600" />
            <div className="text-center">
              <p className="font-medium text-gray-800">Facturador Gratuito</p>
              <p className="text-sm text-gray-600">Emitir e-CF online</p>
            </div>
            <ExternalLink className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Información importante */}
      <div className="bg-amber-50 border border-amber-200 p-6 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-2">Información Importante sobre los Certificados Gratuitos:</p>
            <ul className="space-y-1 text-amber-700">
              <li>• <strong>30,000 certificados disponibles</strong> hasta el 30 de septiembre de 2025 o hasta agotar existencias</li>
              <li>• <strong>Vigencia de 1 año</strong> desde la fecha de emisión</li>
              <li>• <strong>Solo funcionan dentro del Facturador Gratuito</strong> de la DGII</li>
              <li>• <strong>Renovación pagada</strong> después del vencimiento</li>
              <li>• <strong>Cumplimiento obligatorio:</strong> Grandes y medianos hasta 15/11/2025, MiPymes hasta 15/05/2026</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DGIIFreeDigitalCertificate;