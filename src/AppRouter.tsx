import React, { useEffect, useState } from "react";
import { useAuth } from "./services/AuthContext";
import Home from "./pages/Home";
import Caja from "./pages/Caja";
import Inventario from "./pages/Inventario";
import Facturas from "./pages/Factura";
import Usuarios from "./pages/Usuarios";
import Informes from "./pages/Informes";
import Configuracion from "./pages/Configuracion";
import Privacidad from "./pages/Privacidad";
import Terminos from "./pages/Terminos";
import HeaderBar from "./components/HeaderBar";
import Login from "./pages/Login";
import Unauthorized from "./components/Unauthorized";

type ComponentName = 'Home' | 'Caja' | 'Inventario' | 'Facturas' | 'Usuarios' | 'Informes' | 'Configuracion' | 'Privacidad' | 'Terminos' | 'Soporte';

interface ComponentChangeEvent extends CustomEvent {
  detail: {
    component: ComponentName;
  };
}

interface WindowInfo {
  type: string;
  id?: string | number;
  component?: string;
}

const AppRouter: React.FC = () => {
  const { user, loading, hasPermission } = useAuth();
  const [activeComponent, setActiveComponent] = useState<ComponentName>("Home");
  const [history, setHistory] = useState<ComponentName[]>(["Home"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  // Detectar componente inicial desde URL
  useEffect(() => {
    const detectInitialComponent = async () => {
      try {
        // Comprobar si estamos en un componente específico (ventana secundaria)
        if (window.api?.identifyWindow) {
          const windowInfo: WindowInfo = await window.api.identifyWindow();
          console.log("Window info:", windowInfo);
          
          if (windowInfo.type === 'component' && windowInfo.component) {
            // Verificar si el componente es válido
            const componentName = windowInfo.component as ComponentName;
            setActiveComponent(componentName);
            setHistory([componentName]);
          }
        } else {
          // Comprobar si hay un parámetro de componente en la URL
          const urlParams = new URLSearchParams(window.location.search);
          const componentParam = urlParams.get('component');
          
          if (componentParam) {
            // Verificar si el componente es válido
            const validComponents: ComponentName[] = [
              'Home', 'Caja', 'Inventario', 'Facturas', 
              'Usuarios', 'Informes', 'Configuracion',
              'Privacidad', 'Terminos', 'Soporte'
            ];
            
            if (validComponents.includes(componentParam as ComponentName)) {
              setActiveComponent(componentParam as ComponentName);
              setHistory([componentParam as ComponentName]);
            }
          }
        }
      } catch (error) {
        console.error("Error al detectar componente inicial:", error);
      }
    };
    
    detectInitialComponent();
  }, []);

  useEffect(() => {
    // Initialize database on app start
    const initializeDB = async () => {
      try {
        if (!window.api?.initializeDatabase) {
          console.warn("Database initialization not available in browser mode");
          setIsInitializing(false);
          return;
        }

        console.log("Initializing database...");
        await window.api.initializeDatabase();
        console.log("Database initialized successfully");
        setIsInitializing(false);
        setInitError(null);
      } catch (err) {
        console.error("Database initialization failed:", err);
        
        // If we haven't exceeded retry attempts, try again
        if (retryCount < MAX_RETRIES) {
          const nextRetry = retryCount + 1;
          setRetryCount(nextRetry);
          console.log(`Retrying database initialization (${nextRetry}/${MAX_RETRIES})...`);
          
          // Wait before retrying
          setTimeout(initializeDB, 1000);
        } else {
          setInitError(`Error al inicializar la base de datos. La aplicación puede no funcionar correctamente. ${err instanceof Error ? err.message : 'Error desconocido'}`);
          setIsInitializing(false);
        }
      }
    };

    initializeDB();
  }, [retryCount]);

  useEffect(() => {
    const handleComponentChange = (event: Event) => {
      const customEvent = event as ComponentChangeEvent;
      const newComponent = customEvent.detail.component;

      // Si estamos en un punto del historial y navegamos a uno nuevo
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newComponent);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setActiveComponent(newComponent);
    };

    window.addEventListener("componentChange", handleComponentChange as EventListener);
    return () => window.removeEventListener("componentChange", handleComponentChange as EventListener);
  }, [history, historyIndex]);

  useEffect(() => {
    const handleMouseButtons = (e: MouseEvent) => {
      if (e.button === 3 && historyIndex > 0) {
        // Botón "atrás"
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setActiveComponent(history[newIndex]);
      } else if (e.button === 4 && historyIndex < history.length - 1) {
        // Botón "adelante"
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setActiveComponent(history[newIndex]);
      }
    };

    window.addEventListener("mouseup", handleMouseButtons);
    return () => window.removeEventListener("mouseup", handleMouseButtons);
  }, [history, historyIndex]);

  // Loading state
  if (loading || isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen flex-col">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">
          {loading ? "Cargando..." : `Inicializando aplicación${retryCount > 0 ? ` (Intento ${retryCount}/${MAX_RETRIES})` : ''}...`}
        </p>
      </div>
    );
  }

  // Database initialization error
  if (initError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-white p-8 rounded-xl shadow-md max-w-md">
          <div className="text-red-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-center mb-4">Error de Inicialización</h1>
          <p className="text-gray-600 mb-6">{initError}</p>
          <div className="flex flex-col gap-2">
            <button 
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              onClick={() => {
                setRetryCount(0);
                setIsInitializing(true);
                setInitError(null);
              }}
            >
              Reintentar
            </button>
            <button 
              className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              onClick={() => setInitError(null)}
            >
              Continuar de todas formas
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Login screen if user is not authenticated
  if (!user) {
    return (
      <div className="flex flex-col h-screen max-h-screen overflow-hidden">
        <HeaderBar componenteActivo="Home" isLoginScreen={true} />
        <main className="flex-grow overflow-auto">
          <Login />
        </main>
      </div>
    );
  }

  // Function to check permissions and render the appropriate component
  const renderComponentWithPermission = () => {
    console.log("Rendering component:", activeComponent);
    
    switch (activeComponent) {
      case "Home":
        return <Home />;
      case "Caja":
        return hasPermission("caja") ? <Caja /> : <Unauthorized />;
      case "Inventario":
        return hasPermission("inventario") ? <Inventario /> : <Unauthorized />;
      case "Facturas":
        return hasPermission("facturas") ? <Facturas /> : <Unauthorized />;
      case "Usuarios":
        return hasPermission("usuarios") ? <Usuarios /> : <Unauthorized />;
      case "Informes":
        return hasPermission("dashboard") ? <Informes /> : <Unauthorized />;
      case "Configuracion":
        return hasPermission("configuracion") ? <Configuracion /> : <Unauthorized />;
      case "Privacidad":
        return <Privacidad />;
      case "Terminos":
        return <Terminos />;
      case "Soporte":
        return (
          <div className="min-h-full bg-gray-50 flex flex-col">
            <header className="flex justify-between items-center px-8 py-4 shadow-md bg-white rounded-lg mb-6">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    const event = new CustomEvent('componentChange', {
                      detail: { component: 'Home' }
                    });
                    window.dispatchEvent(event);
                  }} 
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-800">Soporte Técnico</h1>
                </div>
              </div>
            </header>
            <main className="flex-1 px-6 pb-8 flex flex-col items-center justify-center">
              <div className="max-w-lg text-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-blue-500 mb-6">
                  <path d="M20 12v-6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/>
                  <path d="M18 18v-7"/>
                  <path d="M15 18h6"/>
                </svg>
                <h2 className="text-2xl font-bold mb-4">Centro de Soporte</h2>
                <p className="text-gray-600 mb-6">
                  ¡Esta función estará disponible próximamente! Estamos trabajando para ofrecerle el mejor soporte técnico.
                </p>
                <button
                  onClick={() => {
                    const event = new CustomEvent('componentChange', {
                      detail: { component: 'Home' }
                    });
                    window.dispatchEvent(event);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Volver al Inicio
                </button>
              </div>
            </main>
            <footer className="bg-white shadow-inner py-4 text-center text-gray-600 text-sm">
              <p>© {new Date().getFullYear()} WilPOS. Todos los derechos reservados.</p>
            </footer>
          </div>
        );
      default:
        return <Home />;
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      <HeaderBar componenteActivo={activeComponent} />
      <main className="flex-grow overflow-auto">{renderComponentWithPermission()}</main>
    </div>
  );
};

export default AppRouter;