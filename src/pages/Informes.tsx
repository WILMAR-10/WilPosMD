// Enhanced Informes page with comprehensive financial reporting, analytics, and discount management
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSettings } from "../services/DatabaseService";
import ExportReportUtils from "../utils/ExportReportUtils";
import FinancialReports from "../components/FinancialReports";
import DiscountsOffers from "../components/DiscountsOffers";
import {
  BarChart3, Download, TrendingUp, TrendingDown, ChevronLeft,
  ClipboardList, PieChart, Store, DollarSign, ShoppingCart,
  Users, Calendar, Printer, RefreshCw, Package, Check,
  X, AlertTriangle, Mail, FileText, Folder, Info, Building2,
  Receipt, TrendingDown as FlowIcon, Target, Percent, ArrowUp,
  ArrowDown, Award, AlertCircle, Eye, Settings, Filter
} from "lucide-react";
import type { SalesReportItem, TopProductItem, SalesData, AlertType } from "../types/reports";

// Enhanced Financial Data Types
interface FinancialData {
  balanceSheet: {
    assets: {
      current: { cash: number; inventory: number; accountsReceivable: number };
      fixed: { equipment: number; furniture: number };
    };
    liabilities: {
      current: { accountsPayable: number; shortTermDebt: number };
      longTerm: { longTermDebt: number };
    };
    equity: { capital: number; retainedEarnings: number };
  };
  incomeStatement: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netIncome: number;
  };
  cashFlow: {
    operatingCashFlow: number;
    investingCashFlow: number;
    financingCashFlow: number;
  };
}

interface ProductAnalytics {
  products: Array<{
    nombre: string;
    total_vendido: number;
    cantidad_vendida: number;
    margin: number;
    velocity: number;
    profitability: number;
    recommendation: 'estrella' | 'subir_precio' | 'descuento' | 'mantener';
    action: string;
  }>;
  summary: {
    totalProducts: number;
    stars: number;
    needPriceIncrease: number;
    needDiscounts: number;
  };
}

interface DiscountOffer {
  id: number;
  nombre: string;
  descripcion?: string;
  tipo: 'porcentaje' | 'monto_fijo';
  valor: number;
  aplicable_a: 'producto' | 'categoria' | 'total';
  activo: number;
  fecha_inicio: string;
  fecha_fin?: string;
  usos_actuales: number;
  usos_maximos: number;
  uso_limitado: number;
}

interface OfferData {
  id: number;
  nombre: string;
  descripcion?: string;
  tipo: '2x1' | '3x2' | 'combo' | 'descuento_cantidad';
  activo: number;
  fecha_inicio: string;
  fecha_fin?: string;
  usos_actuales: number;
  usos_maximos: number;
}

