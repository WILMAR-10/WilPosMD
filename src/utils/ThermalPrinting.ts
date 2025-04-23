// src/utils/ThermalPrinting.ts

/**
 * Print an invoice to a thermal printer
 * @param html HTML content to print
 * @param printerName Name of the printer to use
 * @param options Additional printing options
 * @returns Promise with the print result
 */
export async function printThermalInvoice(
  html: string, 
  printerName: string | undefined,
  options: { copies?: number } = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!window.api?.printInvoice) {
      throw new Error('Print API not available');
    }

    // Create optimized options for thermal printer
    const printOptions = {
      html,
      printerName,
      silent: true,
      copies: options.copies || 1,
      // Mark as thermal printer for special handling
      thermalPrinter: true,
      pageSize: '80mm',
      width: '80mm'
    };

    const result = await window.api.printInvoice(printOptions);
    return result;
  } catch (error) {
    console.error('Error printing thermal invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown printing error'
    };
  }
}

/**
 * Format HTML specifically for 80mm thermal printers
 * @param content The HTML content to format
 * @returns Formatted HTML string
 */
export function formatThermalHtml(content: string): string {
  // Add CSS specifically for thermal printers
  const thermalStyles = `
    <style>
      @page {
        margin: 0;
        size: 80mm auto;
      }
      body {
        font-family: 'Arial', sans-serif;
        width: 80mm;
        margin: 0;
        padding: 5mm;
      }
      .header {
        text-align: center;
        margin-bottom: 5mm;
      }
      .item-row {
        font-size: 12px;
        margin-bottom: 2mm;
      }
      .totals {
        margin-top: 5mm;
        text-align: right;
        border-top: 1px dashed #000;
        padding-top: 2mm;
      }
      .footer {
        margin-top: 5mm;
        text-align: center;
        font-size: 12px;
      }
    </style>
  `;

  // If the content already has a <head> tag, insert the styles there
  if (content.includes('<head>')) {
    return content.replace('<head>', `<head>${thermalStyles}`);
  }
  
  // Otherwise add it to the beginning
  return `<html><head>${thermalStyles}</head>${content}</html>`;
}