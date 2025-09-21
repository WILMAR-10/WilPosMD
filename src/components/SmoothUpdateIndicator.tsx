// src/components/SmoothUpdateIndicator.tsx
import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

interface SmoothUpdateIndicatorProps {
  isUpdating?: boolean;
  isUpdated?: boolean;
  updateType?: 'success' | 'warning' | 'info' | 'error';
  children?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showGlow?: boolean;
  showPulse?: boolean;
  autoHide?: boolean;
  hideDelay?: number;
}

const SmoothUpdateIndicator: React.FC<SmoothUpdateIndicatorProps> = ({ 
  isUpdating = false, 
  isUpdated = false,
  updateType = 'success',
  children,
  className = '',
  size = 'sm',
  showGlow = true,
  showPulse = true,
  autoHide = true,
  hideDelay = 3000
}) => {
  const [showIndicator, setShowIndicator] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'none' | 'updating' | 'updated' | 'hiding'>('none');

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4', 
    lg: 'w-5 h-5'
  };

  // Manejar estados de actualización
  useEffect(() => {
    if (isUpdating) {
      setShowIndicator(true);
      setAnimationPhase('updating');
    } else if (isUpdated) {
      setAnimationPhase('updated');
      
      if (autoHide) {
        const timer = setTimeout(() => {
          setAnimationPhase('hiding');
          setTimeout(() => {
            setShowIndicator(false);
            setAnimationPhase('none');
          }, 300);
        }, hideDelay);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isUpdating, isUpdated, autoHide, hideDelay]);

  const getUpdateIcon = () => {
    switch (updateType) {
      case 'success':
        return <CheckCircle className={`${sizeClasses[size]} text-green-500`} />;
      case 'warning':
        return <AlertCircle className={`${sizeClasses[size]} text-yellow-500`} />;
      case 'info':
        return <Sparkles className={`${sizeClasses[size]} text-blue-500`} />;
      case 'error':
        return <AlertCircle className={`${sizeClasses[size]} text-red-500`} />;
      default:
        return <CheckCircle className={`${sizeClasses[size]} text-green-500`} />;
    }
  };

  const getGlowColor = () => {
    switch (updateType) {
      case 'success':
        return 'ring-green-300 bg-green-50';
      case 'warning':
        return 'ring-yellow-300 bg-yellow-50';
      case 'info':
        return 'ring-blue-300 bg-blue-50';
      case 'error':
        return 'ring-red-300 bg-red-50';
      default:
        return 'ring-green-300 bg-green-50';
    }
  };

  const getAnimationClasses = () => {
    const base = 'transition-all duration-300 ease-in-out';
    
    switch (animationPhase) {
      case 'updating':
        return `${base} ${showPulse ? 'animate-pulse' : ''}`;
      case 'updated':
        return `${base} ${showGlow ? `ring-2 ring-opacity-30 ${getGlowColor()}` : ''}`;
      case 'hiding':
        return `${base} opacity-0 scale-95`;
      default:
        return base;
    }
  };

  // Si es un wrapper component
  if (children) {
    return (
      <div className={`relative ${getAnimationClasses()} ${className}`}>
        {children}
        
        {/* Indicador flotante */}
        {(isUpdating || showIndicator) && (
          <div className="absolute -top-2 -right-2 z-10">
            {animationPhase === 'updating' ? (
              <div className="bg-white rounded-full p-1 shadow-sm border">
                <RefreshCw className={`${sizeClasses[size]} animate-spin text-blue-500`} />
              </div>
            ) : (
              <div className={`bg-white rounded-full p-1 shadow-sm border transition-all duration-200 ${animationPhase === 'hiding' ? 'opacity-0 scale-75' : ''}`}>
                {getUpdateIcon()}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Si es standalone
  if (!isUpdating && !showIndicator) return null;

  return (
    <div className={`inline-flex items-center ${className} ${getAnimationClasses()}`}>
      {animationPhase === 'updating' ? (
        <>
          <RefreshCw className={`${sizeClasses[size]} animate-spin text-blue-500 opacity-75`} />
          <span className="ml-1 text-xs text-gray-600">Actualizando...</span>
        </>
      ) : (
        <>
          {getUpdateIcon()}
          <span className="ml-1 text-xs text-gray-600">Actualizado</span>
        </>
      )}
      <span className="sr-only">
        {animationPhase === 'updating' ? 'Actualizando...' : 'Actualizado'}
      </span>
    </div>
  );
};

export default SmoothUpdateIndicator;