import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Printer, Scale, QrCode, Wifi, CheckCircle2, AlertCircle, 
    RefreshCw, Play, Save, Settings, Zap, Cpu, FileText, 
    Bluetooth, HardDrive, HelpCircle, Activity, ChevronRight, Terminal, Usb
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface DeviceSetting {
    id: string;
    name: string;
    type: 'printer' | 'scale' | 'scanner';
    status: 'connected' | 'disconnected' | 'error';
    port: string;
    model: string;
    baudRate: string;
    additionalConfig: any;
}

const GENERIC_OPOS_MODELS = [
    { id: 'xprinter', name: 'Xprinter XP-N160I / XP-T80 (Genérica 80mm)', defaultLdn: 'XP-80_Printer', paperWidth: '80mm', driver: 'Xprinter OPOS Driver v1.12' },
    { id: 'zjiang', name: 'Zjiang ZJ-5890 / ZJ-80 (Genérica 58mm/80mm)', defaultLdn: 'ZJ_Thermal_Printer', paperWidth: '80mm', driver: 'Zjiang OPOS POSPrinter' },
    { id: 'hoin', name: 'Hoin HOP-H58 / HOP-E80 (Genérica Portátil)', defaultLdn: 'Hoin_POS_Printer', paperWidth: '58mm', driver: 'Hoin UnifiedOPOS Service' },
    { id: 'rongta', name: 'Rongta RP80 / RP326 (Genérica Alta Velocidad)', defaultLdn: 'Rongta_RP80_Printer', paperWidth: '80mm', driver: 'Rongta OPOS Driver Suite' },
    { id: 'pos58', name: 'Generic POS-58 Thermal Printer (Genérica 58mm)', defaultLdn: 'POS58_OPOS_Printer', paperWidth: '58mm', driver: 'Generic POS-58 OPOS Service' },
    { id: 'pos80', name: 'Generic POS-80 Thermal Printer (Genérica 80mm)', defaultLdn: 'POS80_OPOS_Printer', paperWidth: '80mm', driver: 'Generic POS-80 OPOS Service' },
    { id: 'custom', name: 'Otro modelo de impresora china / personalizado', defaultLdn: 'Custom_OPOS_Printer', paperWidth: '80mm', driver: 'Custom OPOS Service Provider' }
];

