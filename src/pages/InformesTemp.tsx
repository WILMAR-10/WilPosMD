// Enhanced Informes page with real discount and offer management
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSettings } from "../services/DatabaseService";
import ExportReportUtils from "../utils/ExportReportUtils";
import {
  BarChart3, Download, TrendingUp, TrendingDown, ChevronLeft,
  ClipboardList, PieChart, Store, DollarSign, ShoppingCart,
  Users, Calendar, Printer, RefreshCw, Package, Check,
  X, AlertTriangle, Mail, FileText, Folder, Info, Building2,
  Receipt, TrendingDown as FlowIcon, Target, Percent, ArrowUp,
  ArrowDown, Award, AlertCircle, Eye, Settings, Filter,
  Plus, Edit2, Trash2, Power, PowerOff, Clock, TagIcon
} from "lucide-react";
import type { SalesReportItem, TopProductItem, SalesData, AlertType } from "../types/reports";

// Enhanced Types
interface DiscountData {
  id: number;
  nombre: string;
  descripcion?: string;
  tipo: 'porcentaje' | 'monto_fijo';
  valor: number;
  aplicable_a: 'producto' | 'categoria' | 'total';
  producto_id?: number;
  categoria?: string;
  activo: number;
  fecha_inicio: string;
  fecha_fin?: string;
  codigo_cupon?: string;
  automatico: number;
  uso_limitado: number;
  usos_maximos: number;
  usos_actuales: number;
}

interface OfferData {
  id: number;
  nombre: string;
  descripcion?: string;
  tipo: '2x1' | '3x2' | 'combo' | 'descuento_cantidad';
  productos_requeridos: string;
  productos_gratis?: string;
  precio_combo?: number;
  descuento_porcentaje?: number;
  cantidad_minima: number;
  activo: number;
  fecha_inicio: string;
  fecha_fin?: string;
}

