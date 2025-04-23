// ConfirmDialog.tsx
import React from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const colors = {
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-500',
      confirmBg: 'bg-yellow-600 hover:bg-yellow-700'
    },
    danger: {
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      confirmBg: 'bg-red-600 hover:bg-red-700'
    },
    info: {
      icon: AlertTriangle,
      iconColor: 'text-blue-500',
      confirmBg: 'bg-blue-600 hover:bg-blue-700'
    }
  };

  const { icon: Icon, iconColor, confirmBg } = colors[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-lg bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-fadeIn">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <Icon className={`h-6 w-6 ${iconColor} mr-3`} />
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="ml-auto">
              <X className="h-5 w-5 text-gray-500 hover:text-gray-700" />
            </button>
          </div>
          
          <p className="text-gray-600 mb-6">{message}</p>
          
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`px-4 py-2 ${confirmBg} text-white rounded-md transition-colors flex items-center`}
            >
              <Check className="h-4 w-4 mr-1" />
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;