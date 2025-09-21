# 🖨️ CONFIGURACIÓN IMPRESORA TÉRMICA - WilPOS

## ✅ CONFIGURACIÓN NECESARIA PARA IMPRESIÓN FÍSICA

### 1. 🔧 CONFIGURACIÓN EN LA IMPRESORA (HARDWARE)

#### **A. Modo de Operación (CRÍTICO)**
- **DEBE estar en "Line Mode" o "ESC/POS Mode"**
- **NO usar "Page Mode" o "Graphics Mode"**
- **Verificar en el panel/botones de la impresora**

#### **B. Comunicación Serial (Para USB a Serial)**
- **Velocidad (Baud Rate): 9600 bps**
- **Bits de datos: 8**
- **Paridad: None (N)**
- **Bits de parada: 1**
- **Control de flujo: None (XON/XOFF OFF)**

#### **C. Configuración ESC/POS**
- **Comando de inicio: ESC @ (ASCII 27, 64)**
- **Codificación: UTF-8 o CP850**
- **Ancho de papel: 80mm (48 caracteres)**
- **Corte automático: Habilitado**

### 2. 🪟 CONFIGURACIÓN EN WINDOWS

#### **A. Instalación de Drivers**
1. **Descargar drivers específicos del fabricante:**
   - **Epson:** TM-T20II, TM-T82, serie TM
   - **Star:** TSP650II, TSP143III, serie TSP
   - **Citizen:** CT-S310II, CT-S4000, serie CT-S
   - **Bixolon:** SRP-350III, SRP-275III, serie SRP

2. **Instalar como "Impresora térmica" no como "Impresora genérica"**

3. **Configurar puerto correctamente:**
   ```
   Puerto COM: COM1, COM2, COM3, etc.
   Puerto USB: USB001, USB002, USB003
   Puerto LPT: LPT1 (si es paralela)
   ```

#### **B. Configuración del Spooler de Impresión**
1. Ir a **Panel de Control → Dispositivos e impresoras**
2. Click derecho en la impresora térmica
3. **Propiedades de impresora → Avanzadas**
4. Configurar:
   - ✅ **Imprimir directamente a la impresora**
   - ✅ **Habilitar características avanzadas de impresión**
   - ✅ **Empezar a imprimir después de enviar la última página al spooler**

#### **C. Configuración de Formato de Papel**
1. **Propiedades → Configurar página**
2. **Tamaño personalizado:**
   - Ancho: 80mm (3.15 pulgadas)
   - Alto: Variable (continuo)
   - Márgenes: 0mm en todos los lados

### 3. 🔌 VERIFICACIÓN DE CONECTIVIDAD

#### **A. Verificar Puerto de Comunicación**
```bash
# En CMD/PowerShell, verificar puertos disponibles:
wmic printer get Name,PortName,Status

# Verificar puertos COM disponibles:
wmic path Win32_SerialPort get DeviceID,Description
```

#### **B. Prueba Manual de Impresión**
```bash
# Crear archivo de prueba ESC/POS:
echo "ESC@Prueba de impresora termica" > test.prn

# Enviar a puerto USB:
copy /B test.prn USB001

# Enviar a puerto COM:
copy /B test.prn COM3

# Enviar a puerto LPT:
copy /B test.prn LPT1
```

### 4. 🛠️ CONFIGURACIÓN ESPECÍFICA POR MARCA

#### **🟢 EPSON (TM Series)**
- **Driver:** EPSON TM-T20II/T70/T82
- **Modo ESC/POS:** Habilitado por defecto
- **Puerto preferido:** USB o COM
- **Comando reset:** ESC @ (27, 64)
- **Configuración especial:** Habilitar "Receipt mode"

#### **🟡 STAR (TSP Series)**  
- **Driver:** Star TSP143III CloudPRNT
- **Herramienta:** Star Cloud Services Setup Tool
- **Configuración ESC/POS:** En menú de configuración
- **Puerto preferido:** USB, Ethernet, o Bluetooth

#### **🔵 CITIZEN (CT-S Series)**
- **Driver:** Citizen CT-S310II
- **Modo línea:** Activar "Line mode" en DIP switches
- **ESC/POS:** Compatible por defecto
- **Herramienta:** Citizen Printer Setting Tool

