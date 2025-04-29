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
    addResult("📋 Retrieving printer list...");
    let printers: any[] = [];
    try {
      const res = await thermalService.getAllPrinters();
      printers = res.printers || [];

      if (printers.length === 0) {
        addResult("⚠️ No printers found through ThermalPrintService");
        // fallback to direct window.printerApi
        if (window.printerApi?.getPrinters) {
          const directRes = await window.printerApi.getPrinters();
          if (directRes?.printers?.length) {
            printers = directRes.printers;
            addResult("✅ Found printers through direct printerApi call");
          }
        }
      }

      if (printers.length === 0) {
        addResult("⚠️ No printers found through any method");
      } else {
        addResult(`✅ Found ${printers.length} printers:`);
        printers.forEach((p, i) => {
          addResult(
            `  ${i + 1}. ${p.name}` +
            `${p.isDefault ? ' (Default)' : ''}` +
            `${p.isThermal ? ' (Thermal)' : ''}`
          );
          if (p.description) addResult(`     Description: ${p.description}`);
          if ((p as any).status) addResult(`     Status: ${(p as any).status}`);
        });
        const thermals = printers.filter(p => p.isThermal);
        addResult(`   Thermal printers: ${thermals.length}`);

        // detect potential thermal printers by name
        const potentialThermals = printers.filter(p =>
          !p.isThermal &&
          /thermal|receipt|pos|58mm|80mm|escpos|tm-|epson/i.test(p.name)
        );
        if (potentialThermals.length > 0) {
          addResult(`⚠️ Found ${potentialThermals.length} potential thermal printers not marked as such:`);
          potentialThermals.forEach(p => addResult(`   - ${p.name}`));
        }
      }
    } catch (e) {
      addError(`Failed to get printers: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 4. Printer configuration
    addResult("🔍 Checking configured printer in settings...");
    try {
      if (window.api?.getSettings) {
        const settings: Settings = await window.api.getSettings();
        if (settings) {
          addResult("✅ Settings loaded");
          addResult(`- tipo_impresora: ${settings.tipo_impresora || 'normal'}`);
          addResult(`- impresora_termica: ${settings.impresora_termica || 'Not configured'}`);
          addResult(`- guardar_pdf: ${settings.guardar_pdf ? 'Yes' : 'No'}`);
          addResult(`- ruta_pdf: ${settings.ruta_pdf || 'Not configured'}`);

          if (settings.impresora_termica) {
            const found = printers.find(p => p.name === settings.impresora_termica);
            if (found) {
              addResult("✅ Configured thermal printer is available");
              addResult(`  - isThermal flag: ${found.isThermal ? 'Yes' : 'No'}`);
              if (!found.isThermal) {
                addResult("⚠️ WARNING: Printer is configured but not detected as thermal");
              }
            } else {
              addError("Configured thermal printer not found in available printers list");
              addResult("ℹ️ This may be due to differences in printer names");
              const partialMatches = printers.filter(p =>
                p.name.includes(settings.impresora_termica!) ||
                settings.impresora_termica!.includes(p.name)
              );
              if (partialMatches.length > 0) {
                addResult("Possible matches found:");
                partialMatches.forEach(p => addResult(`  - ${p.name}`));
              }
            }
          } else {
            addResult("ℹ️ No specific thermal printer configured in settings");
          }
        } else {
          addError("Settings object is empty");
        }
      } else {
        addError("Settings API not available");
      }
    } catch (e) {
      addError(`Failed to load settings: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 5. Platform detection
    addResult("🔍 Detecting platform...");
    const platform = process.platform || navigator.platform;
    const ua = navigator.userAgent;
    addResult(`- Platform: ${platform}`);
    addResult(`- User Agent: ${ua}`);
    let detectedOS = "Unknown";
    if (platform.includes('win') || ua.includes('Windows')) detectedOS = "Windows";
    else if (platform.includes('mac') || ua.includes('Mac')) detectedOS = "macOS";
    else if (platform.includes('linux') || ua.includes('Linux')) detectedOS = "Linux";
    addResult(`- Detected OS: ${detectedOS}`);
    if (detectedOS === "Windows") {
      addResult("ℹ️ On Windows, check that printer drivers are installed correctly");
      addResult("ℹ️ For ESC/POS printers, try installing 'Generic / Text Only' driver");
    } else if (detectedOS === "Linux") {
      addResult("ℹ️ On Linux, check CUPS configuration for proper printer setup");
    }

    // 6. Test printer connectivity
    addResult("🔍 Checking thermal printer connectivity...");
    try {
      const status = await thermalService.checkPrinterStatus();
      if (status.available) {
        addResult(`✅ Thermal printer available: ${status.printerName}`);
        addResult(`- Message: ${status.message}`);
        addResult("🖨️ Attempting to send test print job...");
        try {
          const testResult = await thermalService.testPrinter();
          if (testResult.success) {
            addResult("✅ Test print successful!");
          } else {
            addError(`Test print failed: ${testResult.message || 'Unknown error'}`);
          }
        } catch (printError) {
          addError(`Error during test print: ${printError instanceof Error ? printError.message : String(printError)}`);
        }
      } else {
        addResult("⚠️ No thermal printer available");
        addResult(`- Message: ${status.message}`);
        addResult("🔍 Checking for node-thermal-printer availability...");
        if (window.printerApi?.printRaw) {
          addResult("✅ Raw printing API is available");
        } else {
          addError("Raw printing API not available");
        }
      }
    } catch (e) {
      addError(`Failed to check printer connectivity: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 7. Check thermal printer implementation
    addResult("🔍 Analyzing ThermalPrintService implementation...");
    try {
      const serviceImpl = thermalService.toString();
      const hasEscPos = serviceImpl.includes('ESC/POS') || serviceImpl.includes('node-thermal-printer');
      if (hasEscPos) {
        addResult("✅ ESC/POS commands appear to be implemented");
      } else {
        addResult("ℹ️ No direct ESC/POS implementation found in ThermalPrintService");
        addResult("   Printing might be using Electron's print API instead of direct commands");
      }
    } catch (e) {
      addError(`Error analyzing implementation: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 8. Check preload implementation
    addResult("🔍 Checking preload implementation...");
    if (window.printerApi?.printRaw) {
      addResult("✅ Raw printing API is defined in preload");
    } else {
      addError("Raw printing API not defined in preload");
      addResult("ℹ️ This is needed for direct ESC/POS command printing");
    }

    addResult("=== PRINTER DIAGNOSTIC COMPLETED ===")
    return { success: errors.length === 0, results, errors }
  } catch (error) {
    addError(`Error during diagnostic: ${error instanceof Error ? error.message : String(error)}`)
    addResult("=== PRINTER DIAGNOSTIC FAILED ===")
    return { success: false, results, errors }
  }
}

/**
 * Run a direct ESC/POS test via raw printing API
 */
export async function testDirectThermalPrinting(): Promise<{ success: boolean; results: string[]; errors: string[] }> {
  const results: string[] = [];
  const errors: string[] = [];

  results.push("🖨️ Testing direct thermal printing...");
  if (!window.printerApi?.printRaw) {
    errors.push("Raw printing API not available");
    return { success: false, results, errors };
  }

  let printerName = "";
  if (window.api?.getSettings) {
    const settings = await window.api.getSettings();
    printerName = settings?.impresora_termica || "";
  }
  results.push(`Using printer: ${printerName || "Default"}`);

  const escposTest =
    "\x1B@" +         // init
    "\x1Ba\x01" +     // center
    "THERMAL PRINTER TEST\n\n" +
    `Date: ${new Date().toLocaleString()}\n` +
    `Printer: ${printerName || "Default"}\n\n` +
    "\x1Bd\x01" +     // feed & cut
    "\x1B@";          // reset

  try {
    const result = await window.printerApi.printRaw(escposTest, printerName);
    if (result?.success) {
      results.push("✅ Direct thermal printing test successful!");
      return { success: true, results, errors };
    } else {
      errors.push(`Direct printing failed: ${result?.error || "Unknown error"}`);
      return { success: false, results, errors };
    }
  } catch (err) {
    errors.push(`Error in direct thermal printing test: ${err instanceof Error ? err.message : String(err)}`);
    return { success: false, results, errors };
  }
}