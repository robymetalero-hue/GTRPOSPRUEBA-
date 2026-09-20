import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, AlertCircle, ShoppingBag, Volume2, VolumeX, Check } from 'lucide-react';
import { Product } from '../types';

interface BarcodeScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    addToCart: (product: Product, quantity: number) => void;
    onSuccessScan?: (product: Product) => void;
}

export default function BarcodeScannerModal({ isOpen, onClose, products, addToCart, onSuccessScan }: BarcodeScannerModalProps) {
    const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>("");
    const [scannerError, setScannerError] = useState<string | null>(null);
    const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
    const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
    const [scanHistory, setScanHistory] = useState<Array<{ sku: string; time: string; product?: Product; found: boolean }>>([]);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [manualSku, setManualSku] = useState("");

    const handleManualSubmit = () => {
        const cleaned = manualSku.trim();
        if (cleaned) {
            handleScanSuccess(cleaned);
            setManualSku("");
        }
    };
    
    const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
    const lastScanTimeRef = useRef<number>(0);
    const SCAN_COOLDOWN = 1500; // ms to wait before scanner registers the exact same code again

    const elementId = "pos-barcode-scanner-viewfinder";

    // Play visual & audiable feedback
    const playScanBeep = (isSuccess: boolean) => {
        if (!soundEnabled) return;
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            if (isSuccess) {
                // Happy double high beep
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
                gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.08);

                setTimeout(() => {
                    const osc2 = audioCtx.createOscillator();
                    const gain2 = audioCtx.createGain();
                    osc2.connect(gain2);
                    gain2.connect(audioCtx.destination);
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(1174.66, audioCtx.currentTime); // D6
                    gain2.gain.setValueAtTime(0.05, audioCtx.currentTime);
                    osc2.start();
                    osc2.stop(audioCtx.currentTime + 0.1);
                }, 100);
            } else {
                // Sad error buzz
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(120, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.3);
            }
        } catch (e) {
            console.error("Audio feedback synthesis rejected/blocked by browser gesture:", e);
        }
    };

    const handleScanSuccess = (decodedText: string) => {
        const now = Date.now();
        const cleanSku = decodedText.trim();

        // Avoid continuous multiple reads within cooldown threshold
        if (cleanSku === lastScannedCode && now - lastScanTimeRef.current < SCAN_COOLDOWN) {
            return;
        }

        lastScanTimeRef.current = now;
        setLastScannedCode(cleanSku);

        // Find matches in inventory (SKUs/IDs can be lowercase/uppercase mix or # prefixed)
        const rawClean = cleanSku.replace(/^#/, '').toLowerCase();
        const cleanCode = cleanSku.toLowerCase();
        const normCode = cleanCode.replace(/^0+/, '');

        const match = products.find(p => {
            if (String(p.id) === rawClean || String(p.id) === normCode) return true;
            if (!p.sku) return false;
            const cleanSkuStr = p.sku.trim().toLowerCase();
            const normSku = cleanSkuStr.replace(/^0+/, '');
            return cleanSkuStr === cleanCode || normSku === normCode || normSku === cleanCode || cleanSkuStr === normCode || cleanSkuStr === rawClean;
        });

        const historyItem = {
            sku: cleanSku,
            time: new Date().toLocaleTimeString(),
            product: match,
            found: !!match
        };

        setScanHistory(prev => [historyItem, ...prev].slice(0, 5));

        if (match) {
            addToCart(match, 1);
            setScannedProduct(match);
            playScanBeep(true);
            
            // Clear scanned product highlight after 1.5s
            setTimeout(() => {
                setScannedProduct(null);
            }, 1500);

            if (onSuccessScan) {
                onSuccessScan(match);
            }
        } else {
            setScannedProduct(null);
            playScanBeep(false);
        }
    };

    // Initialize list of devices
    const getDevices = async () => {
        try {
            // Attempt to fetch via html5-qrcode
            const devices = await Html5Qrcode.getCameras();
            const formatted = devices.map(d => ({ id: d.id, label: d.label }));
            setCameras(formatted);
            if (formatted.length > 0 && !selectedCameraId) {
                const backCamera = formatted.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('entera') || d.label.toLowerCase().includes('environment'));
                setSelectedCameraId(backCamera ? backCamera.id : formatted[0].id);
            }
        } catch (err: any) {
            console.warn("Error listing cameras via Html5Qrcode, falling back to navigator:", err);
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                const formatted = videoDevices.map(d => ({ id: d.deviceId, label: d.label }));
                setCameras(formatted);
                if (formatted.length > 0 && !selectedCameraId) {
                    const backCamera = formatted.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('entera') || d.label.toLowerCase().includes('environment'));
                    setSelectedCameraId(backCamera ? backCamera.id : formatted[0].id);
                }
            } catch (retryErr: any) {
                console.warn("All camera list approaches failed:", retryErr);
                setScannerError("Permisos de cámara bloqueados o dispositivo no disponible. Si estás usando la vista previa de AI Studio, haz clic en el botón de abrir en nueva pestaña en la esquina superior derecha para habilitar permisos de cámara o escribe/selecciona el artículo en la sección manual de abajo.");
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            getDevices();
        }
        return () => {
            stopScanner();
        };
    }, [isOpen]);

    // Start scanner effect when selected camera or modal state changes
    useEffect(() => {
        if (isOpen && selectedCameraId) {
            startScannerWithId(selectedCameraId);
        }
        return () => {
            stopScanner();
        };
    }, [isOpen, selectedCameraId]);

    const startScannerWithId = async (deviceId: string) => {
        setScannerError(null);
        await stopScanner();

        try {
            // Wait for element to render
            await new Promise(resolve => setTimeout(resolve, 200));

            // Set up optimal configurations: enable BarcodeDetector API if supported on devices, and specify selective 1D barcode formats + QR Code
            const html5Qrcode = new Html5Qrcode(elementId, {
                verbose: false,
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.QR_CODE
                ],
                useBarCodeDetectorIfSupported: true
            });
            html5QrcodeRef.current = html5Qrcode;

            const config = {
                fps: 30, // Higher fps for instantaneous scanning
                qrbox: (width: number, height: number) => {
                    const minDim = Math.min(width, height);
                    return {
                        width: Math.floor(minDim * 0.95), // Wide horizontals optimized for retail 1D barcodes
                        height: Math.floor(minDim * 0.38)
                    };
                },
                aspectRatio: 1.333333,
                videoConstraints: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    width: { ideal: 1280, max: 1920 }, // 720p is highly optimal for fast decoding without frame decay
                    height: { ideal: 720, max: 1080 },
                    focusMode: { ideal: "continuous" },
                    advanced: [
                        { focusMode: { exact: "continuous" } } as any,
                        { focusMode: "continuous" } as any
                    ]
                } as any
            };

            await html5Qrcode.start(
                deviceId,
                config,
                (decodedText) => {
                    handleScanSuccess(decodedText);
                },
                () => {
                    // Verbose frame failures can be ignored
                }
            );

            // Hook underneath WebRTC video element to force instant autofocus and macro zoom
            setTimeout(() => {
                try {
                    const videoElem = document.querySelector(`#${elementId} video`) as HTMLVideoElement;
                    if (videoElem) {
                        videoElem.setAttribute("autoplay", "true");
                        videoElem.setAttribute("playsinline", "true");
                        const stream = videoElem.srcObject as MediaStream;
                        const track = stream?.getVideoTracks()[0];
                        if (track) {
                            const capabilities = track.getCapabilities() as any;
                            const constraints = {} as any;

                            if (capabilities.focusMode && capabilities.focusMode.includes("continuous")) {
                                constraints.focusMode = "continuous";
                            }
                            if (capabilities.zoom) {
                                // Subtle hardware zoom helps 1D scanners register codes from optimal distances
                                constraints.zoom = Math.min(capabilities.zoom.max || 1, 1.25);
                            }

                            if (Object.keys(constraints).length > 0) {
                                track.applyConstraints(constraints)
                                    .then(() => console.log("Success applying real-time continuous focus & zoom:", constraints))
                                    .catch((trackErr) => console.warn("Failed setting advanced video constraints:", trackErr));
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Autofocus optimization track hook skipped:", e);
                }
            }, 500);
        } catch (err: any) {
            console.warn("Scanner startup error (possibly restricted or focus lost):", err);
            // Retry with general constraints if accurate deviceId failed
            try {
                if (html5QrcodeRef.current) {
                    await html5QrcodeRef.current.start(
                        { facingMode: "environment" },
                        { 
                            fps: 24, 
                            qrbox: { width: 280, height: 140 },
                            videoConstraints: {
                                facingMode: "environment",
                                width: { min: 640, ideal: 1280, max: 1920 },
                                height: { min: 480, ideal: 720, max: 1080 },
                                focusMode: { ideal: "continuous" },
                                advanced: [
                                    { focusMode: { exact: "continuous" } } as any,
                                    { focusMode: "continuous" } as any
                                ]
                            } as any
                        },
                        (txt) => handleScanSuccess(txt),
                        () => {}
                    );
                }
            } catch (retryErr: any) {
                setScannerError("No se pudo iniciar la transmisión de video de tu cámara.");
            }
        }
    };

    const stopScanner = async () => {
        if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
            try {
                await html5QrcodeRef.current.stop();
                html5QrcodeRef.current.clear();
            } catch (err) {
                console.warn("Scanner stopped/cleared during setup:", err);
            }
            html5QrcodeRef.current = null;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-4xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-200">
                
                {/* Visual Viewfinder side */}
                <div className="flex-1 bg-black relative flex flex-col justify-between min-h-[350px] md:min-h-[480px]">
                    <div className="absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <Camera className="text-blue-500 animate-pulse" size={18} />
                            <span className="font-extrabold text-xs tracking-wider uppercase">Cámara Barcode Activa</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setSoundEnabled(!soundEnabled)}
                                className="p-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-xl transition-all"
                                title={soundEnabled ? "Silenciar" : "Activar bip"}
                            >
                                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} className="text-red-400" />}
                            </button>
                            {cameras.length > 1 && (
                                <select 
                                    className="bg-white/10 text-[10px] uppercase font-bold tracking-wider py-1 px-2.5 rounded-lg border-none text-white focus:outline-none"
                                    value={selectedCameraId}
                                    onChange={(e) => setSelectedCameraId(e.target.value)}
                                >
                                    {cameras.map((c, i) => (
                                        <option key={c.id} value={c.id} className="text-black bg-white">
                                            {c.label || `Lente ${i + 1}`}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Scanner container rendering screen */}
                    <div className="flex-1 flex items-center justify-center relative bg-neutral-950 overflow-hidden">
                        <div id={elementId} className="w-full h-full max-h-[350px] md:max-h-[440px] [&_video]:object-cover" />
                        
                        {/* Custom visual horizontal laser overlay line */}
                        {!scannerError && (
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
                                {/* Centered precise box target cutout with infinite dark shadow overlay around it */}
                                <div className="w-[85%] max-w-[340px] h-[160px] rounded-3xl relative flex justify-center items-center shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] border-2 border-dashed border-blue-500/40">
                                    {/* Corner tick architectural design guidelines */}
                                    <span className="absolute -left-1 -top-1 w-6 h-6 border-l-4 border-t-4 border-blue-500 rounded-tl-xl"></span>
                                    <span className="absolute -right-1 -top-1 w-6 h-6 border-r-4 border-t-4 border-blue-500 rounded-tr-xl"></span>
                                    <span className="absolute -left-1 -bottom-1 w-6 h-6 border-l-4 border-b-4 border-blue-500 rounded-bl-xl"></span>
                                    <span className="absolute -right-1 -bottom-1 w-6 h-6 border-r-4 border-b-4 border-blue-500 rounded-br-xl"></span>
                                    
                                    {/* High Tech horizontal animated laser red light */}
                                    <span className="absolute w-[95%] h-[2.5px] bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-[bounce_2s_infinite]"></span>
                                    
                                    {/* Sub-text inside target area */}
                                    <span className="absolute bottom-3 text-[9px] font-black uppercase tracking-widest text-[#cbd5e1] animate-pulse text-center w-full px-2">
                                        Capturando...
                                    </span>
                                </div>
                            </div>
                        )}

                        {scannerError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-black/80 text-gray-400">
                                <AlertCircle size={40} className="text-red-500" />
                                <p className="text-xs max-w-sm">{scannerError}</p>
                                <button 
                                    onClick={() => {
                                        if (cameras.length > 0) {
                                            startScannerWithId(selectedCameraId || cameras[0].deviceId);
                                        } else {
                                            getDevices();
                                        }
                                    }}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
                                >
                                    Reintentar Conexión
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 to-transparent flex justify-center z-10 text-white text-[10px]">
                        <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full font-mono">
                            Alinea el código de barras dentro del recuadro
                        </span>
                    </div>
                </div>

                {/* Scan History / Live results side */}
                <div className="w-full md:w-[360px] bg-white dark:bg-gray-900 border-t md:border-t-0 md:border-l border-gray-150 dark:border-gray-800 p-5 flex flex-col justify-between">
                    
                    {/* Header */}
                    <div>
                        <div className="flex justify-between items-center pb-4 border-b dark:border-gray-800">
                            <div>
                                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">Panel Integrador</h3>
                                <p className="text-[10px] text-gray-400">Estatus de lecturas ópticas de cámara.</p>
                            </div>
                            <button 
                                onClick={onClose} 
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
                            >
                                <X size={18} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Current Result Highlight */}
                        <div className="mt-4">
                            <span className="text-[9px] font-bold tracking-widest text-gray-400 uppercase block mb-2">Última lectura</span>
                            {lastScannedCode ? (
                                <div className={`p-4 rounded-2xl border transition-all duration-300 ${scannedProduct ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="font-mono text-xs font-black text-gray-900 dark:text-white block px-2 py-1 bg-white dark:bg-black rounded border border-gray-150 dark:border-zinc-800 w-fit">
                                                {lastScannedCode}
                                            </span>
                                            {scannedProduct ? (
                                                <div className="mt-2 text-xs">
                                                    <h4 className="font-bold text-green-700 dark:text-green-400 flex items-center gap-1">
                                                        <Check size={14} /> {scannedProduct.name}
                                                    </h4>
                                                    <p className="text-gray-500 mt-1">Precio Unit: <b className="text-gray-950 dark:text-white">${(Number(scannedProduct.price_unit) || 0).toFixed(2)}</b></p>
                                                    <span className="mt-2 inline-flex items-center gap-1 bg-green-500 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full uppercase leading-none">
                                                        Sumado al carro +1
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-bold">
                                                    🚫 SKU no registrado en el inventario.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-5 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-center text-xs text-gray-400 flex flex-col items-center py-8">
                                    <ShoppingBag size={24} className="text-gray-300 mb-2" />
                                    <span>Esperando capturar algún código...</span>
                                </div>
                            )}
                        </div>

                        {/* FALLBACK: BUSCADOR MANUAL / SIMULADOR DE SCANNER */}
                        <div className="mt-5 p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] font-extrabold tracking-widest text-indigo-550 dark:text-indigo-400 uppercase block mb-1.5">Escanear desde Foto (100% Éxito)</span>
                            <p className="text-[10px] text-gray-500 mb-2 leading-relaxed">
                                Toma una foto nítida de cerca al código de barras con tu celular y súbela para decodificar al instante:
                            </p>
                            <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setScannerError(null);
                                    
                                    // Instantiate a standard parser
                                    const parser = new Html5Qrcode("pos-barcode-scanner-viewfinder", { verbose: false });
                                    try {
                                        const decodedText = await parser.scanFile(file, false);
                                        handleScanSuccess(decodedText);
                                    } catch (err: any) {
                                        console.warn("File scanning failed on primary viewfinder, trying secondary parser:", err);
                                        setScannerError("No se detectó un código de barra legible en la fotografía. Asegúrate de enfocar bien y de que haya buena iluminación.");
                                    }
                                }}
                                className="w-full text-[10px] text-gray-500 rounded-lg cursor-pointer file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[10px] file:font-black file:bg-blue-600 file:text-white hover:file:bg-blue-700 bg-white dark:bg-zinc-950 p-1 border dark:border-slate-800"
                            />
                        </div>

                        <div className="mt-5 p-4 bg-slate-50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] font-extrabold tracking-widest text-indigo-500 uppercase block mb-2">Simulador / Entrada Manual</span>
                            <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">
                                Si tu navegador restringe la cámara en este marco, escribe un SKU o selecciona del catálogo para simular la lectura de barras:
                            </p>
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    placeholder="Ej: BEB-STR-01..."
                                    className="flex-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-gray-100 focus:outline-none focus:border-indigo-500 font-mono font-bold placeholder-gray-400"
                                    value={manualSku}
                                    onChange={(e) => setManualSku(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleManualSubmit();
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleManualSubmit}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition cursor-pointer select-none active:scale-95 text-center flex items-center justify-center shrink-0"
                                >
                                    Escanear
                                </button>
                            </div>
                            
                            <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
                                <label className="text-[10px] text-gray-400 font-bold block mb-1.5">Escanear artículo del catálogo:</label>
                                <select
                                    className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-gray-300 focus:outline-none cursor-pointer"
                                    onChange={(e) => {
                                        const sku = e.target.value;
                                        if (sku) {
                                            setManualSku(sku);
                                            // Auto-submit immediately for delightful UX
                                            setTimeout(() => {
                                                handleScanSuccess(sku);
                                            }, 100);
                                        }
                                    }}
                                    value=""
                                >
                                    <option value="" disabled>-- Selecciona un producto para escanear --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.sku}>
                                            {p.name} ({p.sku}) - ${(Number(p.price_unit) || 0).toFixed(2)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Recent History stack */}
                        <div className="mt-6">
                            <span className="text-[9px] font-bold tracking-widest text-gray-400 uppercase block mb-3">Historial de escaneo</span>
                            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto">
                                {scanHistory.length === 0 ? (
                                    <p className="text-[10px] text-gray-400 italic">No hay lecturas registradas en esta sesión.</p>
                                ) : (
                                    scanHistory.map((item, index) => (
                                        <div key={index} className="flex justify-between items-center text-xs p-2 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800">
                                            <div className="truncate max-w-[180px]">
                                                <span className="font-mono text-[9px] text-gray-400 block">{item.time}</span>
                                                <h4 className={`font-bold truncate ${item.found ? 'text-gray-800 dark:text-gray-200' : 'text-red-400'}`}>
                                                    {item.found ? item.product?.name : `Desconocido: ${item.sku}`}
                                                </h4>
                                            </div>
                                            {item.found ? (
                                                <span className="text-[9px] font-bold bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 px-2 py-0.5 rounded">
                                                    +$1
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-bold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 px-2 py-0.5 rounded">
                                                    Err
                                                </span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom controls */}
                    <div className="mt-4 pt-4 border-t dark:border-gray-800 flex justify-end gap-2">
                        <button 
                            onClick={onClose}
                            className="w-full py-2.5 bg-gray-100 hover:bg-gray-250 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-300 transition"
                        >
                            Cerrar Cámara
                        </button>
                    </div>

                </div>

            </div>
        </div>
    );
}