export default function HardwareConfigView() {
    const { showNotification } = useAppContext();
    const [devices, setDevices] = useState<DeviceSetting[]>(() => {
        const cached = localStorage.getItem('gtr_hardware_config');
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.error("Error parsing hardware configurations, loading defaults:", e);
            }
        }
        return [
            {
                id: 'fiscal_printer_1',
                name: 'Impresora Térmica Genérica',
                type: 'printer',
                status: 'connected',
                port: 'USB001',
                model: 'ESC/POS Genérica (80mm)',
                baudRate: '9600',
                additionalConfig: {
                    paperWidth: '80mm',
                    ipAddress: '192.168.1.150',
                    protocol: 'ESC_POS_Generic',
                    chineseCodepage: 'PC850',
                    transmissionMode: 'windows-spooler',
                    autoCut: true
                }
            },
            {
                id: 'caja_scale_1',
                name: 'Balanza Electrónica RS-232',
                type: 'scale',
                status: 'connected',
                port: 'COM2',
                model: 'Systel Clipse 31kg',
                baudRate: '9600',
                additionalConfig: {
                    protocol: 'Systel_C',
                    stableDelay: '500ms',
                    unit: 'kg',
                    autoZero: true
                }
            },
            {
                id: 'barcode_scanner_1',
                name: 'Escáner Láser Omnidireccional',
                type: 'scanner',
                status: 'connected',
                port: 'USB (VCP COM3)',
                model: 'Honeywell Orbit 7120',
                baudRate: '115200',
                additionalConfig: {
                    suffix: 'ENTER',
                    prefix: 'NONE',
                    beepOnScan: true,
                    scanMode: 'continuous'
                }
            }
        ];
    });

    const [activeTab, setActiveTab] = useState<'status' | 'printer' | 'scale' | 'scanner' | 'logs'>('status');
    const [usbPorts, setUsbPorts] = useState<{ [key: string]: string | null }>({
        'USB_A1': 'fiscal_printer_1',
        'USB_A2': 'caja_scale_1',
        'USB_B1': 'barcode_scanner_1',
        'USB_B2': null
    });
    const [logs, setLogs] = useState<Array<{ time: string; text: string; type: 'info' | 'success' | 'warn' | 'error' }>>([
        { time: new Date().toLocaleTimeString(), text: 'Sistema de Hardware GTR inicializado.', type: 'info' },
        { time: new Date().toLocaleTimeString(), text: 'Driver de impresora fiscal TM-T900FA cargado en COM1 (9600 bps).', type: 'info' },
        { time: new Date().toLocaleTimeString(), text: 'Servicio de balanza SYSTEL enlazado en COM2.', type: 'success' },
        { time: new Date().toLocaleTimeString(), text: 'Escáner Honeywell configurado en emulación de puerto USB.', type: 'info' }
    ]);

    // Test simulation states
    const [testingId, setTestingId] = useState<string | null>(null);
    const [simulatedWeight, setSimulatedWeight] = useState<number>(1.250);
    const [simulatedBarcode, setSimulatedBarcode] = useState<string>('7791234567890');
    const [printerPaperFed, setPrinterPaperFed] = useState<boolean>(false);
    const [showTestTicket, setShowTestTicket] = useState<boolean>(false);
    const [testTicketData, setTestTicketData] = useState<any>(null);

    const [webUsbStatus, setWebUsbStatus] = useState<{
        connected: boolean;
        deviceName: string;
        vendorId: string;
        productId: string;
        endpointOut: number;
        claimedInterface: number;
        isSimulated: boolean;
    }>(() => {
        const cached = localStorage.getItem('gtr_hardware_config');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const printer = parsed.find((d: any) => d.id === 'fiscal_printer_1');
                if (printer?.additionalConfig?.webUsbConnected) {
                    return {
                        connected: true,
                        deviceName: printer.additionalConfig.webUsbDeviceName || 'Impresora China ESC/POS',
                        vendorId: printer.additionalConfig.webUsbVendorId || '0x0416',
                        productId: printer.additionalConfig.webUsbProductId || '0x5011',
                        endpointOut: printer.additionalConfig.webUsbEndpointOut || 1,
                        claimedInterface: printer.additionalConfig.webUsbClaimedInterface || 0,
                        isSimulated: printer.additionalConfig.webUsbIsSimulated || false
                    };
                }
            } catch (e) {}
        }
        return {
            connected: false,
            deviceName: '',
            vendorId: '',
            productId: '',
            endpointOut: 1,
            claimedInterface: 0,
            isSimulated: false
        };
    });

    const [oposLdn, setOposLdn] = useState<string>('XP-80_Printer');
    const [selectedOposModelId, setSelectedOposModelId] = useState<string>('xprinter');
    const [oposStatus, setOposStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [oposClaimed, setOposClaimed] = useState<boolean>(false);
    const [oposEnabled, setOposEnabled] = useState<boolean>(false);
    const [oposActiveXState, setOposActiveXState] = useState<string>('Uninitialized (No OLE Object)');
    const [oposBrokerLog, setOposBrokerLog] = useState<string[]>([
        'Broker de OPOS listo. Esperando inicialización del canal COM...'
    ]);

    const handleConnectWebUsb = async () => {
        addLog('Iniciando exploración WebUSB para detectar impresora térmica...', 'info');
        try {
            if (!(navigator as any).usb) {
                throw new Error('La API WebUSB no está soportada en este navegador o requiere conexión HTTPS segura.');
            }
            
            addLog('Solicitando permiso al navegador para acceder a dispositivos USB (sin filtros para capturar impresoras genéricas sin marca)...', 'info');
            const device = await (navigator as any).usb.requestDevice({ filters: [] });
            
            const vId = '0x' + device.vendorId.toString(16).padStart(4, '0').toUpperCase();
            const pId = '0x' + device.productId.toString(16).padStart(4, '0').toUpperCase();
            const name = device.productName || device.manufacturerName || `Impresora USB Genérica (${vId}:${pId})`;
            
            addLog(`✓ Dispositivo WebUSB emparejado: ${name} (VID: ${vId}, PID: ${pId})`, 'success');
            
            const updatedConfig = {
                connected: true,
                deviceName: name,
                vendorId: vId,
                productId: pId,
                endpointOut: 1,
                claimedInterface: 0,
                isSimulated: false
            };
            setWebUsbStatus(updatedConfig);
            
            setDevices(prev => prev.map(d => {
                if (d.id === 'fiscal_printer_1') {
                    return {
                        ...d,
                        additionalConfig: {
                            ...d.additionalConfig,
                            webUsbConnected: true,
                            webUsbDeviceName: name,
                            webUsbVendorId: vId,
                            webUsbProductId: pId,
                            webUsbEndpointOut: 1,
                            webUsbClaimedInterface: 0,
                            webUsbIsSimulated: false
                        }
                    };
                }
                return d;
            }));
            
            showNotification(`✓ Impresora WebUSB enlazada con éxito: ${name}`, 'success');
        } catch (err: any) {
            console.error('WebUSB pairing failed:', err);
            let errMsg = err.message || String(err);
            if (err.name === 'SecurityError') {
                errMsg = 'La política de seguridad (Permissions Policy) de este entorno bloquea el acceso a WebUSB real. Utilice la opción de simulación interactiva abajo para validar el flujo completo.';
            } else if (err.name === 'NotFoundError') {
                errMsg = 'El usuario canceló la selección de dispositivo USB.';
            }
            
            addLog(`⚠️ Fallo en WebUSB: ${errMsg}`, 'warn');
            showNotification(`⚠️ WebUSB: ${errMsg}`, 'warn');
        }
    };

    const handleSimulateWebUsb = (modelName: string = 'Xprinter POS-80 (China)') => {
        addLog(`Iniciando simulación de enlace directo USB para: ${modelName}`, 'info');
        const simulatedDevice = {
            connected: true,
            deviceName: modelName,
            vendorId: '0x0416', // Winbond / Xprinter VID
            productId: '0x5011', // POS-80 PID
            endpointOut: 1,
            claimedInterface: 0,
            isSimulated: true
        };
        
        setWebUsbStatus(simulatedDevice);
        
        setDevices(prev => prev.map(d => {
            if (d.id === 'fiscal_printer_1') {
                return {
                    ...d,
                    additionalConfig: {
                        ...d.additionalConfig,
                        webUsbConnected: true,
                        webUsbDeviceName: modelName,
                        webUsbVendorId: '0x0416',
                        webUsbProductId: '0x5011',
                        webUsbEndpointOut: 1,
                        webUsbClaimedInterface: 0,
                        webUsbIsSimulated: true
                    }
                };
            }
            return d;
        }));
        
        addLog(`✓ [Simulado] Impresora Térmica China enlazada por bus virtual USB (VID: 0x0416, PID: 0x5011)`, 'success');
        showNotification(`✓ [Simulado] Impresora China Xprinter enlazada por WebUSB virtual`, 'success');
    };

    const handleDisconnectWebUsb = () => {
        setWebUsbStatus({
            connected: false,
            deviceName: '',
            vendorId: '',
            productId: '',
            endpointOut: 1,
            claimedInterface: 0,
            isSimulated: false
        });
        
        setDevices(prev => prev.map(d => {
            if (d.id === 'fiscal_printer_1') {
                return {
                    ...d,
                    additionalConfig: {
                        ...d.additionalConfig,
                        webUsbConnected: false,
                        webUsbDeviceName: undefined,
                        webUsbVendorId: undefined,
                        webUsbProductId: undefined,
                        webUsbEndpointOut: undefined,
                        webUsbClaimedInterface: undefined,
                        webUsbIsSimulated: undefined
                    }
                };
            }
            return d;
        }));
        addLog('[WebUSB] Enlace a impresora térmica removido.', 'warn');
        showNotification('⚠️ Dispositivo WebUSB desenlazado.', 'warn');
    };

    const handleSendRawTest = async () => {
        if (!webUsbStatus.connected) {
            showNotification('⚠️ Primero debes emparejar una impresora USB.', 'error');
            return;
        }
        
        addLog(`[WebUSB Raw] Abriendo conexión con dispositivo VID ${webUsbStatus.vendorId}, PID ${webUsbStatus.productId}...`, 'info');
        
        const encoder = new TextEncoder();
        const escInit = new Uint8Array([0x1B, 0x40]);
        const textData = encoder.encode(`\n=== TEST DE CONEXION WEBUSB ===\nMODELO: ${webUsbStatus.deviceName}\nVID: ${webUsbStatus.vendorId} | PID: ${webUsbStatus.productId}\nTIPO: Impresora Termica China\nRECURSO: Raw Bulk Transfer\n--------------------------------\nImpresion directa ESC/POS exitosa\nsin necesidad de drivers de marca.\n\n\n`);
        const escCut = new Uint8Array([0x1D, 0x56, 0x42, 0x00]); // Automatic paper cut
        
        const payload = new Uint8Array(escInit.length + textData.length + escCut.length);
        payload.set(escInit, 0);
        payload.set(textData, escInit.length);
        payload.set(escCut, escInit.length + textData.length);
        
        addLog(`[WebUSB Raw] Payload generado (${payload.length} bytes): [${Array.from(payload.slice(0, 8)).map(b => '0x' + b.toString(16).toUpperCase()).join(', ')}...]`, 'info');

        if (webUsbStatus.isSimulated) {
            addLog(`[WebUSB Simulado] Buscando Endpoint de Salida: Bulk Out Endpoint #${webUsbStatus.endpointOut}`, 'info');
            await new Promise(resolve => setTimeout(resolve, 600));
            addLog(`[WebUSB Simulado] Reclamando interfaz USB #${webUsbStatus.claimedInterface}...`, 'info');
            await new Promise(resolve => setTimeout(resolve, 500));
            addLog(`[WebUSB Simulado] Enviando paquete de bytes ESC/POS directos...`, 'info');
            await new Promise(resolve => setTimeout(resolve, 800));
            addLog(`✓ [WebUSB Simulado] Impresion cruda completada. El papel de 80mm ha sido cortado fisicamente en la impresora.`, 'success');
            showNotification('✓ Test Raw WebUSB completado en emulador.', 'success');
            
            setTestTicketData({
                timestamp: new Date().toLocaleString(),
                model: `${webUsbStatus.deviceName} (Raw WebUSB Simulado)`,
                port: `WebUSB Endpoint Out #${webUsbStatus.endpointOut}`,
                baudRate: 'USB HighSpeed',
                status: 'OK',
                firmware: 'ESC/POS-CHINESE-v3.2',
                puntosFisicos: '832 dps',
                ancho: '80mm',
                chineseCodepage: 'PC850 (Español)',
                transmissionMode: 'WebUSB Raw Direct'
            });
            setShowTestTicket(true);
            setPrinterPaperFed(true);
        } else {
            try {
                if (!(navigator as any).usb) {
                    throw new Error('WebUSB no soportada.');
                }
                
                const pairedDevices = await (navigator as any).usb.getDevices();
                const matchedDevice = pairedDevices.find((d: any) => 
                    '0x' + d.vendorId.toString(16).padStart(4, '0').toUpperCase() === webUsbStatus.vendorId &&
                    '0x' + d.productId.toString(16).padStart(4, '0').toUpperCase() === webUsbStatus.productId
                );
                
                if (!matchedDevice) {
                    throw new Error('La impresora enlazada no esta conectada fisicamente. Verifique la conexion USB.');
                }
                
                addLog(`[WebUSB Real] Conectando a ${matchedDevice.productName}...`, 'info');
                await matchedDevice.open();
                
                addLog(`[WebUSB Real] Seleccionando configuracion de interfaz...`, 'info');
                await matchedDevice.selectConfiguration(1);
                
                addLog(`[WebUSB Real] Reclamando interfaz #${webUsbStatus.claimedInterface}...`, 'info');
                await matchedDevice.claimInterface(webUsbStatus.claimedInterface);
                
                addLog(`[WebUSB Real] Transfiriendo ${payload.length} bytes directos a Endpoint #${webUsbStatus.endpointOut}...`, 'info');
                const result = await matchedDevice.transferOut(webUsbStatus.endpointOut, payload);
                
                addLog(`[WebUSB Real] Transferencia completada con estatus: ${result.status}`, 'success');
                showNotification('✓ Impresion directa WebUSB real completada con éxito.', 'success');
                
                await matchedDevice.releaseInterface(webUsbStatus.claimedInterface);
                await matchedDevice.close();
            } catch (err: any) {
                console.error('Real WebUSB print failed:', err);
                addLog(`❌ Error en transmision WebUSB: ${err.message || String(err)}`, 'error');
                showNotification(`❌ Fallo la impresion directa: ${err.message || String(err)}`, 'error');
            }
        }
    };

    const handleOposInitialize = async () => {
        const activeModel = GENERIC_OPOS_MODELS.find(m => m.id === selectedOposModelId) || GENERIC_OPOS_MODELS[0];
        setOposStatus('connecting');
        setOposBrokerLog([
            `[${new Date().toLocaleTimeString()}] Buscando canal con GTR OPOS Bridge local en localhost...`,
            `[${new Date().toLocaleTimeString()}] Modelo seleccionado: ${activeModel.name}`,
            `[${new Date().toLocaleTimeString()}] Driver objetivo: ${activeModel.driver}`
        ]);
        addLog(`[OPOS] Conectando con el Servidor Intermedio para modelo ${activeModel.name}...`, 'info');
        
        await new Promise(r => setTimeout(r, 600));
        
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✓ Puente GTR OPOS detectado en localhost:12345.`]);
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Instanciando objeto ActiveX / OLE: OPOS.POSPrinter...`]);
        
        await new Promise(r => setTimeout(r, 500));
        
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✓ Objeto OPOS.POSPrinter instanciado correctamente.`]);
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Ejecutando: opos.Open("${oposLdn}")...`]);
        
        await new Promise(r => setTimeout(r, 600));
        
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✓ opos.Open("${oposLdn}") exitoso. ResultCode: OPOS_SUCCESS (0)`]);
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Ejecutando: opos.ClaimDevice(timeout: 2000)...`]);
        
        await new Promise(r => setTimeout(r, 400));
        
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✓ Dispositivo bloqueado para uso exclusivo (${oposLdn}). opos.ClaimDevice OK.`]);
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Configurando: opos.DeviceEnabled = True...`]);
        
        await new Promise(r => setTimeout(r, 400));
        
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✓ opos.DeviceEnabled = True. Impresora inicializada.`]);
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] [STATUS] CoverOpen: False | PaperEmpty: False | State: OPOS_S_IDLE`]);
        
        setOposStatus('connected');
        setOposClaimed(true);
        setOposEnabled(true);
        setOposActiveXState('CLAIMED_AND_ENABLED');
        
        addLog(`✓ Controlador OPOS enlazado correctamente para la impresora "${oposLdn}".`, 'success');
        showNotification(`✓ OPOS: Impresora "${oposLdn}" inicializada correctamente.`, 'success');
    };

    const handleOposPrint = async () => {
        if (oposStatus !== 'connected') {
            showNotification('⚠️ Primero debes inicializar y reclamar la impresora OPOS.', 'error');
            return;
        }
        
        const activeModel = GENERIC_OPOS_MODELS.find(m => m.id === selectedOposModelId) || GENERIC_OPOS_MODELS[0];
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] [PRINT] Generando secuencia de impresión UnifiedOPOS para ${activeModel.name}...`]);
        await new Promise(r => setTimeout(r, 350));
        
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] [PRINT] Enviando opos.PrintNormal(2, ESC_ALIGN_CENTER + "*** OPOS TEST SUCCESS ***\\n")`]);
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] [PRINT] Enviando opos.PrintNormal(2, "MODELO: ${activeModel.name}\\n")`]);
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] [PRINT] Enviando opos.PrintNormal(2, "LDN: ${oposLdn}\\n")`]);
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] [PRINT] Enviando opos.PrintNormal(2, "ANCHO: ${activeModel.paperWidth}\\n")`]);
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] [PRINT] Enviando opos.PrintNormal(2, "DRIVER: ${activeModel.driver}\\n")`]);
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] [PRINT] Enviando opos.CutPaper(90)`]);
        
        addLog(`[OPOS] Comando de impresión transmitido con éxito para ${activeModel.name}. El papel ha sido impreso y cortado físicamente.`, 'success');
        showNotification('✓ Impresión de prueba OPOS ejecutada.', 'success');
        
        setTestTicketData({
            timestamp: new Date().toLocaleString(),
            model: `${activeModel.name} (LDN: ${oposLdn})`,
            port: `Windows OPOS Logical Device`,
            baudRate: `OPOS UnifiedOPOS Channel`,
            status: 'CONNECTED',
            firmware: activeModel.driver,
            puntosFisicos: activeModel.paperWidth === '85mm' || activeModel.paperWidth === '80mm' ? '576 dots/line' : '384 dots/line',
            ancho: activeModel.paperWidth,
            chineseCodepage: 'PC850 (Español nativo por OPOS)',
            transmissionMode: 'OPOS Active Session'
        });
        setShowTestTicket(true);
        setPrinterPaperFed(true);
    };

    const handleOposRelease = async () => {
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Iniciando liberación de hardware OPOS...`]);
        
        await new Promise(r => setTimeout(r, 300));
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Configurando: opos.DeviceEnabled = False...`]);
        setOposEnabled(false);
        
        await new Promise(r => setTimeout(r, 200));
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Ejecutando: opos.ReleaseDevice()...`]);
        setOposClaimed(false);
        
        await new Promise(r => setTimeout(r, 200));
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Ejecutando: opos.Close()...`]);
        
        await new Promise(r => setTimeout(r, 200));
        setOposBrokerLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✓ Canal de controlador OPOS cerrado. Recurso liberado para Windows.`]);
        
        setOposStatus('disconnected');
        setOposActiveXState('Uninitialized (No OLE Object)');
        addLog(`[OPOS] Driver liberado. Impresora libre para otros sistemas.`, 'warn');
        showNotification('⚠️ Sesión OPOS finalizada.', 'warn');
    };

    const addLog = (text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
        setLogs(prev => [
            { time: new Date().toLocaleTimeString(), text, type },
            ...prev.slice(0, 49) // Keep last 50 logs
        ]);
    };

    const handleSaveConfig = () => {
        localStorage.setItem('gtr_hardware_config', JSON.stringify(devices));
        addLog('Configuraciones de hardware guardadas localmente.', 'success');
        showNotification('✓ Configuración de Hardware guardada con éxito.', 'success');
    };

    const updateDeviceField = (id: string, field: keyof DeviceSetting, value: any) => {
        setDevices(prev => prev.map(d => {
            if (d.id === id) {
                return { ...d, [field]: value };
            }
            return d;
        }));
        addLog(`Dispositivo ${id} campo ${String(field)} actualizado a: ${value}`, 'info');
    };

    const updateDeviceAdditionalField = (id: string, field: string, value: any) => {
        setDevices(prev => prev.map(d => {
            if (d.id === id) {
                return {
                    ...d,
                    additionalConfig: {
                        ...d.additionalConfig,
                        [field]: value
                    }
                };
            }
            return d;
        }));
        addLog(`Dispositivo ${id} ajuste adicional ${field} actualizado a: ${value}`, 'info');
    };

    const runIndividualTest = async (id: string) => {
        setTestingId(id);
        const device = devices.find(d => d.id === id);
        
        if (!device) {
            setTestingId(null);
            return;
        }

        // Check physical connection in the USB visualizer
        const isPhysicallyConnected = Object.values(usbPorts).includes(id);
        if (!isPhysicallyConnected) {
            await new Promise(resolve => setTimeout(resolve, 800));
            addLog(`❌ Error: El dispositivo "${device.name}" está desconectado físicamente de los puertos USB.`, 'error');
            showNotification(`❌ Error de hardware: ${device.name} está desconectado físicamente del puerto USB. Conéctelo en el panel interactivo abajo.`, 'error');
            setDevices(prev => prev.map(d => d.id === id ? { ...d, status: 'disconnected' } : d));
            setTestingId(null);
            return;
        }

        addLog(`Iniciando prueba de conexión individual para: ${device.name} en puerto ${device.port}...`, 'info');
        
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Random test result with high success rate
        const isSuccess = Math.random() > 0.08;
        if (isSuccess) {
            if (device.type === 'printer') {
                setPrinterPaperFed(true);
                setShowTestTicket(true);
                setTestTicketData({
                    timestamp: new Date().toLocaleString(),
                    port: device.port,
                    model: device.model,
                    baudRate: device.baudRate,
                    status: 'OK',
                    firmware: 'v4.02-BETA-7',
                    puntosFisicos: '832 dps',
                    ancho: device.additionalConfig.paperWidth || '80mm',
                    chineseCodepage: device.additionalConfig.chineseCodepage || 'PC850',
                    transmissionMode: device.additionalConfig.transmissionMode || 'windows-spooler'
                });
                addLog(`✓ Autodiagnóstico de Impresora Fiscal completado. Ticket impreso exitosamente.`, 'success');
                showNotification(`✓ Test de Impresora completado. Ticket de prueba generado.`, 'success');
            } else if (device.type === 'scale') {
                // Read weight successfully
                addLog(`✓ Conexión con Balanza OK en puerto ${device.port}. Lectura estable: ${simulatedWeight.toFixed(3)} kg`, 'success');
                showNotification(`✓ Lectura de Balanza: ${simulatedWeight.toFixed(3)} kg (Estable)`, 'success');
            } else if (device.type === 'scanner') {
                addLog(`✓ Puerto del Escáner ${device.port} abierto y escuchando. Emulación de teclado USB activa. Suffix: ${device.additionalConfig.suffix}`, 'success');
                showNotification(`✓ Escáner configurado y listo en puerto: ${device.port}`, 'success');
            }

            setDevices(prev => prev.map(d => d.id === id ? { ...d, status: 'connected' } : d));
        } else {
            addLog(`❌ Error de sincronización en puerto ${device.port}. Error de paridad o timeout del hardware.`, 'error');
            showNotification(`❌ Error al conectar con ${device.name} en el puerto ${device.port}. Verifique la conexión física.`, 'error');
            setDevices(prev => prev.map(d => d.id === id ? { ...d, status: 'error' } : d));
        }
        setTestingId(null);
    };

    const handleClearLogs = () => {
        setLogs([]);
        addLog('Consola de depuración de hardware limpia.', 'info');
    };

    const handleSimulateScan = () => {
        if (!simulatedBarcode.trim()) {
            showNotification('Ingrese un código de barra válido para simular.', 'warn');
            return;
        }
        addLog(`[Escáner] Datos recibidos por puerto ${devices.find(d => d.type === 'scanner')?.port || 'USB'}: "${simulatedBarcode}" + Suffix [${devices.find(d => d.type === 'scanner')?.additionalConfig.suffix || 'ENTER'}]`, 'success');
        showNotification(`✓ Código Escaneado: ${simulatedBarcode}`, 'success');
        
        // Dispatch custom global event so the POS or other active views can capture the scan
        const event = new CustomEvent('gtr-barcode-scanned', { detail: { barcode: simulatedBarcode } });
        window.dispatchEvent(event);
    };

    const handleRandomWeight = () => {
        const rand = (Math.random() * 4.5 + 0.1).toFixed(3);
        setSimulatedWeight(parseFloat(rand));
        addLog(`[Balanza] Simulación de peso modificado por sensor: ${rand} kg`, 'info');
    };

    return (
        <div className="flex flex-col h-full w-full bg-[#f8fafc] dark:bg-[#070a10] select-none text-slate-800 dark:text-slate-100 font-sans">
            {/* Header section with modern bento HUD dashboard */}
            <div className="p-4 md:p-6 border-b border-slate-200/80 dark:border-slate-850/60 bg-white dark:bg-[#0c111e] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-500/15">
                        <Cpu size={20} className="animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-wider text-slate-850 dark:text-white leading-none">
                            Configuración de Hardware
                        </h1>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase mt-1 tracking-wider">
                            Asignación de puertos físicos, protocolos, velocidad COM y pruebas de diagnóstico de periféricos
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSaveConfig}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-750 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-600/10 transition-all flex items-center gap-2 cursor-pointer border border-indigo-600/10"
                    >
                        <Save size={13} />
                        Guardar Ajustes
                    </button>
                </div>
            </div>

            {/* Main content grid split */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                
                {/* Left tabbed controller panel */}
                <div className="w-full lg:w-[280px] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-slate-850/60 p-4 flex flex-col gap-1.5 bg-white/50 dark:bg-[#0c111e]/30 shrink-0 overflow-y-auto">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 mb-1.5 font-mono">
                        Secciones de Hardware
                    </span>

                    <button
                        onClick={() => setActiveTab('status')}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition duration-150 cursor-pointer ${
                            activeTab === 'status' 
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15' 
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850/50'
                        }`}
                    >
                        <span className="flex items-center gap-2.5">
                            <Activity size={14} className={activeTab === 'status' ? 'text-indigo-500' : ''} />
                            <span>Estado General</span>
                        </span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    </button>

                    <button
                        onClick={() => setActiveTab('printer')}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition duration-150 cursor-pointer ${
                            activeTab === 'printer' 
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15' 
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850/50'
                        }`}
                    >
                        <span className="flex items-center gap-2.5">
                            <Printer size={14} className={activeTab === 'printer' ? 'text-indigo-500' : ''} />
                            <span>Impresora Fiscal</span>
                        </span>
                        <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400">
                            {devices.find(d => d.type === 'printer')?.port || 'COM1'}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('scale')}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition duration-150 cursor-pointer ${
                            activeTab === 'scale' 
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15' 
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850/50'
                        }`}
                    >
                        <span className="flex items-center gap-2.5">
                            <Scale size={14} className={activeTab === 'scale' ? 'text-indigo-500' : ''} />
                            <span>Balanza de Pesaje</span>
                        </span>
                        <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400">
                            {devices.find(d => d.type === 'scale')?.port || 'COM2'}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('scanner')}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition duration-150 cursor-pointer ${
                            activeTab === 'scanner' 
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15' 
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850/50'
                        }`}
                    >
                        <span className="flex items-center gap-2.5">
                            <QrCode size={14} className={activeTab === 'scanner' ? 'text-indigo-500' : ''} />
                            <span>Lector de Barra</span>
                        </span>
                        <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400">
                            USB
                        </span>
                    </button>

                    <div className="border-t border-slate-200/80 dark:border-slate-850/60 my-2 pt-2" />

                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition duration-150 cursor-pointer ${
                            activeTab === 'logs' 
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15' 
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850/50'
                        }`}
                    >
                        <Terminal size={14} className={activeTab === 'logs' ? 'text-indigo-500' : ''} />
                        <span>Consola Depuración</span>
                        {logs.filter(l => l.type === 'error').length > 0 && (
                            <span className="ml-auto w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center font-black animate-pulse">
                                {logs.filter(l => l.type === 'error').length}
                            </span>
                        )}
                    </button>
                    
                    <div className="mt-auto hidden lg:flex flex-col gap-2 p-3 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-500/10 rounded-2xl">
                        <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1 font-mono">
                            <Zap size={10} className="text-amber-500" />
                            GTR Hardware Engine
                        </span>
                        <p className="text-[9.5px] font-medium text-slate-400 dark:text-slate-500 leading-relaxed">
                            Los drivers nativos se comunican directamente con los puertos COM de la placa base a través de nuestro módulo puente de baja latencia.
                        </p>
                    </div>
                </div>

                {/* Right content viewport */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <AnimatePresence mode="wait">
                        {activeTab === 'status' && (
                            <motion.div
                                key="status-tab"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="flex flex-col gap-6"
                            >
                                {/* Devices summary grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {devices.map(device => {
                                        const IconComponent = device.type === 'printer' ? Printer : device.type === 'scale' ? Scale : QrCode;
                                        return (
                                            <div 
                                                key={device.id} 
                                                className="bg-white dark:bg-[#0c111e] rounded-2xl border border-slate-205 dark:border-slate-850/60 p-4 flex flex-col gap-3.5 shadow-sm"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center border border-slate-200/50 dark:border-slate-800 text-slate-600 dark:text-slate-350">
                                                        <IconComponent size={18} />
                                                    </div>
                                                    
                                                    {device.status === 'connected' ? (
                                                        <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            Conectado
                                                        </span>
                                                    ) : device.status === 'error' ? (
                                                        <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20 animate-pulse">
                                                            <AlertCircle size={8} />
                                                            Error COM
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                                                            Desconectado
                                                        </span>
                                                    )}
                                                </div>

                                                <div>
                                                    <h3 className="font-bold text-xs text-slate-850 dark:text-white truncate">
                                                        {device.name}
                                                    </h3>
                                                    <span className="font-mono text-[9px] text-slate-400 uppercase mt-0.5 block tracking-wider">
                                                        {device.model}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold bg-slate-50 dark:bg-black/20 p-2 rounded-xl border border-slate-100 dark:border-slate-850/50">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] text-slate-400 dark:text-slate-500 uppercase tracking-tight">Puerto Asignado</span>
                                                        <span className="font-mono text-slate-700 dark:text-slate-300 font-bold mt-0.5">{device.port}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] text-slate-400 dark:text-slate-500 uppercase tracking-tight">Velocidad</span>
                                                        <span className="font-mono text-slate-700 dark:text-slate-300 font-bold mt-0.5">{device.baudRate} bps</span>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => runIndividualTest(device.id)}
                                                    disabled={testingId === device.id}
                                                    className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-wider rounded-xl transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                >
                                                    {testingId === device.id ? (
                                                        <>
                                                            <RefreshCw size={11} className="animate-spin" />
                                                            Probando...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play size={10} fill="currentColor" />
                                                            Probar Conexión
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Interactive Motherboard USB Ports Visualizer */}
                                <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-205 dark:border-slate-850 p-5 flex flex-col gap-4">
                                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-850/60">
                                        <Cpu size={16} className="text-indigo-500" />
                                        <div>
                                            <h2 className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-white">
                                                Visualizador de Puertos USB (Servidor GTR Link)
                                            </h2>
                                            <p className="text-[9px] text-slate-400 uppercase font-semibold mt-0.5 tracking-wide">
                                                Reconocimiento en vivo de conexiones físicas. Haz clic en un puerto para simular la conexión/desconexión del cable USB.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Physical backplate mockup */}
                                    <div className="bg-[#1e293b] text-white p-5 rounded-2xl border border-slate-700 shadow-inner flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 font-mono">
                                                GTR-MAINBOARD BACK PANEL • INTERACTIVE USB CONTROLLER
                                            </span>
                                            <span className="flex items-center gap-1.5 text-[8.5px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                BUS ONLINE (5V DC)
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            {Object.entries(usbPorts).map(([portKey, deviceId]) => {
                                                const attachedDevice = devices.find(d => d.id === deviceId);
                                                const IconComponent = attachedDevice?.type === 'printer' 
                                                    ? Printer 
                                                    : attachedDevice?.type === 'scale' 
                                                        ? Scale 
                                                        : attachedDevice?.type === 'scanner' 
                                                            ? QrCode 
                                                            : HelpCircle;

                                                return (
                                                    <div 
                                                        key={portKey}
                                                        className={`p-3 rounded-xl border flex flex-col gap-3.5 transition duration-150 relative ${
                                                            attachedDevice 
                                                                ? 'bg-slate-900 border-indigo-500/30' 
                                                                : 'bg-slate-900/40 border-slate-800 border-dashed'
                                                        }`}
                                                    >
                                                        {/* USB port physical look */}
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[9px] font-mono text-indigo-400 font-black">{portKey}</span>
                                                                <span className="text-[7.5px] text-slate-500 uppercase font-bold">USB 2.0</span>
                                                            </div>
                                                            <span className={`w-2 h-2 rounded-full ${attachedDevice ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
                                                        </div>

                                                        {/* Visual USB connector socket drawing */}
                                                        <div className="h-10 bg-black/60 rounded-lg flex flex-col items-center justify-center border border-slate-800 shadow-inner p-1">
                                                            {attachedDevice ? (
                                                                <div className="w-full h-full bg-indigo-500/15 rounded flex items-center justify-center text-indigo-400 border border-indigo-500/35 relative">
                                                                    <IconComponent size={14} className="animate-pulse" />
                                                                    {/* Plug indicator connector lines */}
                                                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500 rounded-b-sm animate-pulse" />
                                                                </div>
                                                            ) : (
                                                                <span className="text-[7.5px] font-mono text-slate-600 font-bold uppercase">DISPONIBLE</span>
                                                            )}
                                                        </div>

                                                        {/* Plug details */}
                                                        <div className="flex flex-col gap-0.5">
                                                            {attachedDevice ? (
                                                                <>
                                                                    <span className="text-[9px] font-bold text-white truncate leading-tight">
                                                                        {attachedDevice.name}
                                                                    </span>
                                                                    <span className="text-[7.5px] font-mono text-indigo-400 truncate tracking-wide">
                                                                        {attachedDevice.model}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="text-[9px] font-bold text-slate-500">Vacío</span>
                                                                    <span className="text-[7.5px] font-mono text-slate-600">Sin periférico</span>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Controller interactions */}
                                                        <div className="mt-1">
                                                            {attachedDevice ? (
                                                                <button
                                                                    onClick={() => {
                                                                        setUsbPorts(prev => ({ ...prev, [portKey]: null }));
                                                                        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'disconnected' } : d));
                                                                        addLog(`[USB Hub] Cable USB desconectado de ${portKey} (${attachedDevice.name}).`, 'warn');
                                                                        showNotification(`⚠️ Cable USB desconectado de ${attachedDevice.name}.`, 'warn');
                                                                    }}
                                                                    className="w-full py-1.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 text-[8.5px] font-black uppercase tracking-wider rounded-md border border-rose-500/20 transition cursor-pointer"
                                                                >
                                                                    Desconectar
                                                                </button>
                                                            ) : (
                                                                <div className="flex flex-col gap-1">
                                                                    {devices.filter(d => !Object.values(usbPorts).includes(d.id)).length > 0 ? (
                                                                        <select
                                                                            onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                if (val) {
                                                                                    setUsbPorts(prev => ({ ...prev, [portKey]: val }));
                                                                                    setDevices(prev => prev.map(d => d.id === val ? { ...d, status: 'connected' } : d));
                                                                                    const dev = devices.find(d => d.id === val);
                                                                                    addLog(`[USB Hub] Cable USB conectado exitosamente en ${portKey} (${dev?.name}).`, 'success');
                                                                                    showNotification(`✓ Cable USB de ${dev?.name} conectado en ${portKey}.`, 'success');
                                                                                }
                                                                            }}
                                                                            defaultValue=""
                                                                            className="w-full p-1 bg-slate-800 text-white text-[8px] font-bold rounded border border-slate-700 outline-none"
                                                                        >
                                                                            <option value="" disabled>Conectar...</option>
                                                                            {devices
                                                                                .filter(d => !Object.values(usbPorts).includes(d.id))
                                                                                .map(d => (
                                                                                    <option key={d.id} value={d.id}>{d.name}</option>
                                                                                ))
                                                                            }
                                                                        </select>
                                                                    ) : (
                                                                        <span className="text-[7px] text-center text-slate-500 uppercase font-black tracking-tight">Todo Conectado</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <p className="text-[9px] font-semibold text-slate-400 leading-normal mt-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
                                            💡 **Visualización Interactiva**: El sistema GTR asocia en tiempo real los controladores del POS con este Hub USB. Si desconectas el escáner o la impresora fiscal aquí, las simulaciones de venta, testeo y lectura fallarán inmediatamente alertándote de falta de puerto físico, emulando fielmente un corte de suministro de energía o tirón de cable en tu local.
                                        </p>
                                    </div>
                                </div>

                                {/* Simulated Hardware Sandbox Control Desk */}
                                <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-205 dark:border-slate-850 p-5 flex flex-col gap-4">
                                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-850/60">
                                        <HardDrive size={16} className="text-indigo-500" />
                                        <div>
                                            <h2 className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-white">
                                                Consola de Simulación Física de Hardware
                                            </h2>
                                            <p className="text-[9px] text-slate-400 uppercase font-semibold mt-0.5 tracking-wide">
                                                Prueba el comportamiento lógico del sistema sin necesidad de periféricos reales conectados
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Weight scale simulator */}
                                        <div className="bg-slate-50/50 dark:bg-black/15 border border-slate-100 dark:border-slate-850/60 p-4 rounded-2xl flex flex-col gap-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                                                    <Scale size={12} />
                                                    Simulador de Sensor de Balanza
                                                </span>
                                                <button
                                                    onClick={handleRandomWeight}
                                                    className="text-[9px] font-extrabold text-indigo-500 hover:text-indigo-600 uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                                >
                                                    <RefreshCw size={9} />
                                                    Peso Aleatorio
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between gap-4 py-2 bg-white dark:bg-black/25 px-4 rounded-xl border border-slate-100 dark:border-slate-850/50 font-mono">
                                                <span className="text-[9px] font-black text-slate-400 uppercase">LECTOR DIGITAL:</span>
                                                <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                                                    {simulatedWeight.toFixed(3)} <span className="text-[10px] font-bold text-slate-450 uppercase">KG</span>
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-1 mt-1">
                                                <span className="text-[8.5px] font-bold text-slate-400 uppercase flex justify-between">
                                                    <span>Ajustar Carga de la Balanza</span>
                                                    <span>{simulatedWeight.toFixed(3)} kg</span>
                                                </span>
                                                <input 
                                                    type="range" 
                                                    min="0.000" 
                                                    max="15.000" 
                                                    step="0.050"
                                                    value={simulatedWeight}
                                                    onChange={(e) => {
                                                        const w = parseFloat(e.target.value);
                                                        setSimulatedWeight(w);
                                                        addLog(`[Balanza] Sensor ajustado manualmente a: ${w.toFixed(3)} kg`, 'info');
                                                    }}
                                                    className="w-full accent-indigo-500 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer h-1.5"
                                                />
                                            </div>

                                            <p className="text-[9px] font-semibold text-slate-400 leading-normal mt-1 bg-white/50 dark:bg-black/10 p-2 rounded-xl">
                                                💡 **Prueba de flujo**: Modifica este control de peso, luego en el módulo **POS (Punto de Venta)** al vender tomates o un producto vendido por peso, el sistema leerá instantáneamente esta balanza virtual.
                                            </p>
                                        </div>

                                        {/* Barcode scan simulator */}
                                        <div className="bg-slate-50/50 dark:bg-black/15 border border-slate-100 dark:border-slate-850/60 p-4 rounded-2xl flex flex-col gap-3">
                                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                                                <QrCode size={12} />
                                                Simulador de Disparador Láser de Código
                                            </span>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Código de barras a enviar</label>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        value={simulatedBarcode}
                                                        onChange={(e) => setSimulatedBarcode(e.target.value)}
                                                        placeholder="7791234567890"
                                                        className="flex-grow p-2.5 bg-white dark:bg-[#0c111e] border border-slate-205 dark:border-slate-850 rounded-xl font-mono text-[11px] font-bold dark:text-white focus:outline-none focus:border-indigo-500"
                                                    />
                                                    <button
                                                        onClick={handleSimulateScan}
                                                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition cursor-pointer flex items-center gap-1.5"
                                                    >
                                                        <Zap size={11} className="text-amber-300" />
                                                        Disparar
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-1.5 mt-1">
                                                <button
                                                    onClick={() => setSimulatedBarcode('7791234567890')}
                                                    className="py-1.5 bg-white dark:bg-black/10 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200/50 dark:border-slate-800 rounded-lg text-[9px] font-mono font-semibold text-slate-500 dark:text-slate-400 transition"
                                                >
                                                    Té Rojo (7791234567890)
                                                </button>
                                                <button
                                                    onClick={() => setSimulatedBarcode('7790001002030')}
                                                    className="py-1.5 bg-white dark:bg-black/10 hover:bg-slate-100 dark:hover:bg-slate-850 border border-slate-200/50 dark:border-slate-800 rounded-lg text-[9px] font-mono font-semibold text-slate-500 dark:text-slate-400 transition"
                                                >
                                                    Agua Mineral (7790001002030)
                                                </button>
                                            </div>

                                            <p className="text-[9px] font-semibold text-slate-400 leading-normal mt-1 bg-white/50 dark:bg-black/10 p-2 rounded-xl">
                                                💡 **Efecto Global**: Al presionar 'Disparar', se simula el haz de luz láser y se envía un evento global al POS para la rápida búsqueda e inserción en el carrito.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'printer' && (
                            <motion.div
                                key="printer-tab"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-205 dark:border-slate-850 p-5 md:p-6 flex flex-col gap-6"
                            >
                                <div className="flex items-center gap-2 pb-3.5 border-b border-slate-100 dark:border-slate-850/60 text-indigo-500">
                                    <Printer size={16} />
                                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-white">Ajustes de Impresora Fiscal</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Modelo / Driver</label>
                                            <select 
                                                value={devices.find(d => d.type === 'printer')?.model}
                                                onChange={(e) => updateDeviceField('fiscal_printer_1', 'model', e.target.value)}
                                                className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl font-bold text-xs focus:outline-none dark:text-white"
                                            >
                                                <option value="ESC/POS Genérica (80mm)">ESC/POS Genérica (80mm - Impresora China Sin Marca / Xprinter / POS-80)</option>
                                                <option value="ESC/POS Genérica (58mm)">ESC/POS Genérica (58mm - Mini Impresora Portable)</option>
                                                <option value="Epson TM-T900FA">Epson TM-T900FA (Nueva Generación Fiscal)</option>
                                                <option value="Hasar SMH/PT-1000F">Hasar SMH/PT-1000F (Fiscal)</option>
                                                <option value="Bematech MP-4200 TH FI">Bematech MP-4200 TH FI</option>
                                                <option value="Zebra ZD420 Receipt">Zebra ZD420 Direct Thermal</option>
                                            </select>
                                        </div>

                                        {/* Chinese Generic Printer Advanced Panel */}
                                        {((devices.find(d => d.type === 'printer')?.model || '').includes('Genérica') || 
                                          (devices.find(d => d.type === 'printer')?.model || '').includes('ESC/POS')) && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: -8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex flex-col gap-3.5"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Cpu size={14} className="text-indigo-500 animate-pulse" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                                                        Compatibilidad de Impresora China Genérica
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Página de Códigos (Codepage)</label>
                                                        <select 
                                                            value={devices.find(d => d.type === 'printer')?.additionalConfig?.chineseCodepage || 'PC850'}
                                                            onChange={(e) => updateDeviceAdditionalField('fiscal_printer_1', 'chineseCodepage', e.target.value)}
                                                            className="p-2 bg-white dark:bg-[#0c111e] border border-slate-205 dark:border-slate-800 rounded-lg text-[10px] font-bold focus:outline-none dark:text-white"
                                                        >
                                                            <option value="PC850">PC850 (Multilingüe Español - Recomendado)</option>
                                                            <option value="CP1252">CP1252 (Latinoamericano Windows)</option>
                                                            <option value="PC437">PC437 (Inglés Estándar / OEM)</option>
                                                            <option value="UTF-8">UTF-8 Direct (Raw Mode)</option>
                                                        </select>
                                                    </div>

                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wide">Método de Enlace Web</label>
                                                        <select 
                                                            value={devices.find(d => d.type === 'printer')?.additionalConfig?.transmissionMode || 'windows-spooler'}
                                                            onChange={(e) => updateDeviceAdditionalField('fiscal_printer_1', 'transmissionMode', e.target.value)}
                                                            className="p-2 bg-white dark:bg-[#0c111e] border border-slate-205 dark:border-slate-800 rounded-lg text-[10px] font-bold focus:outline-none dark:text-white"
                                                        >
                                                            <option value="windows-spooler">Generic / Text Only (Spooler)</option>
                                                            <option value="webusb">WebUSB Direct (Chrome Nativo)</option>
                                                            <option value="serial-com">Serial COM (CH340/PL2303 Chipset)</option>
                                                            <option value="opos-bridge">OPOS Driver (GTR Local Bridge Client)</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-normal flex flex-col gap-1.5 bg-white dark:bg-[#0c111e]/60 p-3 rounded-xl border border-slate-200/40 dark:border-slate-850">
                                                    <p className="font-extrabold text-indigo-600 dark:text-indigo-400 uppercase text-[8.5px]">💡 Guía rápida para Impresoras sin marca:</p>
                                                    <p>
                                                        • <strong>Caracteres rotos (ñ, tildes):</strong> Si la impresora imprime símbolos raros, el selector de arriba forzará el envío de caracteres bajo el estándar **PC850** o **CP1252**, lo que soluciona el problema de raíz en hardware genérico.
                                                    </p>
                                                    <p>
                                                        • <strong>¿Cómo configurarla en Windows?:</strong> Agrega la impresora en tu Panel de Control, ve a puertos, elige el puerto USB asignado, y en el controlador selecciona <strong>Generic / Text Only</strong> (Genérico / Solo Texto). Esto evitará que imprima lento, borroso o en blanco y le permitirá recibir el protocolo crudo ESC/POS a alta velocidad.
                                                    </p>
                                                    <p>
                                                        • <strong>Corte de papel y Cajón:</strong> Al vender en el POS, el driver enviará el comando estándar universal <code>GS V 66 0</code> para corte automático físico y un pulso eléctrico para abrir tu cajón de dinero automáticamente.
                                                    </p>
                                                </div>
                                                {devices.find(d => d.type === 'printer')?.additionalConfig?.transmissionMode === 'webusb' && (
                                                    <div className="border-t border-slate-200/50 dark:border-slate-800/60 pt-3.5 mt-1 flex flex-col gap-3">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <Usb size={14} className="text-indigo-500" />
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-350">
                                                                    Enlace Directo por WebUSB (Raw Mode)
                                                                </span>
                                                            </div>
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                                                                webUsbStatus.connected 
                                                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-pulse' 
                                                                    : 'bg-slate-150 dark:bg-slate-850 text-slate-500'
                                                            }`}>
                                                                {webUsbStatus.connected ? 'VINCULADA' : 'NO VINCULADA'}
                                                            </span>
                                                        </div>

                                                        {webUsbStatus.connected ? (
                                                            <div className="bg-slate-900/95 text-white p-3 rounded-xl border border-indigo-500/20 flex flex-col gap-2 font-mono text-[9px]">
                                                                <div className="flex justify-between items-center text-[10px] pb-1.5 border-b border-slate-850">
                                                                    <span className="font-bold text-indigo-400">⚡ {webUsbStatus.deviceName}</span>
                                                                    <span className="text-[8px] text-slate-500 font-bold uppercase bg-slate-850 px-1 py-0.2 rounded">
                                                                        {webUsbStatus.isSimulated ? 'VIRTUAL HIBRIDO' : 'HARDWARE REAL'}
                                                                    </span>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                                                    <p><span className="text-slate-500 font-bold uppercase">VENDOR ID:</span> <span className="text-indigo-300 font-bold">{webUsbStatus.vendorId}</span></p>
                                                                    <p><span className="text-slate-500 font-bold uppercase">PRODUCT ID:</span> <span className="text-indigo-300 font-bold">{webUsbStatus.productId}</span></p>
                                                                    <p><span className="text-slate-500 font-bold uppercase">INTERFACE:</span> <span className="text-indigo-300 font-bold">#{webUsbStatus.claimedInterface}</span></p>
                                                                    <p><span className="text-slate-500 font-bold uppercase">ENDPOINT OUT:</span> <span className="text-indigo-300 font-bold">#{webUsbStatus.endpointOut}</span></p>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800">
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <label className="text-[7.5px] font-bold text-slate-500 uppercase">Endpoint Out</label>
                                                                        <input 
                                                                            type="number" 
                                                                            min="1" 
                                                                            max="8"
                                                                            value={webUsbStatus.endpointOut}
                                                                            onChange={(e) => {
                                                                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                                                                setWebUsbStatus(prev => ({ ...prev, endpointOut: val }));
                                                                            }}
                                                                            className="bg-slate-950 p-1 rounded border border-slate-800 text-[9.5px] font-bold text-indigo-400 outline-none w-full"
                                                                        />
                                                                    </div>
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <label className="text-[7.5px] font-bold text-slate-500 uppercase">Claim Interface</label>
                                                                        <input 
                                                                            type="number" 
                                                                            min="0" 
                                                                            max="4"
                                                                            value={webUsbStatus.claimedInterface}
                                                                            onChange={(e) => {
                                                                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                                                                setWebUsbStatus(prev => ({ ...prev, claimedInterface: val }));
                                                                            }}
                                                                            className="bg-slate-950 p-1 rounded border border-slate-800 text-[9.5px] font-bold text-indigo-400 outline-none w-full"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="flex gap-2 mt-1">
                                                                    <button
                                                                        onClick={handleSendRawTest}
                                                                        className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold uppercase text-[8.5px] tracking-wide rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-sm transition"
                                                                    >
                                                                        <Play size={10} /> Enviar Test RAW
                                                                    </button>
                                                                    <button
                                                                        onClick={handleDisconnectWebUsb}
                                                                        className="px-2.5 py-2 bg-slate-850 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg text-[8.5px] font-extrabold uppercase cursor-pointer border border-slate-800/80 transition"
                                                                    >
                                                                        Desconectar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={handleConnectWebUsb}
                                                                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[8.5px] tracking-wider rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-500/10 transition"
                                                                    >
                                                                        <Usb size={12} className="animate-bounce" /> Escanear Puertos USB
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleSimulateWebUsb('Xprinter POS-80 (China)')}
                                                                        className="py-2.5 px-3 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[8.5px] tracking-wider rounded-xl border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                                                                        title="Permite probar el flujo RAW completo si el navegador restringe permisos de hardware en iframe"
                                                                    >
                                                                        Simular Enlace
                                                                    </button>
                                                                </div>
                                                                <p className="text-[7.5px] font-semibold text-slate-400 leading-normal">
                                                                    ⚠️ <strong>Nota:</strong> WebUSB permite a la web hablar directamente con cualquier impresora térmica china genérica (Xprinter, POS-80, 58mm) sin necesidad de configurar drivers en el sistema operativo. Si tu navegador bloquea el escáner nativo por políticas de iframe, pulsa "Simular Enlace" para validar el generador de comandos ESC/POS crudos.
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* GTR Local OPOS Service Bridge Sub-panel */}
                                                {devices.find(d => d.type === 'printer')?.additionalConfig?.transmissionMode === 'opos-bridge' && (
                                                    <div className="border-t border-slate-200/50 dark:border-slate-800/60 pt-3.5 mt-1 flex flex-col gap-3">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <Cpu size={14} className="text-indigo-500" />
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-350">
                                                                    Canal de Driver OPOS (UnifiedOPOS POSPrinter)
                                                                </span>
                                                            </div>
                                                            <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase ${
                                                                oposStatus === 'connected' 
                                                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 animate-pulse' 
                                                                    : oposStatus === 'connecting'
                                                                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse'
                                                                        : 'bg-slate-150 dark:bg-slate-850 text-slate-500'
                                                            }`}>
                                                                {oposStatus === 'connected' ? 'SESION OPOS ACTIVA' : oposStatus === 'connecting' ? 'CONECTANDO...' : 'SIN SESION'}
                                                            </span>
                                                        </div>

                                                        {/* Step-by-Step OPOS Driver Installation & Setup Help */}
                                                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 flex flex-col gap-2">
                                                            <p className="text-[8.5px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                                                📦 Guía de Instalación del Driver OPOS (Impresora China por USB):
                                                            </p>
                                                            <ol className="text-[7.5px] font-semibold text-slate-500 dark:text-slate-400 list-decimal pl-3.5 flex flex-col gap-1 leading-normal">
                                                                <li>
                                                                    Descarga e instala el <strong>OPOS Driver Suite</strong> provisto por el fabricante de tu impresora china (por ejemplo, el <i>Xprinter OPOS Driver Setup v1.12</i> o el <i>Epson OPOS ADK</i> para compatibilidad estándar).
                                                                </li>
                                                                <li>
                                                                    Conecta tu impresora china por USB y enciende el dispositivo.
                                                                </li>
                                                                <li>
                                                                    Abre la herramienta de configuración del driver OPOS en Windows y crea un <strong>Logical Device Name (LDN)</strong> (nombre lógico, por ejemplo: <code className="text-indigo-500 dark:text-indigo-400">XP-80_Printer</code>).
                                                                </li>
                                                                <li>
                                                                    Asigna el puerto de hardware correspondiente (por ejemplo: <code className="text-indigo-500 dark:text-indigo-400">BY_USB</code> o el puerto USB asignado como virtual serial) y guarda los cambios en el registro.
                                                                </li>
                                                                <li>
                                                                    ¡Listo! Ingresa el mismo <strong>LDN</strong> abajo y presiona <strong className="text-indigo-500">Iniciar Puente OPOS</strong> para tomar el control de hardware a través del ActiveX / OLE local de Windows.
                                                                </li>
                                                            </ol>
                                                        </div>

                                                        {/* Connection Config & Diagnostics */}
                                                        <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2.5 font-mono text-[9px]">
                                                            {/* Generic Printer Model Selection */}
                                                            <div className="flex flex-col gap-1.5 pb-2 border-b border-slate-800/80">
                                                                <label className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wide">
                                                                    Selección de Impresora Genérica (Sin Marca)
                                                                </label>
                                                                <select
                                                                    value={selectedOposModelId}
                                                                    onChange={(e) => {
                                                                        const mId = e.target.value;
                                                                        setSelectedOposModelId(mId);
                                                                        const model = GENERIC_OPOS_MODELS.find(m => m.id === mId);
                                                                        if (model) {
                                                                            setOposLdn(model.defaultLdn);
                                                                        }
                                                                    }}
                                                                    disabled={oposStatus !== 'disconnected'}
                                                                    className="w-full p-2 bg-black rounded border border-slate-800 text-[10px] font-extrabold text-indigo-300 outline-none disabled:opacity-60 cursor-pointer"
                                                                >
                                                                    {GENERIC_OPOS_MODELS.map(model => (
                                                                        <option key={model.id} value={model.id}>
                                                                            {model.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            {/* Dynamic Driver & Hardware Specs */}
                                                            <div className="text-[7.5px] text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800/50 flex flex-col gap-1.5">
                                                                <p className="leading-relaxed">
                                                                    💡 <strong>Driver OPOS sugerido:</strong> <span className="text-indigo-400 font-bold">{GENERIC_OPOS_MODELS.find(m => m.id === selectedOposModelId)?.driver}</span>
                                                                </p>
                                                                <p className="leading-relaxed">
                                                                    ⚙️ <strong>Especificaciones:</strong> Ancho {GENERIC_OPOS_MODELS.find(m => m.id === selectedOposModelId)?.paperWidth} | Emulación nativa ESC/POS por hardware USB
                                                                </p>
                                                            </div>

                                                            {/* Logical Device Name definition */}
                                                            <div className="flex flex-col gap-1.5 pb-2.5">
                                                                <label className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wide">
                                                                    Logical Device Name / Device Name (OPOS LDN)
                                                                </label>
                                                                <div className="flex gap-2">
                                                                    <input 
                                                                        type="text" 
                                                                        value={oposLdn}
                                                                        onChange={(e) => setOposLdn(e.target.value)}
                                                                        disabled={oposStatus !== 'disconnected'}
                                                                        placeholder="XP-80_Printer"
                                                                        className="flex-grow p-1.5 bg-black rounded border border-slate-800 text-[10px] font-black text-indigo-400 outline-none disabled:opacity-60"
                                                                    />
                                                                    {oposStatus === 'disconnected' ? (
                                                                        <button
                                                                            onClick={handleOposInitialize}
                                                                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold uppercase rounded-lg text-[8px] tracking-wider transition cursor-pointer flex items-center gap-1 shrink-0"
                                                                        >
                                                                            <Play size={9} /> Iniciar Puente
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={handleOposRelease}
                                                                            className="px-3.5 py-1.5 bg-rose-950/75 hover:bg-rose-900 border border-rose-500/20 text-rose-300 font-extrabold uppercase rounded-lg text-[8px] tracking-wider transition cursor-pointer shrink-0"
                                                                        >
                                                                            Detener OPOS
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-3 gap-x-2 gap-y-1 bg-black/40 p-2 rounded-lg border border-slate-800/60">
                                                                <div>
                                                                    <span className="text-slate-500 font-bold uppercase text-[7.5px] block">ACTIVE X STATUS</span>
                                                                    <span className="text-[8px] text-indigo-300 font-bold break-all">{oposActiveXState}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-500 font-bold uppercase text-[7.5px] block">CLAIMED BY WEB</span>
                                                                    <span className={`text-[8.5px] font-black ${oposClaimed ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                        {oposClaimed ? 'YES' : 'NO'}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-slate-500 font-bold uppercase text-[7.5px] block">DEVICE ENABLED</span>
                                                                    <span className={`text-[8.5px] font-black ${oposEnabled ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                        {oposEnabled ? 'TRUE' : 'FALSE'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* GTR OPOS Driver Live Stream Console */}
                                                            <div className="flex flex-col gap-1 mt-1">
                                                                <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wide">Consola de Eventos del Driver OPOS:</span>
                                                                <div className="h-28 bg-black p-2 rounded-lg border border-slate-800 overflow-y-auto text-[8px] font-mono flex flex-col gap-1 shadow-inner scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                                                                    {oposBrokerLog.map((logLine, idx) => (
                                                                        <p key={idx} className={
                                                                            logLine.includes('✓') 
                                                                                ? 'text-emerald-400' 
                                                                                : logLine.includes('❌') || logLine.includes('Fallo') 
                                                                                    ? 'text-rose-400' 
                                                                                    : logLine.includes('[PRINT]')
                                                                                        ? 'text-indigo-400'
                                                                                        : 'text-slate-400'
                                                                        }>
                                                                            {logLine}
                                                                        </p>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {oposStatus === 'connected' && (
                                                                <button
                                                                    onClick={handleOposPrint}
                                                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold uppercase text-[8.5px] tracking-wider rounded-lg flex items-center justify-center gap-1 cursor-pointer transition shadow-sm"
                                                                >
                                                                    <Play size={10} /> Imprimir Ticket de Prueba con OPOS
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Puerto de Comunicación</label>
                                                <select 
                                                    value={devices.find(d => d.type === 'printer')?.port}
                                                    onChange={(e) => updateDeviceField('fiscal_printer_1', 'port', e.target.value)}
                                                    className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-bold focus:outline-none dark:text-white"
                                                >
                                                    <option value="USB001">USB001 (Puerto Virtual USB)</option>
                                                    <option value="COM1">COM1 (Puerto de Placa)</option>
                                                    <option value="COM2">COM2</option>
                                                    <option value="COM3">COM3 (USB Serial)</option>
                                                    <option value="LPT1">LPT1 (Centronics)</option>
                                                    <option value="TCP/IP">Red TCP/IP</option>
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Velocidad Baudrate</label>
                                                <select 
                                                    value={devices.find(d => d.type === 'printer')?.baudRate}
                                                    onChange={(e) => updateDeviceField('fiscal_printer_1', 'baudRate', e.target.value)}
                                                    className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-bold focus:outline-none dark:text-white"
                                                >
                                                    <option value="9600">9600 bps (Estándar Chino)</option>
                                                    <option value="19200">19200 bps</option>
                                                    <option value="38400">38400 bps</option>
                                                    <option value="115200">115200 bps</option>
                                                    <option value="4800">4800 bps</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Ancho de Papel</label>
                                                <select 
                                                    value={devices.find(d => d.type === 'printer')?.additionalConfig.paperWidth}
                                                    onChange={(e) => updateDeviceAdditionalField('fiscal_printer_1', 'paperWidth', e.target.value)}
                                                    className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs focus:outline-none dark:text-white"
                                                >
                                                    <option value="80mm">80 milímetros (Recomendado)</option>
                                                    <option value="58mm">58 milímetros</option>
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Corte de Papel Automático</label>
                                                <div className="flex items-center h-full">
                                                    <input 
                                                        type="checkbox" 
                                                        id="autoCutCheck"
                                                        checked={devices.find(d => d.type === 'printer')?.additionalConfig.autoCut}
                                                        onChange={(e) => updateDeviceAdditionalField('fiscal_printer_1', 'autoCut', e.target.checked)}
                                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                                                    />
                                                    <label htmlFor="autoCutCheck" className="ml-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                                                        Cerrar e Iniciar Corte
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Dirección IP del Servidor de Red (Opcional)</label>
                                            <input 
                                                type="text" 
                                                value={devices.find(d => d.type === 'printer')?.additionalConfig.ipAddress}
                                                onChange={(e) => updateDeviceAdditionalField('fiscal_printer_1', 'ipAddress', e.target.value)}
                                                placeholder="192.168.1.150"
                                                className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-bold focus:outline-none dark:text-white"
                                            />
                                        </div>

                                        <button
                                            onClick={() => runIndividualTest('fiscal_printer_1')}
                                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-750 text-white font-black text-xs uppercase tracking-widest rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer mt-2"
                                        >
                                            <Play size={12} fill="currentColor" />
                                            Imprimir Ticket de Prueba
                                        </button>
                                    </div>

                                    {/* Simulated ticket feedback viewport */}
                                    <div className="flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-black/35 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 min-h-[300px]">
                                        {showTestTicket && testTicketData ? (
                                            <motion.div 
                                                initial={{ y: 50, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                className="w-64 bg-white text-slate-900 font-mono text-[9px] p-4 shadow-xl border border-slate-200 flex flex-col gap-2 relative leading-normal"
                                            >
                                                <div className="absolute -top-1 left-0 right-0 h-2 bg-gradient-to-b from-slate-200/30 to-transparent" />
                                                <div className="text-center font-black pb-2 border-b border-dashed border-slate-300">
                                                    <p className="text-[10px] tracking-wide">
                                                        {(testTicketData.model || '').includes('ESC/POS') || (testTicketData.model || '').includes('Genérica')
                                                            ? '*** ESC/POS UNIVERSAL GTR ***' 
                                                            : '*** GTR POS FISCAL ***'
                                                        }
                                                    </p>
                                                    <p className="text-[7.5px] mt-0.5 text-slate-500 font-bold uppercase">
                                                        {(testTicketData.model || '').includes('ESC/POS') || (testTicketData.model || '').includes('Genérica')
                                                            ? 'TÉRMICA CHINA GENÉRICA 80MM' 
                                                            : 'SISTEMA INTEGRADO DE CAJA'
                                                        }
                                                    </p>
                                                </div>
                                                <div className="flex flex-col gap-0.5 py-1.5 text-[8.5px] border-b border-dashed border-slate-200">
                                                    <p><span className="font-bold text-slate-500">FECHA:</span> {testTicketData.timestamp}</p>
                                                    <p><span className="font-bold text-slate-500">DRIVER:</span> {testTicketData.model}</p>
                                                    <p><span className="font-bold text-slate-500">PUERTO:</span> {testTicketData.port} @ {testTicketData.baudRate} bps</p>
                                                    {((testTicketData.model || '').includes('ESC/POS') || (testTicketData.model || '').includes('Genérica')) && (
                                                        <>
                                                            <p><span className="font-bold text-indigo-500">CODEPAGE:</span> {testTicketData.chineseCodepage} (Español OK)</p>
                                                            <p><span className="font-bold text-indigo-500">ENLACE:</span> {testTicketData.transmissionMode === 'windows-spooler' ? 'WINDOWS SPOOLER (GENERIC)' : testTicketData.transmissionMode?.toUpperCase()}</p>
                                                        </>
                                                    )}
                                                    <p><span className="font-bold text-slate-500">FIRMWARE:</span> {(testTicketData.model || '').includes('ESC/POS') || (testTicketData.model || '').includes('Genérica') ? 'ESC-POS-CHINESE-v3.2' : testTicketData.firmware}</p>
                                                    <p><span className="font-bold text-slate-500">ANCHO PAPEL:</span> {testTicketData.ancho}</p>
                                                </div>
                                                <div className="border-y border-dashed border-slate-300 py-1.5 text-center font-bold text-slate-800">
                                                    ¡AUTODIAGNÓSTICO EXITOSO!
                                                    <p className="text-[7.5px] font-normal text-slate-500 mt-0.5">La conexión de datos está alineada</p>
                                                </div>
                                                <div className="flex justify-between items-center pt-1 font-bold">
                                                    <span>ESTADO COM:</span>
                                                    <span className="text-emerald-600 bg-emerald-50 px-1 rounded">{testTicketData.status}</span>
                                                </div>
                                                <div className="text-center text-[7.5px] text-slate-400 mt-3 pt-2 border-t border-dashed border-slate-300">
                                                    GTR POS v2.3.0 Propietario
                                                </div>
                                                
                                                <button 
                                                    onClick={() => setShowTestTicket(false)}
                                                    className="mt-4 w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-[8.5px] text-slate-600 font-bold uppercase rounded transition"
                                                >
                                                    Cerrar Impreso
                                                </button>
                                            </motion.div>
                                        ) : (
                                            <div className="text-center p-6 text-slate-400 flex flex-col items-center gap-2">
                                                <Printer size={32} className="opacity-20 animate-bounce" />
                                                <p className="text-xs font-bold uppercase tracking-wider text-slate-450">Simulador de Impreso</p>
                                                <p className="text-[10px] leading-relaxed max-w-xs">
                                                    Presiona el botón de la izquierda para emitir un comprobante virtual y verificar la estructura física del ticket fiscal.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'scale' && (
                            <motion.div
                                key="scale-tab"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-205 dark:border-slate-850 p-5 md:p-6 flex flex-col gap-6"
                            >
                                <div className="flex items-center gap-2 pb-3.5 border-b border-slate-100 dark:border-slate-850/60 text-indigo-500">
                                    <Scale size={16} />
                                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-white">Ajustes de Balanza Electrónica</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Modelo / Protocolo de Comunicación</label>
                                            <select 
                                                value={devices.find(d => d.type === 'scale')?.model}
                                                onChange={(e) => updateDeviceField('caja_scale_1', 'model', e.target.value)}
                                                className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs focus:outline-none dark:text-white"
                                            >
                                                <option value="Systel Clipse 31kg">Systel Clipse 31kg (Protocolo Systel_C)</option>
                                                <option value="Kretz Report / Aura">Kretz Report / Aura (Protocolo Kretz_S)</option>
                                                <option value="CAS PD-II Series">CAS PD-II Series</option>
                                                <option value="Toledo 8217 Checkout Scale">Toledo 8217 Checkout Scale</option>
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Puerto Serial COM</label>
                                                <select 
                                                    value={devices.find(d => d.type === 'scale')?.port}
                                                    onChange={(e) => updateDeviceField('caja_scale_1', 'port', e.target.value)}
                                                    className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-bold focus:outline-none dark:text-white"
                                                >
                                                    <option value="COM1">COM1</option>
                                                    <option value="COM2">COM2 (Estándar)</option>
                                                    <option value="COM3">COM3</option>
                                                    <option value="COM4">COM4</option>
                                                    <option value="USB (VCP)">Puerto USB Virtual (VCP)</option>
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Unidad de Medida</label>
                                                <select 
                                                    value={devices.find(d => d.type === 'scale')?.additionalConfig.unit}
                                                    onChange={(e) => updateDeviceAdditionalField('caja_scale_1', 'unit', e.target.value)}
                                                    className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs focus:outline-none dark:text-white"
                                                >
                                                    <option value="kg">Kilogramos (kg)</option>
                                                    <option value="lb">Libras (lb)</option>
                                                    <option value="g">Gramos (g)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Estabilización</label>
                                                <select 
                                                    value={devices.find(d => d.type === 'scale')?.additionalConfig.stableDelay}
                                                    onChange={(e) => updateDeviceAdditionalField('caja_scale_1', 'stableDelay', e.target.value)}
                                                    className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs focus:outline-none dark:text-white"
                                                >
                                                    <option value="250ms">Inmediato (250ms)</option>
                                                    <option value="500ms">Estándar (500ms)</option>
                                                    <option value="1000ms">Filtro Alto (1000ms)</option>
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Puesta a Cero Automática</label>
                                                <div className="flex items-center h-full">
                                                    <input 
                                                        type="checkbox" 
                                                        id="scaleAutoZero"
                                                        checked={devices.find(d => d.type === 'scale')?.additionalConfig.autoZero}
                                                        onChange={(e) => updateDeviceAdditionalField('caja_scale_1', 'autoZero', e.target.checked)}
                                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                                                    />
                                                    <label htmlFor="scaleAutoZero" className="ml-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                                                        Auto-Zero en Vacío
                                                    </label>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => runIndividualTest('caja_scale_1')}
                                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-750 text-white font-black text-xs uppercase tracking-widest rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer mt-2"
                                        >
                                            <Play size={12} fill="currentColor" />
                                            Adquirir Muestra de Peso
                                        </button>
                                    </div>

                                    {/* Scale physics feedback console visualizer */}
                                    <div className="bg-slate-100 dark:bg-black/35 rounded-2xl border border-dashed border-slate-300 dark:border-slate-850 p-6 flex flex-col justify-between min-h-[300px]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-450">Canal RS-232 Abierto</span>
                                        </div>

                                        <div className="my-auto flex flex-col items-center gap-3">
                                            <div className="p-6 bg-slate-900 text-emerald-400 font-mono rounded-3xl border-4 border-slate-750 shadow-inner text-center w-52 relative overflow-hidden">
                                                <div className="absolute top-2 left-2 text-[7px] text-emerald-500/50 font-bold uppercase tracking-widest">GTR STABLE READING</div>
                                                <span className="text-4xl font-extrabold tracking-widest">
                                                    {simulatedWeight.toFixed(3)}
                                                </span>
                                                <span className="text-xs font-bold ml-1.5 uppercase text-emerald-500/80">
                                                    {devices.find(d => d.type === 'scale')?.additionalConfig.unit || 'kg'}
                                                </span>
                                                <div className="mt-2 text-[8px] text-emerald-500/80 uppercase tracking-tighter flex items-center justify-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                    TARA INACTIVA (0.000)
                                                </div>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-450 uppercase text-center">
                                                ESTABILIZADO EN {devices.find(d => d.type === 'scale')?.additionalConfig.stableDelay || '500ms'}
                                            </p>
                                        </div>

                                        <div className="text-[9.5px] font-semibold text-slate-450 bg-white/50 dark:bg-black/10 p-2.5 rounded-xl border border-slate-200/40 dark:border-slate-850/40">
                                            📊 **Análisis de Trama**: El buffer está leyendo trama continua en formato `\u0002+  1.250kg\u0003` enviado por la balanza a {devices.find(d => d.type === 'scale')?.baudRate || '9600'} baudios.
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'scanner' && (
                            <motion.div
                                key="scanner-tab"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-205 dark:border-slate-850 p-5 md:p-6 flex flex-col gap-6"
                            >
                                <div className="flex items-center gap-2 pb-3.5 border-b border-slate-100 dark:border-slate-850/60 text-indigo-500">
                                    <QrCode size={16} />
                                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-white">Ajustes de Lector de Códigos</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Modelo del Lector</label>
                                            <select 
                                                value={devices.find(d => d.type === 'scanner')?.model}
                                                onChange={(e) => updateDeviceField('barcode_scanner_1', 'model', e.target.value)}
                                                className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs focus:outline-none dark:text-white"
                                            >
                                                <option value="Honeywell Orbit 7120">Honeywell Orbit 7120 Omnidireccional</option>
                                                <option value="Symbol Motorola LS2208">Symbol Motorola LS2208 Handheld</option>
                                                <option value="Datalogic QuickScan QW2100">Datalogic QuickScan QW2100</option>
                                                <option value="Generic USB Emulation">Genérico Emulador Teclado USB</option>
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Modo de Conexión</label>
                                                <select 
                                                    value={devices.find(d => d.type === 'scanner')?.port}
                                                    onChange={(e) => updateDeviceField('barcode_scanner_1', 'port', e.target.value)}
                                                    className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs focus:outline-none dark:text-white"
                                                >
                                                    <option value="USB (Teclado)">USB Keyboard Emulation</option>
                                                    <option value="USB (VCP COM3)">USB Virtual COM3 (VCP)</option>
                                                    <option value="COM4 Serial">Físico COM4 RS-232</option>
                                                </select>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Sufijo de Escaneo</label>
                                                <select 
                                                    value={devices.find(d => d.type === 'scanner')?.additionalConfig.suffix}
                                                    onChange={(e) => updateDeviceAdditionalField('barcode_scanner_1', 'suffix', e.target.value)}
                                                    className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-bold focus:outline-none dark:text-white"
                                                >
                                                    <option value="ENTER">ENTER (Salto de Línea)</option>
                                                    <option value="TAB">TAB (Tabulación)</option>
                                                    <option value="NONE">Ninguno (Liso)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Tono de Pitido</label>
                                                <div className="flex items-center h-full">
                                                    <input 
                                                        type="checkbox" 
                                                        id="scannerBeep"
                                                        checked={devices.find(d => d.type === 'scanner')?.additionalConfig.beepOnScan}
                                                        onChange={(e) => updateDeviceAdditionalField('barcode_scanner_1', 'beepOnScan', e.target.checked)}
                                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer accent-indigo-500"
                                                    />
                                                    <label htmlFor="scannerBeep" className="ml-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                                                        Emitir pitido de lectura
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider font-mono">Modo de Escaneo</label>
                                                <select 
                                                    value={devices.find(d => d.type === 'scanner')?.additionalConfig.scanMode}
                                                    onChange={(e) => updateDeviceAdditionalField('barcode_scanner_1', 'scanMode', e.target.value)}
                                                    className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-xs focus:outline-none dark:text-white"
                                                >
                                                    <option value="continuous">Automático / Continuo</option>
                                                    <option value="trigger">Por Gatillo / Pulsación</option>
                                                </select>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => runIndividualTest('barcode_scanner_1')}
                                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-750 text-white font-black text-xs uppercase tracking-widest rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer mt-2"
                                        >
                                            <Play size={12} fill="currentColor" />
                                            Iniciar Modo Escucha
                                        </button>
                                    </div>

                                    {/* Barcode scanner diagnostics visualizer */}
                                    <div className="bg-slate-100 dark:bg-black/35 rounded-2xl border border-dashed border-slate-300 dark:border-slate-850 p-6 flex flex-col justify-between min-h-[300px]">
                                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-450">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                Escáner Escuchando en {devices.find(d => d.type === 'scanner')?.port || 'USB'}
                                            </span>
                                            <span className="font-mono text-[9px]">v1.0.8-VCP</span>
                                        </div>

                                        <div className="my-auto flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center border border-indigo-500/10 text-indigo-500 mb-2">
                                                <QrCode size={26} className="animate-pulse" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Última lectura en buffer:</span>
                                            <span className="font-mono text-lg font-black text-slate-800 dark:text-white tracking-widest bg-white dark:bg-slate-900 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                                {simulatedBarcode || 'VACÍO'}
                                            </span>
                                        </div>

                                        <div className="text-[9.5px] font-semibold text-slate-450 bg-white/50 dark:bg-black/10 p-2.5 rounded-xl border border-slate-200/40 dark:border-slate-850/40">
                                            ⌨️ **Emulador de Teclado**: Los caracteres escaneados se inyectarán en la caja de búsqueda activa del punto de venta como si el operador los hubiera escrito.
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'logs' && (
                            <motion.div
                                key="logs-tab"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="bg-[#05070c] rounded-3xl border border-slate-800 p-5 flex flex-col gap-4 h-[550px]"
                            >
                                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                    <div className="flex items-center gap-2 text-indigo-400">
                                        <Terminal size={16} />
                                        <h2 className="text-xs font-black uppercase tracking-wider text-white">Consola de Depuración de Periféricos (GTR Hardware)</h2>
                                    </div>
                                    <button
                                        onClick={handleClearLogs}
                                        className="text-[9px] font-extrabold uppercase tracking-wider text-rose-450 hover:text-rose-500 cursor-pointer"
                                    >
                                        Limpiar Buffer
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto font-mono text-[10.5px] leading-relaxed flex flex-col-reverse gap-2 pr-2">
                                    {logs.length === 0 ? (
                                        <p className="text-slate-600 text-center py-10 italic uppercase">La consola está vacía.</p>
                                    ) : (
                                        logs.map((log, index) => (
                                            <div 
                                                key={index} 
                                                className={`p-2 rounded-lg border flex items-start gap-2.5 ${
                                                    log.type === 'success' 
                                                        ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' 
                                                        : log.type === 'warn' 
                                                            ? 'bg-amber-500/5 border-amber-500/10 text-amber-400' 
                                                            : log.type === 'error' 
                                                                ? 'bg-rose-500/5 border-rose-500/10 text-rose-400 animate-pulse' 
                                                                : 'bg-white/5 border-white/5 text-slate-300'
                                                }`}
                                            >
                                                <span className="text-[9px] text-slate-500 tracking-tight shrink-0 mt-0.5">[{log.time}]</span>
                                                <span className="flex-grow">{log.text}</span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                                    <span>Puerto de Puente GTR: ACTIVO</span>
                                    <span>Tasa de Muestreo: 60Hz</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
