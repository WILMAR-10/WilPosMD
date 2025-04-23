// src/pages/Privacidad.tsx
import React from 'react';
import { ChevronLeft, Shield, ShieldCheck, LockKeyhole } from 'lucide-react';

const Privacidad: React.FC = () => {
  const handleGoBack = () => {
    const event = new CustomEvent('componentChange', {
      detail: { component: 'Home' }
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      {/* Encabezado */}
      <header className="flex justify-between items-center px-8 py-4 shadow-md bg-white rounded-lg mb-6">
        <div className="flex items-center gap-3">
          <button onClick={handleGoBack} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Política de Privacidad</h1>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 px-6 pb-8">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Política de Privacidad de WilPOS</h2>
          <p className="text-gray-600 mb-4">
            Última actualización: 17 de abril de 2025
          </p>

          <div className="prose prose-blue max-w-none">
            <div className="bg-blue-50 p-4 rounded-lg flex items-start mb-6">
              <ShieldCheck className="h-6 w-6 text-blue-600 mr-3 mt-1" />
              <div>
                <h4 className="text-blue-700 font-medium mb-1">Compromiso con su Privacidad</h4>
                <p className="text-blue-800 text-sm">
                  En WilPOS, entendemos la importancia de proteger sus datos. Nuestro software está diseñado con la privacidad 
                  como principio fundamental, asegurando que usted mantenga el control completo sobre su información comercial.
                </p>
              </div>
            </div>

            <h3>1. Introducción</h3>
            <p>
              Esta Política de Privacidad describe cómo WilPOS recopila, utiliza y protege la información 
              que se genera o almacena cuando utiliza nuestro software de punto de venta. Al utilizar WilPOS, 
              usted acepta las prácticas descritas en esta política.
            </p>

            <h3>2. Información que Recopilamos</h3>
            <p>
              WilPOS es un software que se ejecuta localmente en sus sistemas y, por defecto, no transmite 
              datos a nuestros servidores. Sin embargo, el software puede recopilar y almacenar:
            </p>
            <ul>
              <li>Información de su negocio (nombre, dirección, información fiscal, etc.)</li>
              <li>Datos de productos y servicios</li>
              <li>Registros de ventas y transacciones</li>
              <li>Información de clientes y proveedores</li>
              <li>Información de usuarios y empleados que utilizan el sistema</li>
            </ul>
            <p>
              Toda esta información se almacena localmente en su dispositivo o sistema y no se transmite a 
              WilPOS a menos que usted opte por utilizar servicios adicionales que requieran dicha transmisión.
            </p>

            <h3>3. Cómo Utilizamos la Información</h3>
            <p>
              La información recopilada por WilPOS se utiliza exclusivamente para:
            </p>
            <ul>
              <li>Permitir el funcionamiento del software de punto de venta</li>
              <li>Generar facturas y recibos</li>
              <li>Mantener registros de inventario</li>
              <li>Facilitar la gestión de clientes y proveedores</li>
              <li>Generar informes y análisis para su negocio</li>
              <li>Cumplir con requisitos legales y fiscales</li>
            </ul>

            <h3>4. Seguridad de los Datos</h3>
            <p>
              WilPOS implementa medidas de seguridad diseñadas para proteger su información:
            </p>
            <ul>
              <li>Autenticación de usuarios mediante contraseñas</li>
              <li>Sistema de permisos y roles para controlar el acceso a la información</li>
              <li>Registros de auditoría para supervisar actividades</li>
              <li>Almacenamiento encriptado para datos sensibles</li>
            </ul>
            <p>
              Sin embargo, usted es responsable de mantener la seguridad de su instalación, incluyendo la 
              seguridad física de los dispositivos, las contraseñas seguras y las actualizaciones regulares.
            </p>

            <h3>5. Retención de Datos</h3>
            <p>
              Como WilPOS almacena datos en su sistema local, usted tiene control total sobre la retención 
              de datos. Le recomendamos implementar políticas de copia de seguridad y retención de datos 
              que cumplan con sus requisitos comerciales y legales.
            </p>

            <h3>6. Datos de Clientes</h3>
            <p>
              Si usted almacena información personal de sus clientes en WilPOS, es su responsabilidad:
            </p>
            <ul>
              <li>Informar a sus clientes sobre cómo se utilizará su información</li>
              <li>Obtener el consentimiento necesario</li>
              <li>Proporcionar acceso a los datos cuando sea solicitado</li>
              <li>Cumplir con todas las leyes de protección de datos aplicables</li>
            </ul>

            <h3>7. Servicios Opcionales y Terceros</h3>
            <p>
              Si decide utilizar características opcionales que impliquen la transmisión de datos a 
              nuestros servidores o servicios de terceros (como servicios de pago o nube), se aplicarán 
              políticas de privacidad adicionales que le serán comunicadas antes de activar dichos servicios.
            </p>

            <h3>8. Cumplimiento Legal</h3>
            <p>
              WilPOS está diseñado para ayudarle a cumplir con las obligaciones legales relacionadas con 
              el registro y almacenamiento de transacciones comerciales. Sin embargo, es su responsabilidad 
              garantizar que el uso del software cumple con todas las leyes y regulaciones aplicables en su jurisdicción.
            </p>

            <h3>9. Actualizaciones de la Política de Privacidad</h3>
            <p>
              Podemos actualizar esta política de privacidad periódicamente para reflejar cambios en nuestras 
              prácticas o por otras razones operativas, legales o regulatorias. Le notificaremos sobre cambios 
              significativos a través del software o por otros medios apropiados.
            </p>

            <h3>10. Sus Derechos</h3>
            <p>
              Como usuario de WilPOS, usted tiene control total sobre los datos almacenados en su instalación. 
              Puede ejercer sus derechos de acceso, rectificación, eliminación y portabilidad de datos a través 
              de las funcionalidades integradas en el software.
            </p>

            <h3>11. Contacto</h3>
            <p>
              Si tiene preguntas o inquietudes sobre esta política de privacidad o el tratamiento de sus datos, 
              póngase en contacto con nuestro equipo a través de la información proporcionada en el software.
            </p>

            <div className="bg-gray-50 p-4 rounded-lg mt-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <LockKeyhole className="h-5 w-5 text-gray-700" />
                <span className="font-medium text-gray-800">Nota Importante</span>
              </div>
              <p className="text-gray-700 text-sm">
                WilPOS es un software de gestión de punto de venta local. Los datos generados y almacenados 
                por el software permanecen en su sistema y están bajo su control. Es su responsabilidad 
                implementar medidas adecuadas para proteger estos datos, realizar copias de seguridad 
                regulares y cumplir con las regulaciones de protección de datos aplicables.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white shadow-inner py-4 text-center text-gray-600 text-sm">
        <p>© {new Date().getFullYear()} WilPOS. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
};

export default Privacidad;