const Informes: React.FC = () => {
  const { settings } = useSettings();
  
  // State management
  const [timeRange, setTimeRange] = useState<string>("month");
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [alert, setAlert] = useState<{ type: AlertType; message: string; id: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'analytics' | 'discounts'>('discounts');
  
  // Discount and offer management
  const [discounts, setDiscounts] = useState<DiscountData[]>([]);
  const [offers, setOffers] = useState<OfferData[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountData | null>(null);
  const [editingOffer, setEditingOffer] = useState<OfferData | null>(null);
  
  // Products list for form dropdowns
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Format currency
  const formatCurrency = (amount: number) => {
    const currencySymbol = settings?.moneda || "RD$";
    return `${currencySymbol}${amount.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Load initial data
  useEffect(() => {
    loadSalesData();
    loadDiscountsAndOffers();
    loadProductsAndCategories();
  }, [startDate, endDate]);

  const loadSalesData = async () => {
    try {
      setIsLoading(true);
      
      if (window.api) {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        const [salesReport, topProducts] = await Promise.all([
          window.api.getSalesReport(startDateStr, endDateStr),
          window.api.getTopProducts(startDateStr, endDateStr, 10)
        ]);

        setSalesData({
          salesReport: salesReport || [],
          topProducts: topProducts || []
        });
      }
    } catch (error) {
      console.error('Error loading sales data:', error);
      showAlert('error', 'Error al cargar datos de ventas');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDiscountsAndOffers = async () => {
    try {
      setDiscountsLoading(true);
      
      if (window.api) {
        const [discountsData, offersData] = await Promise.all([
          window.api.getDiscounts(),
          window.api.getOffers()
        ]);

        setDiscounts(Array.isArray(discountsData) ? discountsData : []);
        setOffers(Array.isArray(offersData) ? offersData : []);
      }
    } catch (error) {
      console.error('Error loading discounts and offers:', error);
      showAlert('error', 'Error al cargar descuentos y ofertas');
    } finally {
      setDiscountsLoading(false);
    }
  };

  const loadProductsAndCategories = async () => {
    try {
      if (window.api) {
        const [productsData, categoriesData] = await Promise.all([
          window.api.getProducts(),
          window.api.getCategories()
        ]);

        setProducts(Array.isArray(productsData) ? productsData : []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      }
    } catch (error) {
      console.error('Error loading products and categories:', error);
    }
  };

  const showAlert = (type: AlertType, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setAlert({ type, message, id });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleToggleDiscountActive = async (discountId: number) => {
    try {
      if (window.api) {
        const result = await window.api.toggleDiscountActive(discountId);
        if (result) {
          showAlert('success', 'Estado del descuento actualizado');
          loadDiscountsAndOffers();
        }
      }
    } catch (error) {
      console.error('Error toggling discount:', error);
      showAlert('error', 'Error al cambiar estado del descuento');
    }
  };

  const handleToggleOfferActive = async (offerId: number) => {
    try {
      if (window.api) {
        const result = await window.api.toggleOfferActive(offerId);
        if (result) {
          showAlert('success', 'Estado de la oferta actualizado');
          loadDiscountsAndOffers();
        }
      }
    } catch (error) {
      console.error('Error toggling offer:', error);
      showAlert('error', 'Error al cambiar estado de la oferta');
    }
  };

  const handleDeleteDiscount = async (discountId: number) => {
    if (!window.confirm('¿Está seguro de eliminar este descuento?')) return;
    
    try {
      if (window.api) {
        const result = await window.api.deleteDiscount(discountId);
        if (result) {
          showAlert('success', 'Descuento eliminado correctamente');
          loadDiscountsAndOffers();
        }
      }
    } catch (error) {
      console.error('Error deleting discount:', error);
      showAlert('error', 'Error al eliminar descuento');
    }
  };

  const handleDeleteOffer = async (offerId: number) => {
    if (!window.confirm('¿Está seguro de eliminar esta oferta?')) return;
    
    try {
      if (window.api) {
        const result = await window.api.deleteOffer(offerId);
        if (result) {
          showAlert('success', 'Oferta eliminada correctamente');
          loadDiscountsAndOffers();
        }
      }
    } catch (error) {
      console.error('Error deleting offer:', error);
      showAlert('error', 'Error al eliminar oferta');
    }
  };

  const renderDiscountsTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Percent className="text-blue-600" />
            Gestión de Descuentos y Ofertas
          </h2>
          <p className="text-gray-600 mt-1">
            Administra descuentos temporales y ofertas especiales
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowDiscountModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={16} />
            Nuevo Descuento
          </button>
          <button
            onClick={() => setShowOfferModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <TagIcon size={16} />
            Nueva Oferta
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Descuentos Activos</p>
              <p className="text-2xl font-bold text-blue-600">
                {discounts.filter(d => d.activo === 1).length}
              </p>
            </div>
            <Percent className="text-blue-600" size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ofertas Activas</p>
              <p className="text-2xl font-bold text-green-600">
                {offers.filter(o => o.activo === 1).length}
              </p>
            </div>
            <TagIcon className="text-green-600" size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Descuentos</p>
              <p className="text-2xl font-bold text-gray-800">
                {discounts.length}
              </p>
            </div>
            <ClipboardList className="text-gray-600" size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Ofertas</p>
              <p className="text-2xl font-bold text-gray-800">
                {offers.length}
              </p>
            </div>
            <Award className="text-gray-600" size={24} />
          </div>
        </div>
      </div>

      {/* Discounts Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Descuentos</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vigencia
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usos
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {discounts.map((discount) => (
                <tr key={discount.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {discount.nombre}
                    </div>
                    {discount.descripcion && (
                      <div className="text-sm text-gray-500">
                        {discount.descripcion}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {discount.tipo === 'porcentaje' ? 'Porcentaje' : 'Monto Fijo'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    {discount.tipo === 'porcentaje' 
                      ? `${discount.valor}%` 
                      : formatCurrency(discount.valor)}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      discount.activo === 1
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {discount.activo === 1 ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    <div>{new Date(discount.fecha_inicio).toLocaleDateString()}</div>
                    {discount.fecha_fin && (
                      <div className="text-gray-500">
                        hasta {new Date(discount.fecha_fin).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    {discount.uso_limitado === 1 
                      ? `${discount.usos_actuales}/${discount.usos_maximos}`
                      : 'Ilimitado'}
                  </td>
                  <td className="px-4 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingDiscount(discount);
                          setShowDiscountModal(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleDiscountActive(discount.id)}
                        className={`${
                          discount.activo === 1 ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                        }`}
                        title={discount.activo === 1 ? 'Desactivar' : 'Activar'}
                      >
                        {discount.activo === 1 ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                      <button
                        onClick={() => handleDeleteDiscount(discount.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {discounts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Percent size={48} className="mx-auto mb-2 opacity-50" />
              <p>No hay descuentos registrados</p>
              <p className="text-sm">Crea tu primer descuento haciendo clic en "Nuevo Descuento"</p>
            </div>
          )}
        </div>
      </div>

      {/* Offers Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">Ofertas</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vigencia
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {offers.map((offer) => (
                <tr key={offer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {offer.nombre}
                    </div>
                    {offer.descripcion && (
                      <div className="text-sm text-gray-500">
                        {offer.descripcion}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {offer.tipo.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      offer.activo === 1
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {offer.activo === 1 ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    <div>{new Date(offer.fecha_inicio).toLocaleDateString()}</div>
                    {offer.fecha_fin && (
                      <div className="text-gray-500">
                        hasta {new Date(offer.fecha_fin).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingOffer(offer);
                          setShowOfferModal(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleOfferActive(offer.id)}
                        className={`${
                          offer.activo === 1 ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                        }`}
                        title={offer.activo === 1 ? 'Desactivar' : 'Activar'}
                      >
                        {offer.activo === 1 ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                      <button
                        onClick={() => handleDeleteOffer(offer.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {offers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <TagIcon size={48} className="mx-auto mb-2 opacity-50" />
              <p>No hay ofertas registradas</p>
              <p className="text-sm">Crea tu primera oferta haciendo clic en "Nueva Oferta"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Alert component
  const AlertComponent = ({ alert }: { alert: { type: AlertType; message: string; id: string } }) => (
    <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      alert.type === 'success' ? 'bg-green-100 border-green-400 text-green-700' :
      alert.type === 'error' ? 'bg-red-100 border-red-400 text-red-700' :
      alert.type === 'warning' ? 'bg-yellow-100 border-yellow-400 text-yellow-700' :
      'bg-blue-100 border-blue-400 text-blue-700'
    } border-l-4`}>
      <div className="flex items-center">
        <div className="flex-shrink-0">
          {alert.type === 'success' && <Check className="h-5 w-5" />}
          {alert.type === 'error' && <X className="h-5 w-5" />}
          {alert.type === 'warning' && <AlertTriangle className="h-5 w-5" />}
          {alert.type === 'info' && <Info className="h-5 w-5" />}
        </div>
        <div className="ml-3">
          <p className="text-sm font-medium">{alert.message}</p>
        </div>
        <div className="ml-auto pl-3">
          <button
            onClick={() => setAlert(null)}
            className="text-current hover:opacity-75"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Sistema de Informes y Análisis
          </h1>
          <p className="text-gray-600">
            Reportes financieros completos y gestión de descuentos y ofertas
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            {[
              { id: 'overview', name: 'Resumen', icon: BarChart3 },
              { id: 'financial', name: 'Financiero', icon: Building2 },
              { id: 'analytics', name: 'Análisis', icon: TrendingUp },
              { id: 'discounts', name: 'Descuentos', icon: Percent }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
                >
                  <Icon size={16} />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border p-6 min-h-96">
          {activeTab === 'discounts' ? (
            renderDiscountsTab()
          ) : (
            <div className="text-center py-16 text-gray-500">
              <Info size={48} className="mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Funcionalidad en Desarrollo</h3>
              <p className="mb-4">
                {activeTab === 'overview' && "Panel de resumen con métricas clave y gráficos interactivos"}
                {activeTab === 'financial' && "Reportes financieros completos: Balance General, Estado de Resultados y Flujo de Efectivo"}
                {activeTab === 'analytics' && "Análisis de productos: rentabilidad, recomendaciones de precios y estrategias"}
              </p>
              <p className="text-sm">
                Esta sección estará disponible próximamente con datos reales de la base de datos.
              </p>
            </div>
          )}
        </div>

        {/* Loading overlay */}
        {(isLoading || discountsLoading) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl flex items-center gap-3">
              <RefreshCw className="animate-spin text-blue-600" size={24} />
              <span className="text-gray-700">Cargando datos...</span>
            </div>
          </div>
        )}

        {/* Alert */}
        {alert && <AlertComponent alert={alert} />}
      </div>
    </div>
  );
};

export default InformesWithDiscounts;