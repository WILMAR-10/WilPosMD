import React, { useState } from 'react';
import { BarChart4, ClipboardList, ShoppingCart, Settings, Users, Package, Menu, Loader } from "lucide-react";
import logoImage from '../../assets/images/logo.png';

// Update the type to include the footer pages
type ComponentName = 'Caja' | 'Inventario' | 'Informes' | 'Facturas' | 'Usuarios' | 'Configuracion' | 'Privacidad' | 'Terminos' | 'Soporte';

const Home: React.FC = () => {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [loadingComponent, setLoadingComponent] = useState<ComponentName | null>(null);

  const handleOpenComponent = (component: ComponentName) => {
    if (loadingComponent) return;

    setLoadingComponent(component);

    // Verificar si la API está disponible
    if (!window.api?.openComponentWindow) {
      console.error("API no disponible para abrir ventana");
      switchComponentInCurrentWindow(component);
      setLoadingComponent(null);
      return;
    }

    // Solo el header usa esta lógica para abrir nueva ventana
    window.api.openComponentWindow(component)
      .then(() => {
        console.log(`Ventana abierta para componente: ${component}`);
        setLoadingComponent(null);
      })
      .catch(err => {
        console.error("Error al abrir ventana:", err);
        setLoadingComponent(null);
        // Si falla, cambiamos el componente en la ventana actual
        switchComponentInCurrentWindow(component);
      });
  };

  const switchComponentInCurrentWindow = (component: ComponentName) => {
    // Mostrar indicador de carga
    setLoadingComponent(component);
    
    // Crear un evento personalizado para cambiar el componente
    const event = new CustomEvent('componentChange', {
      detail: { component }
    });
    window.dispatchEvent(event);
    
    // Eliminar indicador de carga después de un breve retraso
    setTimeout(() => setLoadingComponent(null), 300);
  };

  const navItems = [
    { icon: ShoppingCart, label: 'Caja', component: 'Caja' as ComponentName },
    { icon: Package, label: 'Inventario', component: 'Inventario' as ComponentName },
    { icon: BarChart4, label: 'Informes', component: 'Informes' as ComponentName },
    { icon: ClipboardList, label: 'Facturas', component: 'Facturas' as ComponentName },
    { icon: Users, label: 'Usuarios', component: 'Usuarios' as ComponentName },
    { icon: Settings, label: 'Configuración', component: 'Configuracion' as ComponentName },
  ];

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      {/* HEADER CON BOTONES QUE ABREN NUEVAS VENTANAS */}
      <header className="flex justify-between items-center px-8 py-4 shadow-md bg-white relative">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="WilPos Logo" className="h-8 w-8" />
          <h1 className="text-2xl font-bold text-gray-800">WilPos</h1>
        </div>

        <nav className="hidden md:flex gap-4">
          {navItems.map(({ icon: Icon, label, component }) => (
            <button
              key={component}
              onClick={() => handleOpenComponent(component)}
              className="flex items-center gap-2 p-2 rounded-xl transition hover:bg-gray-100"
            >
              <Icon className="w-5 h-5 text-gray-700" />
              <span className="text-sm text-gray-700 hidden lg:inline">{label}</span>
              {loadingComponent === component && <Loader className="w-4 h-4 text-gray-700 animate-spin ml-2" />}
            </button>
          ))}
        </nav>

        <button className="md:hidden" onClick={() => setMenuOpen(!isMenuOpen)}>
          <Menu className="w-6 h-6 text-gray-700" />
        </button>

        {isMenuOpen && (
          <nav className="absolute top-full right-0 bg-white shadow-lg rounded-lg py-2 w-48 z-50 flex flex-col">
            {navItems.map(({ icon: Icon, label, component }) => (
              <button
                key={component}
                onClick={() => {
                  handleOpenComponent(component);
                  setMenuOpen(false);
                }}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 transition"
              >
                <Icon className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-700">{label}</span>
                {loadingComponent === component && <Loader className="w-4 h-4 text-gray-700 animate-spin ml-2" />}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* MAIN QUE CAMBIA EL COMPONENTE DENTRO DE LA MISMA VENTANA */}
      <main className="flex flex-col flex-1 justify-center items-center px-4 sm:px-6 lg:px-8">
        <section className="text-center mb-8">
          <h2 className="text-4xl font-bold text-gray-700">Bienvenido a WilPos</h2>
          <p className="text-gray-600 mt-2">Sistema de gestión para tu negocio</p>
        </section>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-5xl">
          {navItems.map(({ icon: Icon, label, component }) => (
            <button
              key={component}
              onClick={() => switchComponentInCurrentWindow(component)}
              className="flex flex-col items-center justify-center bg-white p-6 rounded-3xl shadow-md hover:shadow-lg transition duration-300 transform hover:-translate-y-1"
            >
              <Icon className="w-10 h-10 text-gray-700 mb-2" />
              <span className="text-gray-700 font-medium mt-2">{label}</span>
            </button>
          ))}
        </div>
      </main>

      <footer className="bg-white shadow-inner py-4">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
          <span>© {new Date().getFullYear()} WilPos. Todos los derechos reservados.</span>
          <nav className="flex gap-4 mt-2 md:mt-0">
            {/* Updated footer buttons to use switchComponentInCurrentWindow directly */}
            <button 
              onClick={() => switchComponentInCurrentWindow('Soporte')}
              className="hover:text-gray-800 transition-colors"
              disabled={loadingComponent === 'Soporte'}
            >
              {loadingComponent === 'Soporte' ? (
                <span className="flex items-center">
                  <Loader className="w-3 h-3 mr-1 animate-spin" />Soporte
                </span>
              ) : (
                'Soporte'
              )}
            </button>
            <button 
              onClick={() => switchComponentInCurrentWindow('Privacidad')}
              className="hover:text-gray-800 transition-colors"
              disabled={loadingComponent === 'Privacidad'}
            >
              {loadingComponent === 'Privacidad' ? (
                <span className="flex items-center">
                  <Loader className="w-3 h-3 mr-1 animate-spin" />Privacidad
                </span>
              ) : (
                'Privacidad'
              )}
            </button>
            <button 
              onClick={() => switchComponentInCurrentWindow('Terminos')}
              className="hover:text-gray-800 transition-colors"
              disabled={loadingComponent === 'Terminos'}
            >
              {loadingComponent === 'Terminos' ? (
                <span className="flex items-center">
                  <Loader className="w-3 h-3 mr-1 animate-spin" />Términos
                </span>
              ) : (
                'Términos'
              )}
            </button>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default Home;