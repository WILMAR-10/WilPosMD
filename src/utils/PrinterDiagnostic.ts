import { Settings } from "../services/DatabaseService"
import ThermalPrintService from "../services/ThermalPrintService"

/**
 * Run a comprehensive printer diagnostic 
 * @returns Promise<{success: boolean, results: string[], errors: string[]}>
 */
export async function runPrinterDiagnostic(): Promise<{ success: boolean; results: string[]; errors: string[] }> {
  const results: string[] = []
  const errors: string[] = []

  const addResult = (msg: string) => {
    results.push(msg)
    console.log(msg)
  }
  const addError = (msg: string) => {
    errors.push(msg)
    console.error(`❌ ${msg}`)
  }

  addResult("=== STARTING PRINTER DIAGNOSTIC ===")
  addResult(`Date and time: ${new Date().toLocaleString()}`)

  try {
    // 1. ThermalPrintService
    addResult("🔍 Checking ThermalPrintService...")
    const thermalService = ThermalPrintService.getInstance()
    addResult("✅ ThermalPrintService initialized")

    // 2. APIs availability
    addResult("🔍 Checking available APIs...")
    const hasMainApi                = !!window.api
    const hasPrinterApi            = !!window.printerApi
    const hasPrinterApiGetPrinters = !!window.printerApi?.getPrinters
    const hasPrinterApiPrint       = !!window.printerApi?.print
    addResult(`- window.api: ${hasMainApi ? '✅' : '❌'}`)
    addResult(`- window.printerApi: ${hasPrinterApi ? '✅' : '❌'}`)
    addResult(`- printerApi.getPrinters: ${hasPrinterApiGetPrinters ? '✅' : '❌'}`)
    addResult(`- printerApi.print: ${hasPrinterApiPrint ? '✅' : '❌'}`)

    if (!hasMainApi) addError("Main API not available")
    if (!hasPrinterApi) addError("Printer API not available")

    // 3. List printers
    addResult("📋 Retrieving printer list...")
    let printers: any[] = []
    try {
      const res = await thermalService.getAllPrinters()
      printers = res.printers
      if (printers.length === 0) {
        addResult("⚠️ No printers found")
      } else {
        addResult(`✅ Found ${printers.length} printers:`)
        printers.forEach((p, i) => {
          addResult(
            `  ${i + 1}. ${p.name}` +
            `${p.isDefault ? ' (Default)' : ''}` +
            `${p.isThermal ? ' (Thermal)' : ''}`
          )
          if (p.description) addResult(`     Description: ${p.description}`)
        })
        const thermals = printers.filter(p => p.isThermal)
        addResult(`   Thermal printers: ${thermals.length}`)
      }
    } catch (e) {
      addError(`Failed to get printers: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 4. Printer configuration
    addResult("🔍 Checking configured printer in settings...")
    try {
      if (window.api?.getSettings) {
        const settings: Settings = await window.api.getSettings()
        if (settings) {
          addResult("✅ Settings loaded")
          addResult(`- tipo_impresora: ${settings.tipo_impresora || 'normal'}`)
          if (settings.impresora_termica) {
            addResult(`- impresora_termica: ${settings.impresora_termica}`)
            const found = printers.find(p => p.name === settings.impresora_termica)
            if (found) {
              addResult("✅ Configured thermal printer is available")
            } else {
              addError("Configured thermal printer not found")
            }
          } else {
            addResult("ℹ️ No specific thermal printer configured")
          }
        } else {
          addError("Settings object is empty")
        }
      } else {
        addError("Settings API not available")
      }
    } catch (e) {
      addError(`Failed to load settings: ${e instanceof Error ? e.message : String(e)}`)
    }

    // 5. Platform detection
    addResult("🔍 Detecting platform...")
    const ua = navigator.userAgent
    addResult(`- User Agent: ${ua}`)
    if (ua.includes('Windows')) addResult("- Platform: Windows")
    else if (ua.includes('Mac')) addResult("- Platform: macOS")
    else if (ua.includes('Linux')) addResult("- Platform: Linux")
    else addResult("- Platform: Unknown")

    // 6. Printer connectivity
    addResult("🔍 Checking thermal printer connectivity...")
    try {
      const status = await thermalService.checkPrinterStatus()
      if (status.available) {
        addResult(`✅ Thermal printer available: ${status.printerName}`)
        addResult(`- Message: ${status.message}`)
      } else {
        addResult("⚠️ No thermal printer available")
        addResult(`- Message: ${status.message}`)
      }
    } catch (e) {
      addError(`Failed to check printer connectivity: ${e instanceof Error ? e.message : String(e)}`)
    }

    addResult("=== PRINTER DIAGNOSTIC COMPLETED ===")
    return { success: errors.length === 0, results, errors }
  } catch (error) {
    addError(`Error during diagnostic: ${error instanceof Error ? error.message : String(error)}`)
    addResult("=== PRINTER DIAGNOSTIC FAILED ===")
    return { success: false, results, errors }
  }
}