import React, { useState, useEffect } from "react";
import { AiOutlineMinus, AiOutlineClose } from "react-icons/ai";
import { VscChromeMaximize } from "react-icons/vsc";
import logoImage from '../../assets/images/logo.png';

interface HeaderBarProps {
  componenteActivo: string;
  isLoginScreen?: boolean;
}
const HeaderBar = ({ componenteActivo = '' }: HeaderBarProps) => {
  const [ventanaActual, setVentanaActual] = useState({ type: "main" });
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    window.api?.identifyWindow().then(setVentanaActual).catch(console.error);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const BotonControlVentana = ({
    icono,
    accion,
    ariaLabel,
    claseHover,
  }: {
    icono: React.ReactNode;
    accion: "minimize" | "maximize" | "close";
    ariaLabel: string;
    claseHover: string;
  }) => (
    <button
      className={`bg-transparent border-0 cursor-pointer p-2 rounded-full ${claseHover}`}
      onClick={async () => {
        if (!window.api) {
          console.warn(`API no disponible en modo navegador`);
          return;
        }
  
        try {
          switch (accion) {
            case "minimize":
              await window.api.minimize();
              break;
            case "maximize":
              await window.api.maximize();
              break;
            case "close":
              await window.api.close();
              break;
          }
        } catch (error) {
          console.error(`Error al ejecutar acción ${accion}:`, error);
        }
      }}
      aria-label={ariaLabel}
    >
      {icono}
    </button>
  );
  

  const generarTitulo = () => componenteActivo && componenteActivo !== 'Home' 
    ? `Wil POS - ${componenteActivo}` 
    : "Wil POS";

  return (
    <div className="sticky top-0 z-50 w-full">
      <div
        className={`relative flex items-center w-full px-3 py-2 bg-white rounded-lg transition-all ${
          scrolled ? 'shadow-lg' : 'shadow-md'
        }`}
        style={{ WebkitAppRegion: "drag", backdropFilter: "blur(8px)", background: "rgba(255, 255, 255, 0.95)" } as React.CSSProperties}
      >
        <div className="flex items-center" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
          <img src={logoImage} alt="WilPos Logo" className="h-8 w-8 mr-2" />
          <span className="font-semibold text-base">{generarTitulo()}</span>
        </div>
        <div className="flex-grow"></div>
        {ventanaActual.type !== "browser" && (
          <div className="flex items-center" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <BotonControlVentana
              icono={<AiOutlineMinus size={14} />}
              accion="minimize"
              ariaLabel="Minimizar ventana"
              claseHover="hover:bg-gray-100"
            />
            <BotonControlVentana
              icono={<VscChromeMaximize size={14} />}
              accion="maximize"
              ariaLabel="Maximizar ventana"
              claseHover="hover:bg-gray-100"
            />
            <BotonControlVentana
              icono={<AiOutlineClose size={14} />}
              accion="close"
              ariaLabel="Cerrar ventana"
              claseHover="hover:bg-red-100 hover:text-red-500"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HeaderBar;
