// src/pages/Terminos.tsx
import React from 'react';
import { ChevronLeft } from 'lucide-react';

const Terminos: React.FC = () => {
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
            <h1 className="text-2xl font-bold text-gray-800">Términos y Condiciones</h1>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 px-6 pb-8">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Términos y Condiciones de Uso de WilPOS</h2>
          <p className="text-gray-600 mb-4">
            Última actualización: 17 de abril de 2025
          </p>

          <div className="prose prose-blue max-w-none">
            <h3>1. Aceptación de los Términos</h3>
            <p>
              Al utilizar WilPOS, usted acepta estos términos y condiciones en su totalidad. Si no está de acuerdo con estos términos, no debe utilizar este software.
            </p>

            <h3>2. Licencia</h3>
            <p>
              WilPOS se distribuye bajo una licencia MIT que permite su uso, copia, modificación, fusión, publicación, distribución, sublicencia y/o venta de copias del software, y permite a las personas a las que se les proporcione el software hacerlo, sujeto a las siguientes condiciones:
            </p>
            <ul>
              <li>El aviso de copyright anterior y este aviso de permiso se incluirán en todas las copias o partes sustanciales del software.</li>
              <li>El software se proporciona "tal cual", sin garantía de ningún tipo, expresa o implícita, incluyendo, pero no limitado a, las garantías de comerciabilidad, idoneidad para un propósito particular y no infracción.</li>
              <li>En ningún caso los autores o titulares de los derechos de autor serán responsables de cualquier reclamación, daños u otra responsabilidad, ya sea en una acción de contrato, agravio o de otro modo, que surja de, fuera de o en relación con el software o el uso u otros tratos en el software.</li>
            </ul>

            <h3>3. Responsabilidad del Usuario</h3>
            <p>
              El usuario es responsable de:
            </p>
            <ul>
              <li>Mantener la seguridad de su instalación de WilPOS, incluyendo la protección de sus credenciales de acceso.</li>
              <li>Garantizar que los datos introducidos en el sistema son precisos y están actualizados.</li>
              <li>Cumplir con todas las leyes fiscales y comerciales aplicables en su jurisdicción.</li>
              <li>Asegurar que el uso del software cumple con todas las leyes de protección de datos aplicables.</li>
              <li>Realizar copias de seguridad regulares de los datos almacenados en el sistema.</li>
            </ul>

            <h3>4. Limitaciones de Uso</h3>
            <p>
              El usuario no debe:
            </p>
            <ul>
              <li>Utilizar WilPOS para actividades ilegales o no autorizadas.</li>
              <li>Intentar descompilar, realizar ingeniería inversa o desmontar cualquier parte del software que no sea de código abierto.</li>
              <li>Eliminar o alterar cualquier notificación de derechos de autor, marcas comerciales u otros avisos de propiedad del software.</li>
              <li>Utilizar el software de manera que pueda dañar, deshabilitar, sobrecargar o perjudicar cualquier servidor, red, sistema o recursos.</li>
            </ul>

            <h3>5. Actualizaciones del Software</h3>
            <p>
              Los desarrolladores de WilPOS pueden lanzar actualizaciones periódicamente. Estas actualizaciones pueden incluir correcciones de errores, mejoras de características o actualizaciones de seguridad. El usuario es responsable de implementar estas actualizaciones cuando estén disponibles.
            </p>

            <h3>6. Soporte Técnico</h3>
            <p>
              El soporte técnico para WilPOS se proporciona según las condiciones especificadas en su acuerdo de compra o licencia. En ausencia de un acuerdo específico, el soporte técnico se proporciona "tal cual", sin garantías.
            </p>

            <h3>7. Terminación</h3>
            <p>
              El derecho del usuario a utilizar WilPOS continuará hasta que se termine. El usuario puede terminar este acuerdo en cualquier momento desinstalando y cesando todo uso del software. Los desarrolladores de WilPOS también pueden terminar este acuerdo si el usuario no cumple con estos términos y condiciones.
            </p>

            <h3>8. Cambios en los Términos</h3>
            <p>
              Los desarrolladores de WilPOS se reservan el derecho de modificar estos términos y condiciones en cualquier momento. Se notificará a los usuarios de cualquier cambio significativo. El uso continuado del software después de tales cambios constituirá la aceptación de los términos modificados.
            </p>

            <h3>9. Ley Aplicable</h3>
            <p>
              Estos términos y condiciones se rigen e interpretan de acuerdo con las leyes de la República Dominicana, sin tener en cuenta sus conflictos de principios legales.
            </p>

            <h3>10. Contacto</h3>
            <p>
              Si tiene alguna pregunta sobre estos términos y condiciones, por favor contacte con el equipo de desarrollo a través de la información proporcionada en el software.
            </p>
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

export default Terminos;