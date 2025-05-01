// Updated Informes.tsx - Dashboard component for WilPOS
import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useSettings } from "../services/DatabaseService"
import ExportReportUtils from "../utils/ExportReportUtils"
import {
  BarChart3,
  Download,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ClipboardList,
  PieChart,
  Store,
  DollarSign,
  ShoppingCart,
  Users,
  Calendar,
  Printer,
  RefreshCw,
  Package,
  Check,
  X,
  AlertTriangle,
  Mail,
  FileText,
  Folder,
} from "lucide-react"
import type { SalesReportItem, TopProductItem, SalesData, AlertType } from "./../types/reports"

const Informes: React.FC = () => {
  // Settings for currency formatting
  const { settings } = useSettings()

  // State for filters and tabs
  const [timeRange, setTimeRange] = useState<string>("month")
  const [activeTab, setActiveTab] = useState<string>("sales")
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() - 30)))
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [salesData, setSalesData] = useState<SalesData | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [alert, setAlert] = useState<AlertType | null>(null)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [exportFormat, setExportFormat] = useState<string>("pdf")
  const [showExportOptions, setShowExportOptions] = useState<boolean>(false)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const reportContentRef = useRef<HTMLDivElement>(null)

  // Format currency based on settings
  const formatCurrency = (amount: number) => {
    try {
      // Extract proper currency code
      let currencyCode = "DOP" // Default to Dominican Peso

      if (settings?.moneda) {
        // Handle common currency symbols
        const currencyMap: Record<string, string> = {
          RD$: "DOP", // Dominican Peso
          $: "USD", // US Dollar
          "€": "EUR", // Euro
          "£": "GBP", // British Pound
        }

        if (currencyMap[settings.moneda]) {
          currencyCode = currencyMap[settings.moneda]
        } else if (settings.moneda.length === 3) {
          // If it's already a 3-letter code, use it directly
          currencyCode = settings.moneda
        }
      }

      return new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(amount)
    } catch (error) {
      // Fallback if Intl.NumberFormat fails
      return `${settings?.moneda || "RD$"} ${amount.toFixed(2)}`
    }
  }

  // Enhanced loadSalesData with better error handling
  const loadSalesData = useCallback(
    async (showRefreshing = true) => {
      if (showRefreshing) setIsRefreshing(true)
      setIsLoading(true)

      try {
        if (!window.api?.getSalesReport) {
          throw new Error("API no disponible")
        }

        // Format dates for API
        const startDateStr = startDate.toISOString().split("T")[0]
        const endDateStr = endDate.toISOString().split("T")[0]

        // Get sales report data
        const salesReport = (await window.api.getSalesReport(startDateStr, endDateStr)) as SalesReportItem[]

        // Get top products
        const topProducts = (await window.api.getTopProducts(startDateStr, endDateStr, 10)) as TopProductItem[]

        // Process data for visualization
        if (salesReport && salesReport.length > 0) {
          // Calculate today's sales
          const today = new Date().toISOString().split("T")[0]
          const todaySales = salesReport.find((item) => item.fecha === today) || {
            num_ventas: 0,
            total_ventas: 0,
            promedio_venta: 0,
            total_descuentos: 0,
            total_impuestos: 0,
          }

          // Calculate total for the period
          const totalSales = salesReport.reduce((sum, item) => sum + item.total_ventas, 0)
          const totalTransactions = salesReport.reduce((sum, item) => sum + item.num_ventas, 0)
          const avgTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0

          // Calculate sales by month
          const monthlyData = salesReport.reduce(
            (acc, item) => {
              const date = new Date(item.fecha)
              const monthYear = date.toLocaleDateString("es-ES", { month: "short", year: "numeric" })

              const existingMonth = acc.find((m) => m.month === monthYear)
              if (existingMonth) {
                existingMonth.total += item.total_ventas
                existingMonth.count += item.num_ventas
              } else {
                acc.push({
                  month: monthYear,
                  total: item.total_ventas,
                  count: item.num_ventas,
                })
              }
              return acc
            },
            [] as { month: string; total: number; count: number }[],
          )

          // Sort chronologically
          monthlyData.sort((a, b) => {
            return new Date(a.month).getTime() - new Date(b.month).getTime()
          })

          // Calculate growth compared to previous period
          let growth = 0
          if (monthlyData.length >= 2) {
            const lastMonth = monthlyData[monthlyData.length - 1].total
            const previousMonth = monthlyData[monthlyData.length - 2].total
            growth = previousMonth > 0 ? ((lastMonth - previousMonth) / previousMonth) * 100 : 0
          }

          // Extract categories from top products
          const categoriesData = topProducts.reduce(
            (acc, product) => {
              const category = product.nombre.split(" ")[0] || "Otros" // Simplification - in reality, use product.category

              const existingCategory = acc.find((c) => c.category === category)
              if (existingCategory) {
                existingCategory.total += product.total_vendido
              } else {
                acc.push({
                  category,
                  total: product.total_vendido,
                  percentage: 0, // Calculate later
                })
              }
              return acc
            },
            [] as { category: string; total: number; percentage: number }[],
          )

          // Calculate percentages
          const totalCategorySales = categoriesData.reduce((sum, cat) => sum + cat.total, 0)
          categoriesData.forEach((cat) => {
            cat.percentage = Math.round((cat.total / totalCategorySales) * 100)
          })

          // Sort categories by total
          categoriesData.sort((a, b) => b.total - a.total)

          // Set processed data
          setSalesData({
            today: {
              total: todaySales.total_ventas,
              count: todaySales.num_ventas,
              average: todaySales.promedio_venta || 0,
            },
            period: {
              total: totalSales,
              count: totalTransactions,
              average: avgTicket,
              growth,
            },
            byMonth: monthlyData,
            topProducts,
            categories: categoriesData,
          })

          // Update last refresh timestamp
          setLastUpdate(new Date())
        } else {
          // No data available
          setSalesData({
            today: { total: 0, count: 0, average: 0 },
            period: { total: 0, count: 0, average: 0, growth: 0 },
            byMonth: [],
            topProducts: [],
            categories: [],
          })
        }
      } catch (error) {
        console.error("Error loading sales data:", error)
        setAlert({
          type: "error",
          message: `Error al cargar datos: ${error instanceof Error ? error.message : "Error desconocido"}`,
        })
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [startDate, endDate, setAlert],
  )

  // Enhanced useSyncListener that captures more relevant events
  function useSyncListener(callback: () => void) {
    useEffect(() => {
      // All events that should trigger a reports refresh
      const relevantEvents = [
        // Sales events
        "sale:create",
        "sale:update",
        "sale:delete",
        // Product events that might affect reports
        "product:create",
        "product:update",
        "product:delete",
        // Category events
        "category:update",
        // Data sync events
        "sync:complete",
        "database:updated",
      ]

      const handleSyncEvent = (event: CustomEvent) => {
        const syncEvent = event.detail
        if (relevantEvents.includes(syncEvent.type)) {
          console.log(`Refreshing reports due to ${syncEvent.type} event`)
          callback()
        }
      }

      window.addEventListener("sync-event", handleSyncEvent as EventListener)
      return () => {
        window.removeEventListener("sync-event", handleSyncEvent as EventListener)
      }
    }, [callback])
  }

  // Set up automatic refresh on interval
  useEffect(() => {
    // Refresh every 5 minutes (300000ms)
    const REFRESH_INTERVAL = 300000

    // Clean up any existing timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
    }

    // Set up new timer for background refresh
    refreshTimerRef.current = setInterval(() => {
      loadSalesData(false) // Silent refresh (doesn't show loading indicator)
    }, REFRESH_INTERVAL)

    // Clean up on component unmount
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [loadSalesData])

  // Update date range when time range changes
  useEffect(() => {
    const now = new Date()
    const newEndDate = new Date(now)
    const newStartDate = new Date(now)

    switch (timeRange) {
      case "week":
        newStartDate.setDate(now.getDate() - 7)
        break
      case "month":
        newStartDate.setMonth(now.getMonth() - 1)
        break
      case "quarter":
        newStartDate.setMonth(now.getMonth() - 3)
        break
      case "year":
        newStartDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        newStartDate.setMonth(now.getMonth() - 1)
    }

    setStartDate(newStartDate)
    setEndDate(newEndDate)
  }, [timeRange])

  // Load sales data when date range changes
  useEffect(() => {
    loadSalesData()
  }, [startDate, endDate, loadSalesData])

  // Enhanced event listener with optimized callback
  const refreshCallback = useCallback(() => {
    setIsRefreshing(true)
    loadSalesData()
  }, [loadSalesData])

  // Use the enhanced sync listener
  useSyncListener(refreshCallback)

  // Handle refresh button click
  const handleRefresh = () => {
    setIsRefreshing(true)
    loadSalesData()
  }

  // Handle export report
  const handleExportReport = async () => {
    try {
      if (!window.api?.getAppPaths || !window.api?.savePdf) {
        throw new Error("API no disponible para exportar informes")
      }

      setAlert({
        type: "info",
        message: "Generando informe, por favor espere...",
      })

      // Get app paths
      const paths = await window.api.getAppPaths()
      const docsPath = paths.documents

      // Crear la carpeta "informe" dentro de WilPOS
      const reportPath = `${docsPath}/WilPOS/informe`

      // Asegurar que la carpeta existe
      if (window.api.ensureDir) {
        const dirResult = await window.api.ensureDir(reportPath)
        if (!dirResult.success) {
          throw new Error(`No se pudo crear la carpeta: ${dirResult.error}`)
        }
      }

      const filename = `informe-ventas-${startDate.toISOString().split("T")[0]}-a-${endDate.toISOString().split("T")[0]}.pdf`

      // Generate HTML content for the report using the utility
      const htmlContent = ExportReportUtils.generateSalesReportHTML(startDate, endDate, salesData!, formatCurrency)

      // Save as PDF
      const result = await window.api.savePdf({
        html: htmlContent,
        path: `${reportPath}/${filename}`,
        options: {
          printBackground: true,
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
          pageSize: "A4",
        },
      })

      if (result.success) {
        setAlert({
          type: "success",
          message: `Informe guardado como ${filename}`,
        })

        // Intentar abrir la carpeta
        if (window.api.openFolder) {
          await window.api.openFolder(reportPath)
        }
      } else {
        throw new Error(result.error || "Error al guardar PDF")
      }
    } catch (error) {
      console.error("Error exporting report:", error)
      setAlert({
        type: "error",
        message: `Error al exportar: ${error instanceof Error ? error.message : "Error desconocido"}`,
      })
    }
  }

  // Handle print report
  const handlePrintReport = async () => {
    if (!window.api?.printInvoice) {
      setAlert({
        type: "error",
        message: "API de impresión no disponible",
      })
      return
    }

    try {
      setAlert({
        type: "info",
        message: "Preparando impresión...",
      })

      // Generate HTML content for printing using the utility
      const htmlContent = ExportReportUtils.generatePrintReportHTML(startDate, endDate, salesData!, formatCurrency)

      // Send to printer
      const result = await window.api.printInvoice({
        html: htmlContent,
        printerName: settings?.impresora_termica,
        silent: false,
      })

      if (result.success) {
        setAlert({
          type: "success",
          message: "Informe enviado a impresión",
        })
      } else {
        throw new Error(result.error || "Error al imprimir")
      }
    } catch (error) {
      console.error("Error printing report:", error)
      setAlert({
        type: "error",
        message: `Error al imprimir: ${error instanceof Error ? error.message : "Error desconocido"}`,
      })
    }
  }

  // Handle email report
  const handleEmailReport = async () => {
    try {
      setAlert({
        type: "info",
        message: "Preparando informe para enviar por correo...",
      })

      // Get app paths
      const paths = await window.api.getAppPaths()
      const docsPath = paths.documents

      // Crear la carpeta "informe" dentro de WilPOS
      const reportPath = `${docsPath}/WilPOS/informe`

      // Asegurar que la carpeta existe
      if (window.api.ensureDir) {
        await window.api.ensureDir(reportPath)
      }

      const filename = `informe-ventas-${startDate.toISOString().split("T")[0]}-a-${endDate.toISOString().split("T")[0]}.pdf`
      const filePath = `${reportPath}/${filename}`

      // Generate HTML content for the report
      const htmlContent = ExportReportUtils.generateSalesReportHTML(startDate, endDate, salesData!, formatCurrency)

      // Save as PDF first
      const result = await window.api.savePdf({
        html: htmlContent,
        path: filePath,
        options: {
          printBackground: true,
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
          pageSize: "A4",
        },
      })

      if (!result.success) {
        throw new Error(result.error || "Error al guardar PDF")
      }

      // Check if we have a mail API
      if (window.api.sendMail) {
        const emailResult = await window.api.sendMail({
          subject: `Informe de Ventas ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
          body: `Adjunto encontrará el informe de ventas para el período ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}.`,
          attachments: [filePath],
        })

        if (emailResult.success) {
          setAlert({
            type: "success",
            message: "Informe enviado por correo electrónico",
          })
        } else {
          throw new Error(emailResult.error || "Error al enviar correo")
        }
      } else {
        // Fallback to opening default mail client
        const mailtoLink = `mailto:?subject=Informe%20de%20Ventas&body=Adjunto%20encontrará%20el%20informe%20de%20ventas.%0A%0ARuta%20del%20archivo:%20${encodeURIComponent(filePath)}`
        window.open(mailtoLink)

        setAlert({
          type: "info",
          message: `Informe guardado en: ${filePath}. Abra su cliente de correo para adjuntarlo.`,
        })
      }
    } catch (error) {
      console.error("Error sending report by email:", error)
      setAlert({
        type: "error",
        message: `Error al enviar por correo: ${error instanceof Error ? error.message : "Error desconocido"}`,
      })
    }
  }

  // Open report folder
  const handleOpenReportFolder = async () => {
    try {
      // Get app paths
      const paths = await window.api.getAppPaths()
      const docsPath = paths.documents

      // Ruta de la carpeta "informe"
      const reportPath = `${docsPath}/WilPOS/informe`

      // Asegurar que la carpeta existe
      if (window.api.ensureDir) {
        await window.api.ensureDir(reportPath)
      }

      // Abrir la carpeta
      if (window.api.openFolder) {
        await window.api.openFolder(reportPath)
        setAlert({
          type: "info",
          message: "Carpeta de informes abierta",
        })
      } else {
        setAlert({
          type: "info",
          message: `Ruta de informes: ${reportPath}`,
        })
      }
    } catch (error) {
      console.error("Error opening report folder:", error)
      setAlert({
        type: "error",
        message: `Error al abrir carpeta: ${error instanceof Error ? error.message : "Error desconocido"}`,
      })
    }
  }

  // Return to Home
  const handleGoBack = () => {
    const event = new CustomEvent("componentChange", {
      detail: { component: "Home" },
    })
    window.dispatchEvent(event)
  }

  // Toggle export options
  const toggleExportOptions = () => {
    setShowExportOptions(!showExportOptions)
  }

  // Alert component
  const Alert = ({ type, message }: { type: AlertType; message: string }) => {
    const colors = {
      success: { bg: "bg-green-50", text: "text-green-800", border: "border-green-200", icon: Check },
      warning: { bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-200", icon: AlertTriangle },
      error: { bg: "bg-red-50", text: "text-red-800", border: "border-red-200", icon: X },
      info: { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200", icon: AlertTriangle },
    }

    const style = colors[type] || colors.info
    const Icon = style.icon

    return (
      <div className={`${style.bg} ${style.text} ${style.border} border p-4 rounded-lg flex items-start mb-4`}>
        <Icon className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
        <div className="flex-grow">{message}</div>
        <button onClick={() => setAlert(null)} className="ml-2 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  // Close alert after timeout
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => {
        setAlert(null)
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [alert])

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      {/* Alert message */}
      {alert && (
        <div className="fixed top-6 right-6 z-50 max-w-md w-full">
          <Alert type={alert.type} message={alert.message} />
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
            <h1 className="text-2xl font-bold text-gray-800">Informes de Ventas</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
            className="flex items-center gap-2 py-2 px-4 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <button
            className="flex items-center gap-2 py-2 px-4 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
            onClick={handlePrintReport}
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          <div className="relative">
            <button
              className="flex items-center gap-2 py-2 px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              onClick={toggleExportOptions}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            {/* Export options dropdown */}
            {showExportOptions && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
                <div className="py-1">
                  <button
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    onClick={() => {
                      setShowExportOptions(false)
                      handleExportReport()
                    }}
                  >
                    <FileText className="h-4 w-4" />
                    <span>Exportar como PDF</span>
                  </button>
                  <button
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    onClick={() => {
                      setShowExportOptions(false)
                      handleEmailReport()
                    }}
                  >
                    <Mail className="h-4 w-4" />
                    <span>Enviar por correo</span>
                  </button>
                  <button
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                    onClick={() => {
                      setShowExportOptions(false)
                      handleOpenReportFolder()
                    }}
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
      <main className="flex-1 px-8 py-6" id="report-content" ref={reportContentRef}>
        {/* Add refresh indicator */}
        {isRefreshing && !isLoading && (
          <div className="fixed top-20 right-8 bg-blue-100 text-blue-800 py-2 px-4 rounded-lg shadow-md flex items-center gap-2 z-50">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Actualizando datos...</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">Cargando datos de ventas...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Ingresos Totales</h3>
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold mb-2">{formatCurrency(salesData?.period.total || 0)}</div>
                <div className="flex items-center text-xs text-gray-500">
                  {(salesData?.period.growth || 0) >= 0 ? (
                    <>
                      <TrendingUp className="mr-1 h-4 w-4 text-green-500" />
                      <span className="text-green-500">+{(salesData?.period.growth || 0).toFixed(1)}%</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="mr-1 h-4 w-4 text-red-500" />
                      <span className="text-red-500">{(salesData?.period.growth || 0).toFixed(1)}%</span>
                    </>
                  )}
                  <span className="ml-1">vs. período anterior</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Valor Promedio de Ticket</h3>
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold mb-2">{formatCurrency(salesData?.period.average || 0)}</div>
                <div className="flex items-center text-xs text-gray-500">
                  <Calendar className="mr-1 h-4 w-4 text-gray-400" />
                  <span>Promedio del período</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Total de Transacciones</h3>
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold mb-2">{(salesData?.period.count || 0).toLocaleString()}</div>
                <div className="flex items-center text-xs text-gray-500">
                  <Users className="mr-1 h-4 w-4 text-gray-400" />
                  <span>Clientes atendidos</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Ventas de Hoy</h3>
                  <Store className="h-5 w-5 text-blue-600" />
                </div>
                <div className="text-2xl font-bold mb-2">{formatCurrency(salesData?.today.total || 0)}</div>
                <div className="flex items-center text-xs text-gray-500">
                  <ShoppingCart className="mr-1 h-4 w-4 text-gray-400" />
                  <span>{salesData?.today.count || 0} transacciones</span>
                </div>
              </div>
            </div>

            {/* Sales trend chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Tendencia de Ventas</h3>
                <div className="h-64">
                  {salesData?.byMonth.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No hay datos de ventas para mostrar
                    </div>
                  ) : (
                    <div className="h-full flex items-end">
                      {salesData?.byMonth.map((month, index) => (
                        <div key={index} className="flex-1 flex flex-col items-center group">
                          <div className="relative w-full mb-1 flex justify-center">
                            <div className="absolute bottom-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded py-1 px-2 pointer-events-none whitespace-nowrap">
                              {formatCurrency(month.total)}
                            </div>
                          </div>
                          <div
                            className={`w-8/12 bg-blue-500 group-hover:bg-blue-600 transition-all rounded-t`}
                            style={{
                              height: `${Math.max(
                                5,
                                (month.total / Math.max(...salesData.byMonth.map((m) => m.total), 1)) * 100 * 2,
                              )}px`,
                            }}
                          ></div>
                          <div className="text-xs text-gray-500 mt-1 truncate w-full text-center">{month.month}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Ventas por Categoría</h3>
                <div className="h-64 relative">
                  {salesData?.categories.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      No hay datos de categorías para mostrar
                    </div>
                  ) : (
                    <div className="space-y-4 mt-4">
                      {salesData?.categories.slice(0, 5).map((category, index) => (
                        <div key={index} className="relative">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-gray-600">{category.category}</span>
                            <span className="text-sm font-medium">{formatCurrency(category.total)}</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-2 bg-blue-500 rounded-full"
                              style={{ width: `${category.percentage || 0}%` }}
                            ></div>
                          </div>
                          <span className="absolute right-0 -top-6 text-xs text-gray-500">{category.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 text-center">
                    <PieChart className="h-5 w-5 text-gray-400 mx-auto" />
                    <span className="text-xs text-gray-500">Distribución de ventas</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top selling products */}
            <div className="bg-white p-6 rounded-xl shadow-sm mb-8">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Productos Más Vendidos</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Producto
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Código
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Cantidad Vendida
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Total Vendido
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salesData?.topProducts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                          No hay productos vendidos en este período
                        </td>
                      </tr>
                    ) : (
                      salesData?.topProducts.map((product, index) => (
                        <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mr-3">
                                <Package className="h-4 w-4" />
                              </div>
                              <div className="text-sm font-medium text-gray-900">{product.nombre}</div>
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly summary */}
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Resumen por Mes</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Mes
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Ventas
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Transacciones
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Ticket Promedio
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salesData?.byMonth.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                          No hay datos de ventas por mes en este período
                        </td>
                      </tr>
                    ) : (
                      salesData?.byMonth.map((month, index) => (
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer with date range info */}
      <footer className="bg-white shadow-inner py-4 px-8">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2" />
            <span>
              Período: {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center">
            <RefreshCw className="h-4 w-4 mr-2" />
            <span>Última actualización: {lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Informes
