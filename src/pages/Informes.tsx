// src/pages/Informes.tsx - Modern and intuitive dashboard component
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSettings } from "../services/DatabaseService";
import ExportReportUtils from "../utils/ExportReportUtils";
import {
  BarChart3, Download, TrendingUp, TrendingDown, ChevronLeft,
  ClipboardList, PieChart, Store, DollarSign, ShoppingCart,
  Users, Calendar, Printer, RefreshCw, Package, Check,
  X, AlertTriangle, Mail, FileText, Folder, Info
} from "lucide-react";
import type { SalesReportItem, TopProductItem, SalesData, AlertType } from "../types/reports";

const Informes: React.FC = () => {
  // Settings for currency formatting
  const { settings } = useSettings();

  // State for filters and tabs
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

  // Format currency based on settings
  const formatCurrency = (amount: number) => {
    try {
      // Extract proper currency code
      let currencyCode = "DOP"; // Default to Dominican Peso

      if (settings?.moneda) {
        // Handle common currency symbols
        const currencyMap: Record<string, string> = {
          "RD$": "DOP", // Dominican Peso
          "$": "USD",   // US Dollar
          "€": "EUR",   // Euro
          "£": "GBP"    // British Pound
        };
        
        if (currencyMap[settings.moneda]) {
          currencyCode = currencyMap[settings.moneda];
        } else if (settings.moneda.length === 3) {
          // If it's already a 3-letter code, use it directly
          currencyCode = settings.moneda;
        }
      }
      
      return new Intl.NumberFormat("es-DO", { 
        style: "currency", 
        currency: currencyCode,
        minimumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      // Fallback if Intl.NumberFormat fails
      return `${settings?.moneda || "RD$"} ${amount.toFixed(2)}`;
    }
  };

  // Enhanced loadSalesData with better error handling and data processing
  const loadSalesData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    setIsLoading(true);
    
    try {
      if (!window.api?.getSalesReport) {
        throw new Error("API no disponible");
      }
      
      // Format dates for API
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      
      // Fetch data from API
      const report: SalesReportItem[] = await window.api.getSalesReport(startStr, endStr);
      const topProducts: TopProductItem[] = await window.api.getTopProducts(startStr, endStr, 10);
      
      if (!report || !topProducts) {
        throw new Error("No se pudieron cargar los datos");
      }
      
      // Process period totals
      const totalSales = report.reduce((sum, i) => sum + i.total_ventas, 0);
      const totalTransactions = report.reduce((sum, i) => sum + i.num_ventas, 0);
      const avgTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;
      const totalDiscounts = report.reduce((sum, i) => sum + i.total_descuentos, 0);
      const totalTaxes = report.reduce((sum, i) => sum + i.total_impuestos, 0);
      
      // Group data by month
      const monthlyData = report.reduce((acc, item) => {
        const dt = new Date(item.fecha);
        const m = dt.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
        const ex = acc.find(x => x.month === m);
        if (ex) { 
          ex.total += item.total_ventas; 
          ex.count += item.num_ventas;
        } else {
          acc.push({ 
            month: m, 
            total: item.total_ventas, 
            count: item.num_ventas 
          });
        }
        return acc;
      }, [] as { month: string; total: number; count: number }[]);
      
      // Sort chronologically
      monthlyData.sort((a, b) => 
        new Date(a.month).getTime() - new Date(b.month).getTime()
      );
      
      // Calculate growth compared to previous period
      let growth = 0;
      if (monthlyData.length >= 2) {
        const last = monthlyData[monthlyData.length - 1].total;
        const prev = monthlyData[monthlyData.length - 2].total;
        growth = prev > 0 ? ((last - prev) / prev) * 100 : 0;
      }
      
      // Get today's data
      const todayStr = new Date().toISOString().split('T')[0];
      const todayRec = report.find(x => x.fecha === todayStr) || {
        num_ventas: 0,
        total_ventas: 0,
        promedio_venta: 0,
        total_descuentos: 0,
        total_impuestos: 0
      };
      
      // Process categories from top products
      const categories = topProducts.reduce((acc, p) => {
        // Try to get category from product or use default
        const cat = (p as any).categoria || 'Sin categoría';
        const ex = acc.find(c => c.category === cat);
        
        if (ex) {
          ex.total += p.total_vendido;
        } else {
          acc.push({ 
            category: cat, 
            total: p.total_vendido, 
            percentage: 0 
          });
        }
        return acc;
      }, [] as { category: string; total: number; percentage: number }[]);
      
      // Calculate percentage for each category
      const catSum = categories.reduce((s, c) => s + c.total, 0);
      categories.forEach(c => {
        c.percentage = catSum > 0 ? Math.round((c.total / catSum) * 100) : 0;
      });
      
      // Sort categories by total
      categories.sort((a, b) => b.total - a.total);
      
      // Set processed data
      setSalesData({
        today: { 
          total: todayRec.total_ventas, 
          count: todayRec.num_ventas, 
          average: todayRec.promedio_venta,
          discounts: todayRec.total_descuentos, 
          taxes: todayRec.total_impuestos 
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
        topProducts,
        categories
      });
      
      // Update last refresh timestamp
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error loading sales data:", error);
      setAlert({
        id: Date.now().toString(),
        type: "error",
        message: `Error cargando datos: ${error instanceof Error ? error.message : "Error desconocido"}`
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [startDate, endDate]);

  // Set up sync event listener
  function useSyncListener(callback: () => void) {
    useEffect(() => {
      // Events that should trigger a reports refresh
      const relevantEvents = [
        "sale:create", "sale:update", "sale:delete",
        "product:create", "product:update", "product:delete",
        "category:update", "sync:complete", "database:updated"
      ];

      const handleSyncEvent = (event: CustomEvent) => {
        const syncEvent = event.detail;
        if (relevantEvents.includes(syncEvent.type)) {
          console.log(`Refreshing reports due to ${syncEvent.type} event`);
          callback();
        }
      };

      window.addEventListener("sync-event", handleSyncEvent as EventListener);
      return () => {
        window.removeEventListener("sync-event", handleSyncEvent as EventListener);
      };
    }, [callback]);
  }

  // Set up automatic refresh interval
  useEffect(() => {
    // Refresh every 5 minutes
    const REFRESH_INTERVAL = 300000;

    // Clean up existing timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }

    // Set up new timer for background refresh
    refreshTimerRef.current = setInterval(() => {
      loadSalesData(true); // Silent refresh
    }, REFRESH_INTERVAL);

    // Clean up on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [loadSalesData]);

  // Update date range when time range changes
  useEffect(() => {
    const now = new Date();
    const newEndDate = new Date(now);
    const newStartDate = new Date(now);

    switch (timeRange) {
      case "week":
        newStartDate.setDate(now.getDate() - 7);
        break;
      case "month":
        newStartDate.setMonth(now.getMonth() - 1);
        break;
      case "quarter":
        newStartDate.setMonth(now.getMonth() - 3);
        break;
      case "year":
        newStartDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        newStartDate.setMonth(now.getMonth() - 1);
    }

    setStartDate(newStartDate);
    setEndDate(newEndDate);
  }, [timeRange]);

  // Load sales data when date range changes
  useEffect(() => {
    loadSalesData();
  }, [startDate, endDate, loadSalesData]);

  // Use the sync listener with optimized callback
  const refreshCallback = useCallback(() => {
    loadSalesData(false);
  }, [loadSalesData]);
  
  useSyncListener(refreshCallback);

  // Close alert after timeout
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        setAlert(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Event handlers
  const handleRefresh = () => loadSalesData(false);
  
  const handleGoBack = () => {
    const event = new CustomEvent("componentChange", {
      detail: { component: "Home" }
    });
    window.dispatchEvent(event);
  };
  
  const toggleExportOptions = () => setShowExportOptions(!showExportOptions);

  // Export handlers
  const handleExportReport = async () => {
    try {
      const api = window.api;
      const printerApi = window.printerApi;

      if (!api?.getAppPaths || !printerApi?.savePdf) {
        throw new Error("La API de exportación no está disponible");
      }

      setAlert({ 
        id: Date.now().toString(),
        type: "info", 
        message: "Generando informe, por favor espere..." 
      });

      // Get paths and create directory
      const paths = await api.getAppPaths();
      const docsPath = paths.documents;
      const reportPath = `${docsPath}/WilPOS/informe`;
      
      if (api.ensureDir) {
        const dirResult = await api.ensureDir(reportPath);
        if (!dirResult.success) {
          throw new Error(`No se pudo crear la carpeta: ${dirResult.error}`);
        }
      }

      // Generate filename and full path
      const filename = `informe-ventas-${startDate.toISOString().split('T')[0]}-a-${endDate.toISOString().split('T')[0]}.pdf`;
      const fullPath = `${reportPath}/${filename}`;

      // Generate HTML content
      const htmlContent = ExportReportUtils.generateSalesReportHTML(
        startDate, endDate, salesData!, formatCurrency
      );

      // Save as PDF
      const result = await printerApi.savePdf({
        html: htmlContent,
        path: fullPath,
        options: {
          printBackground: true,
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
          pageSize: "A4",
        }
      });

      if (result.success) {
        setAlert({ 
          id: Date.now().toString(),
          type: "success", 
          message: `Informe guardado como ${filename}` 
        });
        
        if (api.openFolder) {
          await api.openFolder(reportPath);
        }
      } else {
        throw new Error(result.error || "Error desconocido al guardar PDF");
      }
    } catch (error) {
      console.error("Error exporting report:", error);
      setAlert({
        id: Date.now().toString(),
        type: "error",
        message: `Error al exportar: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
    }
  };

  const handlePrintReport = async () => {
    try {
      if (!window.api?.printInvoice) {
        throw new Error("API de impresión no disponible");
      }

      setAlert({
        id: Date.now().toString(),
        type: "info",
        message: "Preparando impresión..."
      });

      // Generate HTML for printing
      const htmlContent = ExportReportUtils.generatePrintReportHTML(
        startDate, endDate, salesData!, formatCurrency
      );

      // Print
      const result = await window.api.printInvoice({
        html: htmlContent,
        printerName: settings?.impresora_termica,
        silent: false,
      });

      if (result.success) {
        setAlert({
          id: Date.now().toString(),
          type: "success",
          message: "Informe enviado a impresión"
        });
      } else {
        throw new Error(result.error || "Error al imprimir");
      }
    } catch (error) {
      console.error("Error printing report:", error);
      setAlert({
        id: Date.now().toString(),
        type: "error",
        message: `Error al imprimir: ${error instanceof Error ? error.message : "Error desconocido"}`
      });
    }
  };

  const handleEmailReport = async () => {
    try {
      const api = window.api;
      const printerApi = window.printerApi;

      if (!api?.getAppPaths || !printerApi?.savePdf) {
        throw new Error("La API de exportación no está disponible");
      }

      setAlert({ 
        id: Date.now().toString(),
        type: "info", 
        message: "Preparando informe para enviar por correo..." 
      });

      // Get paths and create directory
      const paths = await api.getAppPaths();
      const docsPath = paths.documents;
      const reportPath = `${docsPath}/WilPOS/informe`;
      
      if (api.ensureDir) {
        await api.ensureDir(reportPath);
      }

      // Generate filename and path
      const filename = `informe-ventas-${startDate.toISOString().split('T')[0]}-a-${endDate.toISOString().split('T')[0]}.pdf`;
      const fullPath = `${reportPath}/${filename}`;

      // Generate HTML content
      const htmlContent = ExportReportUtils.generateSalesReportHTML(
        startDate, endDate, salesData!, formatCurrency
      );

      // Save as PDF
      const saveResult = await printerApi.savePdf({
        html: htmlContent,
        path: fullPath,
        options: {
          printBackground: true,
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
          pageSize: "A4",
        }
      });
      
      if (!saveResult.success) {
        throw new Error(saveResult.error || "Error al guardar PDF");
      }

      // Send email
      if (api.sendMail) {
        const mailResult = await api.sendMail({
          subject: `Informe de Ventas ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
          body: `Adjunto el informe de ventas ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}.`,
          attachments: [fullPath],
        });
        
        if (!mailResult.success) {
          throw new Error(mailResult.error || "Error al enviar correo");
        }
        
        setAlert({ 
          id: Date.now().toString(),
          type: "success", 
          message: "Informe enviado por correo electrónico" 
        });
      } else {
        // Fallback to mailto
        const mailto = `mailto:?subject=Informe%20de%20Ventas&body=Adjunto:${encodeURIComponent(fullPath)}`;
        window.open(mailto);
        
        setAlert({ 
          id: Date.now().toString(),
          type: "info", 
          message: `Informe guardado en ${fullPath}. Adjúntalo manualmente.` 
        });
      }
    } catch (error) {
      console.error("Error sending report by email:", error);
      setAlert({
        id: Date.now().toString(),
        type: "error",
        message: `Error al enviar por correo: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
    }
  };

  const handleOpenReportFolder = async () => {
    try {
      const api = window.api;
      
      if (!api?.getAppPaths) {
        throw new Error("La API de informes no está disponible");
      }

      // Get document path
      const paths = await api.getAppPaths();
      const docsPath = paths.documents;
      const reportPath = `${docsPath}/WilPOS/informe`;

      // Create directory if needed
      if (api.ensureDir) {
        const dirResult = await api.ensureDir(reportPath);
        if (!dirResult.success) {
          throw new Error(`No se pudo crear la carpeta: ${dirResult.error}`);
        }
      }

      // Open folder
      if (api.openFolder) {
        await api.openFolder(reportPath);
        setAlert({
          id: Date.now().toString(),
          type: "info",
          message: "Carpeta de informes abierta"
        });
      } else {
        setAlert({
          id: Date.now().toString(),
          type: "info",
          message: `Ruta de informes: ${reportPath}`
        });
      }
    } catch (error) {
      console.error("Error opening report folder:", error);
      setAlert({
        id: Date.now().toString(),
        type: "error",
        message: `Error al abrir carpeta: ${error instanceof Error ? error.message : "Error desconocido"}`
      });
    }
  };

  // Component UI
  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      {/* Alert message */}
      {alert && (
        <div className="fixed top-6 right-6 z-50 max-w-md w-full">
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        </div>
      )}

      {/* Header */}
      <header className="flex justify-between items-center px-8 py-4 shadow-md bg-white rounded-lg mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={handleGoBack} 
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Volver"
          >
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Informes de Ventas</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="py-2 px-4 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            aria-label="Seleccionar período"
          >
            <option value="week">Esta Semana</option>
            <option value="month">Este Mes</option>
            <option value="quarter">Este Trimestre</option>
            <option value="year">Este Año</option>
          </select>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 py-2 px-4 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
            aria-label="Actualizar"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 py-2 px-4 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
            aria-label="Imprimir informe"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          <div className="relative">
            <button
              onClick={toggleExportOptions}
              className="flex items-center gap-2 py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              aria-label="Exportar"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            {/* Export options dropdown */}
            {showExportOptions && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
                <div className="py-1">
                  <button
                    onClick={() => { setShowExportOptions(false); handleExportReport(); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Exportar como PDF</span>
                  </button>
                  <button
                    onClick={() => { setShowExportOptions(false); handleEmailReport(); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <Mail className="h-4 w-4" />
                    <span>Enviar por correo</span>
                  </button>
                  <button
                    onClick={() => { setShowExportOptions(false); handleOpenReportFolder(); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                  >
                    <Folder className="h-4 w-4" />
                    <span>Abrir carpeta</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-8 py-6" ref={reportContentRef}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Primary metrics grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <MetricCard 
                title="Ingresos Totales" 
                icon={<DollarSign />} 
                value={formatCurrency(salesData?.period.total || 0)}
              >
                <TrendIndicator value={salesData?.period.growth || 0} />
              </MetricCard>
              
              <MetricCard 
                title="Descuentos" 
                icon={<AlertTriangle />} 
                value={formatCurrency(salesData?.period.discounts || 0)} 
                subtext={`${((salesData?.period.discounts || 0) / (salesData?.period.total || 1) * 100).toFixed(1)}% del total`}
              />
              
              <MetricCard 
                title="Impuestos" 
                icon={<Info />} 
                value={formatCurrency(salesData?.period.taxes || 0)} 
                subtext={`${((salesData?.period.taxes || 0) / (salesData?.period.total || 1) * 100).toFixed(1)}% del total`}
              />
              
              <MetricCard 
                title="Ticket Promedio" 
                icon={<ShoppingCart />} 
                value={formatCurrency(salesData?.period.average || 0)} 
                subtext="Promedio del período"
              />
              
              <MetricCard 
                title="Transacciones" 
                icon={<ClipboardList />} 
                value={(salesData?.period.count || 0).toLocaleString()} 
                subtext="Clientes atendidos"
              />
              
              <MetricCard 
                title="Ventas de Hoy" 
                icon={<Store />} 
                value={formatCurrency(salesData?.today.total || 0)} 
                subtext={`${salesData?.today.count || 0} transacciones`}
              >
                <div className="mt-2 flex justify-between text-xs text-gray-500">
                  <span>Desc: {formatCurrency(salesData?.today.discounts || 0)}</span>
                  <span>Imp: {formatCurrency(salesData?.today.taxes || 0)}</span>
                </div>
              </MetricCard>
            </div>

            {/* Charts section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Sales trend chart - wider */}
              <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Tendencia de Ventas</h3>
                {salesData?.byMonth && salesData.byMonth.length > 0 ? (
                  <SalesTrendChart data={salesData.byMonth} formatCurrency={formatCurrency} />
                ) : (
                  <EmptyState message="No hay datos de ventas para mostrar" />
                )}
              </div>

              {/* Categories chart - narrower */}
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Ventas por Categoría</h3>
                {salesData?.categories && salesData.categories.length > 0 ? (
                  <CategoryChart categories={salesData.categories} formatCurrency={formatCurrency} />
                ) : (
                  <EmptyState message="No hay datos de categorías para mostrar" />
                )}
              </div>
            </div>

            {/* Top selling products table */}
            <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Productos Más Vendidos</h3>
              {salesData?.topProducts && salesData.topProducts.length > 0 ? (
                <TopProductsTable products={salesData.topProducts} formatCurrency={formatCurrency} />
              ) : (
                <EmptyState message="No hay productos vendidos en este período" />
              )}
            </div>

            {/* Monthly summary table */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Resumen por Mes</h3>
              {salesData?.byMonth && salesData.byMonth.length > 0 ? (
                <MonthlySummaryTable data={salesData.byMonth} formatCurrency={formatCurrency} />
              ) : (
                <EmptyState message="No hay datos de ventas por mes en este período" />
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer with date range info */}
      <footer className="bg-white shadow-inner py-4 px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm text-gray-600">
          <div className="flex items-center mb-2 sm:mb-0">
            <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>
              Período: {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center">
            <RefreshCw className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>Última actualización: {lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Reusable Components

const LoadingSpinner: React.FC = () => (
  <div className="flex flex-col justify-center items-center h-64">
    <div className="animate-spin h-16 w-16 border-4 border-blue-200 border-t-blue-600 rounded-full mb-4"></div>
    <p className="text-gray-500">Cargando datos de ventas...</p>
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
    <ClipboardList className="h-12 w-12 text-gray-300 mb-4" />
    <p>{message}</p>
  </div>
);

const Alert: React.FC<{ 
  type: AlertType; 
  message: string; 
  onClose: () => void 
}> = ({ type, message, onClose }) => {
  const configs = {
    success: { bg: "bg-green-50", text: "text-green-800", border: "border-green-200", Icon: Check },
    warning: { bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-200", Icon: AlertTriangle },
    error: { bg: "bg-red-50", text: "text-red-800", border: "border-red-200", Icon: X },
    info: { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200", Icon: Info }
  };
  
  const config = configs[type];
  const { Icon } = config;
  
  return (
    <div className={`${config.bg} ${config.text} ${config.border} border p-4 rounded-lg flex items-start mb-4 animate-fadeIn shadow-md`}>
      <Icon className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
      <div className="flex-grow">{message}</div>
      <button 
        onClick={onClose} 
        className="ml-2 flex-shrink-0 hover:bg-opacity-20 hover:bg-gray-500 p-1 rounded-full"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const MetricCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  value: string | number;
  subtext?: string;
  children?: React.ReactNode;
}> = ({ title, icon, value, subtext, children }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      <div className="text-blue-600">{icon}</div>
    </div>
    <div className="text-2xl font-bold mb-2">{value}</div>
    {subtext && (
      <div className="flex items-center text-xs text-gray-500 mb-2">
        <span>{subtext}</span>
      </div>
    )}
    {children}
  </div>
);

const TrendIndicator: React.FC<{ value: number }> = ({ value }) => {
  const isPositive = value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const colorClass = isPositive ? "text-green-500" : "text-red-500";
  
  return (
    <div className="flex items-center text-xs">
      <Icon className={`h-4 w-4 mr-1 ${colorClass}`} />
      <span className={colorClass}>
        {isPositive ? "+" : ""}{value.toFixed(1)}%
      </span>
      <span className="ml-1 text-gray-500">vs. período anterior</span>
    </div>
  );
};

const SalesTrendChart: React.FC<{
  data: { month: string; total: number; count: number }[];
  formatCurrency: (value: number) => string;
}> = ({ data, formatCurrency }) => {
  const maxValue = Math.max(...data.map(m => m.total), 1);
  
  return (
    <div className="h-64">
      <div className="h-full flex items-end justify-between">
        {data.map((month, index) => {
          const height = Math.max(5, (month.total / maxValue) * 100 * 2);
          
          return (
            <div key={index} className="flex-1 flex flex-col items-center group">
              <div className="relative w-full mb-1 flex justify-center">
                <div className="absolute bottom-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded py-1 px-2 pointer-events-none whitespace-nowrap z-10">
                  {formatCurrency(month.total)}
                  <br />
                  {month.count} ventas
                </div>
              </div>
              <div
                className="w-8/12 bg-blue-500 group-hover:bg-blue-600 transition-all rounded-t"
                style={{ height: `${height}px` }}
              ></div>
              <div className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                {month.month}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const CategoryChart: React.FC<{
  categories: { category: string; total: number; percentage: number }[];
  formatCurrency: (value: number) => string;
}> = ({ categories, formatCurrency }) => {
  return (
    <div className="h-64 relative">
      <div className="space-y-4 mt-4">
        {categories.slice(0, 5).map((category, index) => (
          <div key={index} className="relative">
            <div className="flex justify-between mb-1">
              <span className="text-sm text-gray-600 truncate max-w-[60%]" title={category.category}>
                {category.category}
              </span>
              <span className="text-sm font-medium">{formatCurrency(category.total)}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-2 bg-blue-500 rounded-full"
                style={{ width: `${category.percentage || 0}%` }}
              ></div>
            </div>
            <span className="absolute right-0 -top-6 text-xs text-gray-500">{category.percentage}%</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 right-0 text-center">
        <PieChart className="h-5 w-5 text-gray-400 mx-auto" />
        <span className="text-xs text-gray-500">Distribución de ventas</span>
      </div>
    </div>
  );
};

const TopProductsTable: React.FC<{
  products: TopProductItem[];
  formatCurrency: (value: number) => string;
}> = ({ products, formatCurrency }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Producto
          </th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Código
          </th>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Cantidad
          </th>
          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
            Total
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {products.map((product, index) => (
          <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mr-3">
                  <Package className="h-4 w-4" />
                </div>
                <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]" title={product.nombre}>
                  {product.nombre}
                </div>
              </div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm text-gray-500">{product.codigo_barra || "N/A"}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm text-gray-900 font-medium">{product.cantidad_vendida}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right">
              <div className="text-sm text-gray-900 font-medium">
                {formatCurrency(product.total_vendido)}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const MonthlySummaryTable: React.FC<{
  data: { month: string; total: number; count: number }[];
  formatCurrency: (value: number) => string;
}> = ({ data, formatCurrency }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Mes
          </th>
          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
            Ventas
          </th>
          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
            Transacciones
          </th>
          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
            Ticket Promedio
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {data.map((month, index) => (
          <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm font-medium text-gray-900">{month.month}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right">
              <div className="text-sm text-gray-900 font-medium">{formatCurrency(month.total)}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right">
              <div className="text-sm text-gray-900">{month.count}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right">
              <div className="text-sm text-gray-900 font-medium">
                {formatCurrency(month.count > 0 ? month.total / month.count : 0)}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default Informes;