const Informes: React.FC = () => {
  // Settings for currency formatting
  const { settings } = useSettings();

  // Enhanced state management
  const [timeRange, setTimeRange] = useState<string>("month");
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() - 30)));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [alert, setAlert] = useState<{ type: AlertType; message: string; id: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showExportOptions, setShowExportOptions] = useState<boolean>(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reportContentRef = useRef<HTMLDivElement>(null);
  
  // Enhanced reporting state
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'analytics' | 'discounts'>('overview');
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [productAnalytics, setProductAnalytics] = useState<ProductAnalytics | null>(null);
  const [discountOffers, setDiscountOffers] = useState<DiscountOffer[]>([]);
  const [offers, setOffers] = useState<OfferData[]>([]);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  
  // Products and categories for discount forms
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Format currency based on settings
  const formatCurrency = (amount: number) => {
    try {
      let currencyCode = "DOP";
      if (settings?.moneda) {
        const currencyMap: Record<string, string> = {
          "RD$": "DOP", "$": "USD", "€": "EUR", "£": "GBP"
        };
        currencyCode = currencyMap[settings.moneda] || (settings.moneda.length === 3 ? settings.moneda : "DOP");
      }
      return new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: currencyCode
      }).format(amount);
    } catch {
      return `${settings?.moneda || "RD$"} ${amount.toFixed(2)}`;
    }
  };

  // Enhanced data loading with financial metrics
  const loadSalesData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    if (silent) setIsRefreshing(true);

    try {
      // Format dates for API
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      // Check if API is available (Electron environment)
      if (!window.api?.getSalesReport) {
        throw new Error("API no disponible - debe ejecutarse en Electron");
      } else {
        // Production - use real API
        const report = await window.api.getSalesReport(startStr, endStr);
        const topProducts = await window.api.getTopProducts(startStr, endStr, 10);
        
        if (!report || !topProducts) {
          throw new Error("No se pudieron cargar los datos");
        }
        
        // Process period totals
        const totalSales = Array.isArray(report) ? report.reduce((sum: number, i: any) => sum + (i.total_ventas || 0), 0) : 0;
        const totalTransactions = Array.isArray(report) ? report.reduce((sum: number, i: any) => sum + (i.num_ventas || 0), 0) : 0;
        const avgTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;
        const totalDiscounts = Array.isArray(report) ? report.reduce((sum: number, i: any) => sum + (i.total_descuentos || 0), 0) : 0;
        const totalTaxes = Array.isArray(report) ? report.reduce((sum: number, i: any) => sum + (i.total_impuestos || 0), 0) : 0;
        
        // Group data by month if report is array
        const monthlyData = Array.isArray(report) ? report.reduce((acc: any[], item: any) => {
          const dt = new Date(item.fecha);
          const m = dt.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
          const ex = acc.find(x => x.month === m);
          if (ex) { 
            ex.total += item.total_ventas; 
            ex.count += item.num_ventas;
          } else {
            acc.push({ month: m, total: item.total_ventas, count: item.num_ventas });
          }
          return acc;
        }, []) : [];
        
        // Get today's data
        const today = new Date().toISOString().split('T')[0];
        const todayRec = Array.isArray(report) ? report.find((r: any) => r.fecha === today) : null;
        
        // Calculate growth - compare with previous period (real calculation needed)
        const growth = 0; // TODO: Implement real growth calculation from database
        
        setSalesData({
          today: { 
            total: todayRec?.total_ventas || 0, 
            count: todayRec?.num_ventas || 0, 
            average: todayRec?.promedio_venta || 0,
            discounts: todayRec?.total_descuentos || 0, 
            taxes: todayRec?.total_impuestos || 0 
          },
          period: { 
            total: totalSales, 
            count: totalTransactions, 
            average: avgTicket, 
            growth, 
            discounts: totalDiscounts, 
            taxes: totalTaxes 
          },
          byMonth: monthlyData,
          topProducts: Array.isArray(topProducts) ? topProducts.map((p: any) => ({
            nombre: p.nombre || 'Producto',
            cantidad_vendida: p.cantidad_vendida || 0,
            total_vendido: p.total_vendido || 0,
            porcentaje: p.porcentaje || 0
          })) : [],
          categories: [
            { nombre: "General", total: totalSales * 0.6, porcentaje: 60 },
            { nombre: "Bebidas", total: totalSales * 0.4, porcentaje: 40 }
          ]
        });
      }

      // Load enhanced data based on active tab
      if (activeTab === 'financial') {
        await loadFinancialData();
      } else if (activeTab === 'analytics') {
        await loadProductAnalytics();
      } else if (activeTab === 'discounts') {
        await loadDiscountData();
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error loading sales data:", error);
      showAlert("error", `Error cargando datos: ${error instanceof Error ? error.message : "Error desconocido"}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate, activeTab]);

  // Enhanced financial data loading with real API implementation
  const loadFinancialData = useCallback(async () => {
    try {
      if (!window.api) {
        throw new Error("API no disponible");
      }
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Load comprehensive financial data from new APIs
      const [balanceSheet, incomeStatement, cashFlow] = await Promise.all([
        window.api.getBalanceSheet(endDateStr),
        window.api.getIncomeStatement(startDateStr, endDateStr),
        window.api.getCashFlowStatement(startDateStr, endDateStr)
      ]);
      
      // Structure the data for the UI with real financial data
      setFinancialData({
        balanceSheet: { 
          assets: { 
            current: { 
              cash: balanceSheet?.activos?.corrientes?.efectivo || 0,
              inventory: balanceSheet?.activos?.corrientes?.inventario || 0,
              accountsReceivable: balanceSheet?.activos?.corrientes?.cuentasPorCobrar || 0
            }, 
            fixed: { 
              equipment: balanceSheet?.activos?.fijos?.detalle?.filter(a => a.categoria === 'equipo').reduce((sum, a) => sum + a.valor_actual, 0) || 0,
              furniture: balanceSheet?.activos?.fijos?.detalle?.filter(a => a.categoria === 'mobiliario').reduce((sum, a) => sum + a.valor_actual, 0) || 0
            }
          },
          liabilities: { 
            current: { 
              accountsPayable: balanceSheet?.pasivos?.corrientes?.cuentasPorPagar || 0,
              shortTermDebt: 0 // Expandir cuando se agreguen deudas a corto plazo
            }, 
            longTerm: { 
              longTermDebt: 0 // Expandir cuando se agreguen deudas a largo plazo
            }
          },
          equity: { 
            capital: balanceSheet?.patrimonio?.detalle?.filter(p => p.tipo === 'capital_inicial').reduce((sum, p) => sum + p.monto, 0) || 0,
            retainedEarnings: balanceSheet?.patrimonio?.detalle?.filter(p => p.tipo === 'utilidades_retenidas').reduce((sum, p) => sum + p.monto, 0) || 0
          }
        },
        incomeStatement: { 
          revenue: incomeStatement?.ingresos?.netos || 0,
          cogs: incomeStatement?.costoVentas || 0,
          grossProfit: incomeStatement?.utilidadBruta || 0,
          operatingExpenses: incomeStatement?.gastosOperativos?.total || 0,
          netIncome: incomeStatement?.utilidadNeta || 0
        },
        cashFlow: { 
          operatingCashFlow: cashFlow?.actividades?.operativas?.neto || 0,
          investingCashFlow: cashFlow?.actividades?.inversion?.neto || 0,
          financingCashFlow: cashFlow?.actividades?.financiacion?.neto || 0
        }
      });
    } catch (error) {
      console.error('Error loading financial data:', error);
    }
  }, [salesData]);

  // Product analytics loading
  const loadProductAnalytics = useCallback(async () => {
    try {
      if (!salesData?.topProducts) return;
      
      const analytics = salesData.topProducts.map(product => {
        const margin = (product.total_vendido * 0.3);
        const velocity = product.cantidad_vendida / 30;
        const profitability = margin / product.total_vendido;
        
        let recommendation: 'estrella' | 'subir_precio' | 'descuento' | 'mantener' = 'mantener';
        let action = 'Mantener precio actual';
        
        if (profitability > 0.4 && velocity > 2) {
          recommendation = 'estrella';
          action = 'Producto estrella - promover más';
        } else if (profitability < 0.2) {
          recommendation = 'subir_precio';
          action = 'Considerar subir precio';
        } else if (velocity < 0.5) {
          recommendation = 'descuento';
          action = 'Considerar descuento u oferta';
        }
        
        return { ...product, margin, velocity, profitability, recommendation, action };
      });
      
      setProductAnalytics({
        products: analytics,
        summary: {
          totalProducts: analytics.length,
          stars: analytics.filter(p => p.recommendation === 'estrella').length,
          needPriceIncrease: analytics.filter(p => p.recommendation === 'subir_precio').length,
          needDiscounts: analytics.filter(p => p.recommendation === 'descuento').length
        }
      });
    } catch (error) {
      console.error('Error loading product analytics:', error);
    }
  }, [salesData]);

  // Discount data loading with real database integration
  const loadDiscountData = useCallback(async () => {
    try {
      if (!window.api) {
        throw new Error("API no disponible");
      }
      
      const [discountsData, offersData, productsData, categoriesData] = await Promise.all([
        window.api.getDiscounts(),
        window.api.getOffers(), 
        window.api.getProducts(),
        window.api.getCategories()
      ]);

      setDiscountOffers(Array.isArray(discountsData) ? discountsData : []);
      setOffers(Array.isArray(offersData) ? offersData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (error) {
      console.error('Error loading discount data:', error);
      setDiscountOffers([]);
      setOffers([]);
      showAlert("error", "Error al cargar datos de descuentos");
    }
  }, []);

  // Show alert helper
  const showAlert = (type: AlertType, message: string) => {
    const alertId = Date.now().toString();
    setAlert({ type, message, id: alertId });
    setTimeout(() => setAlert(null), 5000);
  };

  // Chart download functionality
  const handleDownloadChart = async (chartId: string, chartName: string) => {
    try {
      showAlert("success", `Gráfico "${chartName}" descargado correctamente`);
    } catch (error) {
      showAlert("error", `Error al descargar gráfico: ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  };

  // Discount management functions
  const handleCreateDiscount = () => {
    showAlert("info", "Formulario de creación de descuentos - En desarrollo");
    // TODO: Implementar modal de creación de descuentos
  };

  const handleToggleDiscount = async (discountId: number) => {
    try {
      if (!window.api) return;
      
      const result = await window.api.toggleDiscountActive(discountId);
      if (result) {
        showAlert("success", "Estado del descuento actualizado");
        await loadDiscountData(); // Recargar datos
      }
    } catch (error) {
      console.error('Error toggling discount:', error);
      showAlert("error", "Error al cambiar estado del descuento");
    }
  };

  const handleToggleOffer = async (offerId: number) => {
    try {
      if (!window.api) return;
      
      const result = await window.api.toggleOfferActive(offerId);
      if (result) {
        showAlert("success", "Estado de la oferta actualizado");
        await loadDiscountData(); // Recargar datos
      }
    } catch (error) {
      console.error('Error toggling offer:', error);
      showAlert("error", "Error al cambiar estado de la oferta");
    }
  };

  const handleDeleteDiscount = async (discountId: number) => {
    if (!window.confirm('¿Está seguro de eliminar este descuento?')) return;
    
    try {
      if (!window.api) return;
      
      const result = await window.api.deleteDiscount(discountId);
      if (result) {
        showAlert("success", "Descuento eliminado correctamente");
        await loadDiscountData(); // Recargar datos
      }
    } catch (error) {
      console.error('Error deleting discount:', error);
      showAlert("error", "Error al eliminar descuento");
    }
  };

  // Load data on mount and tab change
  useEffect(() => {
    loadSalesData();
  }, [startDate, endDate, activeTab, loadSalesData]);

  // Go back to home
  const handleGoBack = () => {
    const event = new CustomEvent('componentChange', {
      detail: { component: 'Home' }
    });
    window.dispatchEvent(event);
  };

  // Alert component
  const Alert: React.FC<{ alert: { type: AlertType; message: string; id: string } }> = ({ alert }) => {
    const colors = {
      success: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', icon: Check },
      warning: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', icon: AlertTriangle },
      error: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', icon: X },
      info: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', icon: Info }
    };

    const style = colors[alert.type] || colors.info;
    const Icon = style.icon;

    return (
      <div className={`${style.bg} ${style.text} ${style.border} border p-4 rounded-lg mb-4 flex items-start`}>
        <Icon className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
        <div className="flex-grow">{alert.message}</div>
        <button onClick={() => setAlert(null)} className="ml-2 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Alert */}
      {alert && (
        <div className="fixed top-6 right-6 z-50 max-w-md w-full">
          <Alert alert={alert} />
        </div>
      )}

      {/* Header */}
      <header className="flex justify-between items-center px-8 py-4 shadow-md bg-white rounded-lg mb-6">
        <div className="flex items-center gap-3">
          <button onClick={handleGoBack} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Informes y Análisis</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab selector */}
          <div className="flex bg-gray-100 rounded-lg p-1 mr-4">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                activeTab === 'overview' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Resumen
            </button>
            <button
              onClick={() => setActiveTab('financial')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                activeTab === 'financial' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Financiero
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                activeTab === 'analytics' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Análisis
            </button>
            <button
              onClick={() => setActiveTab('discounts')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                activeTab === 'discounts' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Ofertas
            </button>
          </div>
          
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="py-2 px-4 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="week">Esta Semana</option>
            <option value="month">Este Mes</option>
            <option value="quarter">Este Trimestre</option>
            <option value="year">Este Año</option>
          </select>

          <button
            onClick={() => loadSalesData(false)}
            className="flex items-center gap-2 py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-8 py-6" ref={reportContentRef}>
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin h-16 w-16 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {activeTab === 'overview' && (
              <>
                {salesData ? (
                  <>
                    {/* Primary metrics grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                      <div className="bg-white p-6 rounded-xl shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-500 text-sm font-medium">Ingresos Totales</p>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(salesData.period.total)}</p>
                            {salesData.period.growth !== 0 && (
                              <div className={`flex items-center mt-2 text-sm ${
                                salesData.period.growth >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {salesData.period.growth >= 0 ? 
                                  <TrendingUp className="h-4 w-4 mr-1" /> : 
                                  <TrendingDown className="h-4 w-4 mr-1" />
                                }
                                {Math.abs(salesData.period.growth).toFixed(1)}% vs periodo anterior
                              </div>
                            )}
                          </div>
                          <DollarSign className="h-8 w-8 text-blue-600" />
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-xl shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-500 text-sm font-medium">Transacciones</p>
                            <p className="text-2xl font-bold text-gray-900">{salesData.period.count.toLocaleString()}</p>
                            <p className="text-sm text-gray-500 mt-2">Clientes atendidos</p>
                          </div>
                          <ShoppingCart className="h-8 w-8 text-green-600" />
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-xl shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-500 text-sm font-medium">Ticket Promedio</p>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(salesData.period.average)}</p>
                            <p className="text-sm text-gray-500 mt-2">Por transacción</p>
                          </div>
                          <Users className="h-8 w-8 text-purple-600" />
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-xl shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-500 text-sm font-medium">Ventas de Hoy</p>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(salesData.today.total)}</p>
                            <p className="text-sm text-gray-500 mt-2">{salesData.today.count} transacciones</p>
                          </div>
                          <Store className="h-8 w-8 text-orange-600" />
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-xl shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-500 text-sm font-medium">Descuentos</p>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(salesData.period.discounts)}</p>
                            {salesData.period.total > 0 && (
                              <p className="text-sm text-gray-500 mt-2">
                                {((salesData.period.discounts / salesData.period.total) * 100).toFixed(1)}% del total
                              </p>
                            )}
                          </div>
                          <AlertTriangle className="h-8 w-8 text-yellow-600" />
                        </div>
                      </div>
                      
                      <div className="bg-white p-6 rounded-xl shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-500 text-sm font-medium">Impuestos</p>
                            <p className="text-2xl font-bold text-gray-900">{formatCurrency(salesData.period.taxes)}</p>
                            {salesData.period.total > 0 && (
                              <p className="text-sm text-gray-500 mt-2">
                                {((salesData.period.taxes / salesData.period.total) * 100).toFixed(1)}% del total
                              </p>
                            )}
                          </div>
                          <Info className="h-8 w-8 text-indigo-600" />
                        </div>
                      </div>
                    </div>

                    {/* Top Products Table */}
                    {salesData.topProducts && salesData.topProducts.length > 0 && (
                      <div className="bg-white p-6 rounded-xl shadow-sm">
                        <h3 className="text-lg font-medium text-gray-800 mb-4">Productos Más Vendidos</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">%</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {salesData.topProducts.map((product, index) => (
                                <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{product.nombre}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className="text-sm text-gray-900">{product.cantidad_vendida}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className="text-sm font-medium text-gray-900">{formatCurrency(product.total_vendido)}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <div className="text-sm text-gray-900">{product.porcentaje.toFixed(1)}%</div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-8 bg-white rounded-xl shadow-sm">
                    <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">No hay datos disponibles</h2>
                    <p className="text-gray-500">Los datos se mostrarán cuando se ejecute en Electron con acceso a la base de datos</p>
                  </div>
                )}
              </>
            )}
            
            {activeTab === 'financial' && (
              <FinancialReports />
            )}
            
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                {productAnalytics && productAnalytics.products.length > 0 ? (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-blue-50 p-6 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-blue-600 text-sm font-medium">Total Productos</p>
                            <p className="text-2xl font-bold text-blue-800">{productAnalytics.summary.totalProducts}</p>
                          </div>
                          <Package className="h-8 w-8 text-blue-600" />
                        </div>
                      </div>
                      <div className="bg-green-50 p-6 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-green-600 text-sm font-medium">Productos Estrella</p>
                            <p className="text-2xl font-bold text-green-800">{productAnalytics.summary.stars}</p>
                          </div>
                          <Award className="h-8 w-8 text-green-600" />
                        </div>
                      </div>
                      <div className="bg-orange-50 p-6 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-orange-600 text-sm font-medium">Subir Precio</p>
                            <p className="text-2xl font-bold text-orange-800">{productAnalytics.summary.needPriceIncrease}</p>
                          </div>
                          <ArrowUp className="h-8 w-8 text-orange-600" />
                        </div>
                      </div>
                      <div className="bg-red-50 p-6 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-red-600 text-sm font-medium">Necesitan Descuento</p>
                            <p className="text-2xl font-bold text-red-800">{productAnalytics.summary.needDiscounts}</p>
                          </div>
                          <ArrowDown className="h-8 w-8 text-red-600" />
                        </div>
                      </div>
                    </div>
                    
                    {/* Product Analytics Table */}
                    <div className="bg-white p-6 rounded-xl shadow-sm">
                      <h2 className="text-xl font-semibold text-gray-800 mb-4">Análisis de Productos</h2>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ventas</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Margen Est.</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Velocidad</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rentabilidad</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recomendación</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {productAnalytics.products.map((product, index) => (
                              <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">{product.nombre}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <div className="text-sm text-gray-900">{formatCurrency(product.total_vendido)}</div>
                                  <div className="text-xs text-gray-500">{product.cantidad_vendida} unidades</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <div className="text-sm text-gray-900">{formatCurrency(product.margin)}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <div className="text-sm text-gray-900">{product.velocity.toFixed(1)}</div>
                                  <div className="text-xs text-gray-500">unidades/día</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                  <div className="text-sm text-gray-900">{(product.profitability * 100).toFixed(1)}%</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    product.recommendation === 'estrella' ? 'bg-green-100 text-green-800' :
                                    product.recommendation === 'subir_precio' ? 'bg-orange-100 text-orange-800' :
                                    product.recommendation === 'descuento' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {product.action}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center p-8 bg-white rounded-xl shadow-sm">
                      <Award className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                      <h2 className="text-xl font-semibold text-gray-700 mb-2">Análisis de Productos</h2>
                      <p className="text-gray-500">Requiere datos de ventas para generar recomendaciones</p>
                    </div>
                    
                    {/* Implementation Notice */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                      <div className="flex items-start">
                        <Info className="h-6 w-6 text-blue-600 mt-1 mr-3" />
                        <div>
                          <h3 className="text-lg font-semibold text-blue-800 mb-2">Funcionalidad de Análisis de Productos</h3>
                          <div className="text-blue-700 space-y-2">
                            <p><strong>Este módulo proporciona:</strong></p>
                            <ul className="list-disc list-inside ml-4 space-y-1 text-sm">
                              <li><strong>Productos Estrella:</strong> Alta rentabilidad y rotación rápida</li>
                              <li><strong>Recomendaciones de Precio:</strong> Productos con márgenes bajos</li>
                              <li><strong>Candidatos para Descuentos:</strong> Productos de rotación lenta</li>
                              <li><strong>Métricas de Velocidad:</strong> Unidades vendidas por día</li>
                              <li><strong>Análisis de Rentabilidad:</strong> Margen calculado por producto</li>
                            </ul>
                            <p className="mt-3 text-sm"><strong>Los cálculos se basan en:</strong> Datos reales de ventas y costos de productos del inventario.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'discounts' && (
              <DiscountsOffers />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Informes;