#### **🟠 BIXOLON (SRP Series)**
- **Driver:** Bixolon SRP-350III
- **Configuración:** BPRN (Bixolon Printer Configurator)
- **Modo ESC/POS:** Activar en configuración
- **Puerto:** USB preferido, COM alternativo

### 5. 🚨 SOLUCIÓN DE PROBLEMAS COMUNES

#### **❌ NO IMPRIME NADA**
1. ✅ Verificar que la impresora esté encendida
2. ✅ Comprobar que tenga papel térmico
3. ✅ Verificar que el puerto sea correcto
4. ✅ Confirmar que esté en "Line Mode"
5. ✅ Verificar drivers instalados correctamente

#### **❌ IMPRIME CARACTERES EXTRAÑOS**
1. 🔧 Cambiar codificación a UTF-8
2. 🔧 Verificar configuración ESC/POS
3. 🔧 Actualizar firmware de la impresora
4. 🔧 Revisar configuración de puerto COM

#### **❌ IMPRIME PERO CORTA EL TEXTO**
1. 📏 Configurar ancho a 48 caracteres (80mm)
2. 📏 Ajustar márgenes a 0
3. 📏 Verificar configuración de papel continuo
4. 📏 Revisar configuración de "Line spacing"

#### **❌ NO CORTA EL PAPEL**
1. ✂️ Verificar comando de corte ESC i (27, 105)
2. ✂️ Comprobar que el cortador esté habilitado
3. ✂️ Verificar que tenga cuchilla funcional
4. ✂️ Configurar "Auto cut" en driver

### 6. 🧪 COMANDOS DE PRUEBA ESC/POS

#### **A. Prueba Básica (Hexadecimal)**
```
1B 40          - ESC @ (Inicializar)
48 6F 6C 61    - "Hola"
0A             - Line Feed  
1D 56 42 00    - Cortar papel
```

#### **B. Prueba con Formato**
```
1B 40          - Inicializar
1B 21 30       - Texto grande y centrado
48 4F 4C 41    - "HOLA"
0A             - Nueva línea
1B 21 00       - Texto normal
50 72 75 65 62 61 - "Prueba"
0A 0A 0A       - 3 líneas vacías
1D 56 42 00    - Cortar
```

### 7. ⚙️ CONFIGURACIÓN ÓPTIMA WILPOS

#### **A. Parámetros Recomendados**
- **Ancho de línea:** 48 caracteres
- **Velocidad impresión:** 9600 baud
- **Encoding:** UTF-8
- **Buffer:** 8KB mínimo
- **Timeout:** 15 segundos

#### **B. Formato de Factura Optimizado**
- **Header:** 3-4 líneas máximo
- **Productos:** Nombre + precio en 2 líneas
- **Códigos:** Solo si necesario
- **Footer:** Compacto pero informativo
- **Corte automático:** Habilitado

### 8. 📋 CHECKLIST DE CONFIGURACIÓN

#### **Antes de usar WilPOS:**
- [ ] Impresora encendida y con papel
- [ ] Driver correcto instalado
- [ ] Modo "Line Mode" activado
- [ ] Puerto USB/COM configurado
- [ ] Prueba manual exitosa
- [ ] Configuración ESC/POS verificada
- [ ] Corte automático funcional
- [ ] Sin errores en Device Manager

#### **En caso de fallo:**
- [ ] Revisar logs de WilPOS (consola F12)
- [ ] Probar con comando manual
- [ ] Verificar Device Manager
- [ ] Reiniciar servicio de spooler
- [ ] Actualizar drivers
- [ ] Contactar soporte del fabricante

### 9. 🆘 CONTACTO SOPORTE

Si después de seguir esta guía la impresora no funciona:

1. **Documentar el problema:**
   - Marca y modelo exacto
   - Sistema operativo
   - Puerto utilizado
   - Mensaje de error específico

2. **Información para soporte:**
   - Logs de WilPOS (F12 → Console)
   - Resultado de `wmic printer list full`
   - Captura de configuración de impresora

---

## ✨ RESULTADO ESPERADO

Con esta configuración, WilPOS debe:
- ✅ Detectar automáticamente la impresora térmica
- ✅ Imprimir facturas con formato profesional
- ✅ Usar el 100% del ancho del papel (48 caracteres)
- ✅ Cortar automáticamente el papel
- ✅ Mostrar mensajes de éxito en logs
- ✅ Funcionar sin reiniciar la aplicación

**¡La impresión física debe ocurrir inmediatamente tras completar una venta!**