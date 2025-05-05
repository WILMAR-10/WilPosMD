// src/utils/PrinterDiagnostic.ts
import ThermalPrintService from '../services/ThermalPrintService';

export interface DiagnosticResult {
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: string[];
  printers?: Array<{
    name: string;
    isDefault?: boolean;
    isThermal?: boolean;
    status?: string;
  }>;
  activePrinter?: string | null;
  systemInfo?: Record<string, any>;
}

/**
 * Utility class for diagnosing printer issues
 * Provides tools for testing and troubleshooting printer connections
 */
export class PrinterDiagnostic {
  private thermalPrintService: ThermalPrintService;
  
  constructor() {
    this.thermalPrintService = ThermalPrintService.getInstance();
  }
  
  /**
   * Run a complete diagnostic on the printing system
   * Checks available printers, settings, and attempts test prints
   */
  public async runFullDiagnostic(): Promise<DiagnosticResult> {
    try {
      // Check system environment
      const systemInfo = await this.getSystemInfo();
      
      // Get all available printers
      const printers = await this.thermalPrintService.getAvailablePrinters();
      
      if (!printers || printers.length === 0) {
        return {
          status: 'error',
          message: 'No printers detected in the system',
          systemInfo
        };
      }
      
      // Get current printer status
      const printerStatus = await this.thermalPrintService.checkPrinterStatus();
      
      // Transform printer info for output
      const printerList = printers.map(printer => ({
        name: printer.name,
        isDefault: printer.isDefault,
        isThermal: printer.isThermal,
        status: printer.name === printerStatus.printerName ? 
          (printerStatus.available ? 'Active' : 'Error') : 'Available'
      }));
      
      // Determine overall status
      let status: 'success' | 'warning' | 'error' = 'success';
      let message = 'Printing system is working correctly';
      const details: string[] = [];
      
      // Check if there are any thermal printers
      const thermalPrinters = printers.filter(p => p.isThermal);
      if (thermalPrinters.length === 0) {
        status = 'warning';
        message = 'No thermal printers detected';
        details.push('System will use standard printers for receipt printing');
      }
      
      // Check if active printer is available
      if (!printerStatus.available) {
        status = 'error';
        message = printerStatus.message || 'Printer not available';
        details.push('No working printer configured for receipts');
      } else {
        details.push(`Active printer: ${printerStatus.printerName}`);
      }
      
      return {
        status,
        message,
        details,
        printers: printerList,
        activePrinter: printerStatus.printerName,
        systemInfo
      };
    } catch (error) {
      console.error('Error running printer diagnostic:', error);
      return {
        status: 'error',
        message: 'Failed to run printer diagnostic',
        details: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
  
  /**
   * Test a specific printer
   * @param printerName Name of printer to test
   */
  public async testPrinter(printerName?: string): Promise<DiagnosticResult> {
    try {
      const targetPrinter = printerName || this.thermalPrintService.activePrinter;
      
      if (!targetPrinter) {
        return {
          status: 'error',
          message: 'No printer specified or configured'
        };
      }
      
      // Try to print a test page
      const result = await this.thermalPrintService.testPrinter(targetPrinter);
      
      if (result.success) {
        return {
          status: 'success',
          message: `Test page sent to ${targetPrinter}`,
          details: [result.message || 'Check printer for output']
        };
      } else {
        return {
          status: 'error',
          message: `Failed to print to ${targetPrinter}`,
          details: [result.error || 'Unknown error']
        };
      }
    } catch (error) {
      console.error('Error testing printer:', error);
      return {
        status: 'error',
        message: 'Test failed with exception',
        details: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
  
  /**
   * Get system environment information
   * Collects information about OS, Electron, and app versions
   */
  public async getSystemInfo(): Promise<Record<string, any>> {
    const info: Record<string, any> = {
      timestamp: new Date().toISOString(),
      platform: 'Unknown',
      electronVersion: 'Unknown',
      nodeVersion: 'Unknown',
      appVersion: 'Unknown'
    };
    
    try {
      // Try to get versions from window.versions (from preload)
      if (window.versions) {
        info.electronVersion = window.versions.electron();
        info.nodeVersion = window.versions.node();
        info.chromeVersion = window.versions.chrome();
      }
      
      // Try to detect platform from navigator
      if (navigator.platform) {
        info.platform = navigator.platform;
      }
      
      // Get basic app information only - printer info collected elsewhere
      if (window.api?.getAppPaths) {
        const paths = await window.api.getAppPaths();
        if (paths) {
          info.appPaths = {
            userData: paths.userData,
            appPath: paths.appPath
          };
        }
      }
      
      return info;
    } catch (error) {
      console.error('Error getting system info:', error);
      return {
        ...info,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Test opening cash drawer
   * @param printerName Optional printer name
   */
  public async testCashDrawer(printerName?: string): Promise<DiagnosticResult> {
    try {
      const result = await this.thermalPrintService.openCashDrawer(printerName);
      
      if (result.success) {
        return {
          status: 'success',
          message: 'Cash drawer command sent successfully',
          details: ['Check if the cash drawer opened']
        };
      } else {
        return {
          status: 'error',
          message: 'Failed to send cash drawer command',
          details: [result.error || 'Printer may not support cash drawer control']
        };
      }
    } catch (error) {
      console.error('Error testing cash drawer:', error);
      return {
        status: 'error',
        message: 'Cash drawer test failed with exception',
        details: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
  
  /**
   * Create a detailed diagnostic report in HTML format
   * Useful for support and troubleshooting
   */
  public async generateDiagnosticReport(): Promise<string> {
    try {
      const diagnosticResult = await this.runFullDiagnostic();
      const timestamp = new Date().toLocaleString();
      
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>WilPOS Printer Diagnostic Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              line-height: 1.5;
            }
            h1, h2 {
              color: #333;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            .status {
              padding: 10px;
              margin: 10px 0;
              border-radius: 5px;
            }
            .success {
              background-color: #d4f7d4;
              border: 1px solid #34c240;
            }
            .warning {
              background-color: #fff4d4;
              border: 1px solid #ffc107;
            }
            .error {
              background-color: #ffd4d4;
              border: 1px solid #ff3b30;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
            }
            .footer {
              margin-top: 40px;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <h1>WilPOS Printer Diagnostic Report</h1>
          <p>Generated: ${timestamp}</p>
          
          <div class="status ${diagnosticResult.status}">
            <h2>Diagnostic Result: ${diagnosticResult.status.toUpperCase()}</h2>
            <p><strong>${diagnosticResult.message}</strong></p>
            ${diagnosticResult.details ? `
              <ul>
                ${diagnosticResult.details.map(detail => `<li>${detail}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
          
          <h2>Printer Information</h2>
          ${diagnosticResult.printers && diagnosticResult.printers.length > 0 ? `
            <table>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Default</th>
              </tr>
              ${diagnosticResult.printers.map(printer => `
                <tr>
                  <td>${printer.name}</td>
                  <td>${printer.isThermal ? 'Thermal' : 'Standard'}</td>
                  <td>${printer.status}</td>
                  <td>${printer.isDefault ? 'Yes' : 'No'}</td>
                </tr>
              `).join('')}
            </table>
            <p>Active printer: ${diagnosticResult.activePrinter || 'None'}</p>
          ` : '<p>No printers detected</p>'}
          
          <h2>System Information</h2>
          ${diagnosticResult.systemInfo ? `
            <table>
              <tr>
                <th>Property</th>
                <th>Value</th>
              </tr>
              ${Object.entries(diagnosticResult.systemInfo).map(([key, value]) => `
                <tr>
                  <td>${key}</td>
                  <td>${JSON.stringify(value)}</td>
                </tr>
              `).join('')}
            </table>
          ` : '<p>System information not available</p>'}
          
          <div class="footer">
            <p>WilPOS - Point of Sale System</p>
            <p>For support, please contact system administrator</p>
          </div>
        </body>
        </html>
      `;
    } catch (error) {
      console.error('Error generating diagnostic report:', error);
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error Report</title>
        </head>
        <body>
          <h1>Error Generating Diagnostic Report</h1>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        </body>
        </html>
      `;
    }
  }
}

export default PrinterDiagnostic;