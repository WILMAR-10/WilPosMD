import { Settings } from "../services/DatabaseService";
import ThermalPrintService from "../services/ThermalPrintService";

/**
 * Run a comprehensive printer diagnostic
 * @returns true if the diagnostic completed, false if it failed
 */
export async function runPrinterDiagnostic() {
    console.log("=== INICIO DIAGNÓSTICO DE IMPRESORAS ===");
    console.log(`Fecha y hora: ${new Date().toLocaleString()}`);

    try {
        // 1. Check ThermalPrintService
        console.log("🔍 Verificando ThermalPrintService...");
        const thermalService = ThermalPrintService.getInstance();
        console.log("✅ ThermalPrintService inicializado correctamente");

        // 2. Check available APIs
        console.log("🔍 Verificando APIs disponibles...");

        const hasMainApi = !!window.api;
        const hasGetPrinters = !!window.api?.getPrinters;
        const hasElectronPrinting = !!window.electronPrinting?.getPrinters;
        const hasPrintInvoice = !!window.api?.printInvoice;

        console.log(`- API principal: ${hasMainApi ? '✅ Disponible' : '❌ No disponible'}`);
        console.log(`- window.api.getPrinters: ${hasGetPrinters ? '✅ Disponible' : '❌ No disponible'}`);
        console.log(`- electronPrinting.getPrinters: ${hasElectronPrinting ? '✅ Disponible' : '❌ No disponible'}`);
        console.log(`- window.api.printInvoice: ${hasPrintInvoice ? '✅ Disponible' : '❌ No disponible'}`);

        if (!hasMainApi) {
            console.error("❌ API principal no disponible - el diagnóstico puede ser limitado");
        }

        // 3. Get available printers
        console.log("📋 Obteniendo lista de impresoras...");
        const { printers } = await thermalService.getAllPrinters();

        if (printers.length === 0) {
            console.warn("⚠️ No se detectaron impresoras en el sistema");
        } else {
            console.log(`✅ Se encontraron ${printers.length} impresoras:`);
            printers.forEach((printer, index) => {
                console.log(
                  `   ${index + 1}. ${printer.name}` +
                  `${printer.isDefault ? ' (Predeterminada)' : ''}` +
                  `${printer.isThermal ? ' (Térmica)' : ''}`
                );
                if (printer.description) {
                    console.log(`      Descripción: ${printer.description}`);
                }
            });

            const thermalPrinters = printers.filter(p => p.isThermal);
            console.log(`   Impresoras térmicas detectadas: ${thermalPrinters.length}`);
            if (thermalPrinters.length > 0) {
                console.log(`   Nombres: ${thermalPrinters.map(p => p.name).join(', ')}`);
            }
        }

        // 4. Check printer configuration
        console.log("🔍 Comprobando configuración de impresora...");
        let settings: Settings;

        try {
            if (window.api?.getSettings) {
                settings = await window.api.getSettings();

                if (!settings) {
                    console.warn("⚠️ No se pudieron cargar los ajustes");
                } else {
                    console.log("✅ Configuración cargada correctamente");
                    console.log(`- Tipo de impresora: ${settings.tipo_impresora || 'normal'}`);

                    if (settings.impresora_termica) {
                        console.log(`- Impresora configurada: "${settings.impresora_termica}"`);
                        const configuredPrinter = printers.find(p => p.name === settings.impresora_termica);

                        if (configuredPrinter) {
                            console.log("✅ La impresora configurada está disponible en el sistema");
                            console.log(
                              configuredPrinter.isDefault
                                ? "✅ Es la predeterminada del sistema"
                                : "ℹ️ No es la predeterminada del sistema"
                            );
                            if (configuredPrinter.isThermal) {
                                console.log("✅ Está correctamente identificada como térmica");
                            } else if (['termica','termica58'].includes(settings.tipo_impresora || '')) {
                                console.log("⚠️ Configurada como térmica pero no detectada como tal");
                            }
                        } else {
                            console.error("❌ La impresora configurada NO está disponible en el sistema");
                            const similar = printers.filter(p =>
                                p.name.toLowerCase().includes(settings.impresora_termica!.toLowerCase()) ||
                                settings.impresora_termica!.toLowerCase().includes(p.name.toLowerCase())
                            );
                            if (similar.length > 0) {
                                console.log("💡 Impresoras similares encontradas:");
                                similar.forEach((p, i) => console.log(`   ${i + 1}. ${p.name}`));
                            }
                        }
                    } else {
                        console.log("ℹ️ Sin impresora específica, se usará la predeterminada");
                        const defaultPrinter = printers.find(p => p.isDefault);
                        if (defaultPrinter) {
                            console.log(`✅ Predeterminada: "${defaultPrinter.name}"`);
                            if (defaultPrinter.isThermal) {
                                console.log("✅ La predeterminada es térmica");
                            } else if (['termica','termica58'].includes(settings.tipo_impresora || '')) {
                                console.log("⚠️ Configurada para térmica pero predeterminada no es térmica");
                            }
                        } else {
                            console.warn("⚠️ No se encontró una impresora predeterminada");
                        }
                    }
                }
            } else {
                console.warn("⚠️ API de configuración no disponible");
            }
        } catch (err) {
            console.error("❌ Error al cargar configuración:", err);
        }

        // 5. Determine platform
        console.log("🔍 Detectando plataforma...");
        const ua = navigator.userAgent;
        console.log(`- User Agent: ${ua}`);
        if (ua.includes('Windows')) console.log("- Plataforma: Windows");
        else if (ua.includes('Mac')) console.log("- Plataforma: macOS");
        else if (ua.includes('Linux')) console.log("- Plataforma: Linux");
        else console.log("- Plataforma: No determinada");

        // 6. Check connectivity via ThermalPrintService
        console.log("🔍 Verificando conectividad de impresora térmica...");
        const status = await thermalService.checkPrinterStatus();

        if (status.available) {
            console.log(`✅ Impresora térmica disponible: ${status.printerName}`);
            console.log(`- Mensaje: ${status.message}`);
        } else {
            console.warn("⚠️ No se detectó impresora térmica disponible");
            console.log(`- Mensaje: ${status.message}`);
        }

        console.log("=== FIN DIAGNÓSTICO DE IMPRESORAS ===");
        return true;
    } catch (error) {
        console.error("❌ Error durante el diagnóstico:", error);
        console.log("=== DIAGNÓSTICO FALLIDO ===");
        return false;
    }
}