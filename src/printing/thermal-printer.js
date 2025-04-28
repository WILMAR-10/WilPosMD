import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

/**
 * Gets available printers for the system
 */
export async function getPrinters() {
  try {
    const wins = BrowserWindow.getAllWindows();
    if (!wins.length) throw new Error('No windows available');
    // pick a ready window
    const win = wins.find(w=>!w.isDestroyed()&&w.webContents.isLoadingMainFrame()===false) || wins[0];
    if (typeof win.webContents.getPrinters === 'function') {
      const list = win.webContents.getPrinters();
      return {
        success: true,
        printers: list.map(p=>({
          name: p.name,
          displayName: p.displayName||p.name,
          description: p.description||'',
          status: p.status,
          isDefault: p.isDefault,
          isThermal: /thermal|receipt|80mm|58mm/i.test(p.name),
          options: p.options||{}
        }))
      };
    }
    // fallback
    return { success:true, printers:[
      {name:'Default System Printer',isDefault:true},
      {name:'Microsoft Print to PDF',isDefault:false}
    ]};
  } catch (e) {
    console.error('Error getting printers:',e);
    return { success:true, printers:[
      {name:'Default System Printer',isDefault:true},
      {name:'Microsoft Print to PDF',isDefault:false}
    ]};
  }
}

/** helper: write HTML to a temp file */
async function createTempHtmlFile(html, dir) {
  await fs.ensureDir(dir);
  const file = path.join(dir,`print-${Date.now()}.html`);
  await fs.writeFile(file,html,'utf8');
  return file;
}

/**
 * Thermal print
 */
export async function printWithThermalPrinter(options) {
  if (!options?.html) return {success:false,error:'No HTML'};
  const tempDir = path.join(os.tmpdir(),'wilpos-prints');
  let tmp, win;
  try {
    tmp = await createTempHtmlFile(options.html,tempDir);
    win = new BrowserWindow({show:false,webPreferences:{contextIsolation:true}});
    await win.loadFile(tmp);
    await new Promise(r=>win.webContents.on('did-finish-load',r));
    const opts = {
      silent: options.silent!==false,
      printBackground: true,
      deviceName: options.printerName,
      copies: options.copies||1,
      margins:{marginType:'none'},
      pageSize: options.options?.width==='58mm'
        ? {width:58000,height:210000}
        : {width:80000,height:210000}
    };
    const ok = await win.webContents.print(opts);
    return {success:ok,message: ok?'Thermal sent':'Thermal failed'};
  } catch (e) {
    console.error('Thermal error:',e);
    return {success:false,error:e.message};
  } finally {
    if (win && !win.isDestroyed()) win.close();
    if (tmp) await fs.unlink(tmp).catch(()=>{});
  }
}

/**
 * Standard Electron print
 */
export async function printWithElectron(options) {
  if (!options?.html) return {success:false,error:'No HTML'};
  const tempDir = path.join(os.tmpdir(),'wilpos-prints');
  let tmp, win;
  try {
    tmp = await createTempHtmlFile(options.html,tempDir);
    win = new BrowserWindow({show:false,webPreferences:{contextIsolation:true}});
    await win.loadFile(tmp);
    await new Promise(r=>win.webContents.on('did-finish-load',r));
    const opts = {
      silent: options.silent!==false,
      printBackground: true,
      deviceName: options.printerName,
      copies: options.copies||1,
      pageSize: options.options?.pageSize||'A4'
    };
    const ok = await win.webContents.print(opts);
    return {success:ok,message: ok?'Printed':'Canceled/failed'};
  } catch (e) {
    console.error('Electron print error:',e);
    return {success:false,error:e.message};
  } finally {
    if (win && !win.isDestroyed()) win.close();
    if (tmp) await fs.unlink(tmp).catch(()=>{});
  }
}

/**
 * Save HTML as PDF
 */
export async function savePdf(options) {
  if (!options?.html||!options?.path) throw new Error('html & path required');
  const pdfDir = path.dirname(options.path);
  await fs.ensureDir(pdfDir);
  const tempDir = path.join(os.tmpdir(),'wilpos-pdf');
  const tmp = await createTempHtmlFile(options.html,tempDir);
  let win;
  try {
    win = new BrowserWindow({show:false,webPreferences:{contextIsolation:true}});
    await win.loadFile(tmp);
    const pdfData = await win.webContents.printToPDF({
      printBackground: options.options?.printBackground!==false,
      margins: options.options?.margins||{top:0.4,bottom:0.4,left:0.4,right:0.4},
      pageSize: options.options?.pageSize||'A4'
    });
    await fs.writeFile(options.path,pdfData);
    return {success:true,path:options.path};
  } finally {
    if (win && !win.isDestroyed()) win.close();
    await fs.unlink(tmp).catch(()=>{});
  }
}

/**
 * Hook up IPC handlers
 */
export function setupThermalPrintingHandlers(ipc) {
  const reg = (ch,fn)=>{
    try { ipc.removeHandler(ch) } catch{}
    ipc.handle(ch,fn);
  };
  reg('get-printers',()=>getPrinters());
  reg('print',(_,opt)=> opt.options?.thermalPrinter
    ? printWithThermalPrinter(opt)
    : printWithElectron(opt)
  );
  reg('savePdf',(_,opt)=> savePdf(opt).catch(e=>({success:false,error:e.message})));
}

export default {
  getPrinters,
  printWithThermalPrinter,
  printWithElectron,
  savePdf,
  setupThermalPrintingHandlers
};