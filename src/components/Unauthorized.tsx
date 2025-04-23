import React from 'react';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';

const Unauthorized: React.FC = () => {
  const handleGoBack = () => {
    const event = new CustomEvent('componentChange', {
      detail: { component: 'Home' }
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md text-center">
        <div className="text-red-500 mb-6">
          <AlertTriangle className="h-16 w-16 mx-auto" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Acceso No Autorizado</h1>
        <p className="text-gray-600 mb-6">No tienes permisos para acceder a esta sección.</p>
        
        <button
          onClick={handleGoBack}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          <span>Volver al Inicio</span>
        </button>
        
        <button
          onClick={() => window.history.back()}
          className="w-full mt-3 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver Atrás</span>
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;