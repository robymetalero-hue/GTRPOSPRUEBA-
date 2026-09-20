import { safeDispatchEvent, createSafeCustomEvent } from "../utils/events";
import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, Loader, Sparkles, Send, Volume2, Info, MessageSquare, X, Minus, Bot, VolumeX, Camera, Upload, Trash2, ShoppingBag, ShoppingCart, PlusCircle, Check, FileText, Copy } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { hasPermission } from '../utils/permissions';
import { normalizeProductName } from '../utils/productUtils';
import { motion, AnimatePresence } from 'motion/react';

function downsampleBuffer(buffer: Float32Array, fromRate: number, toRate: number): Int16Array {
    if (fromRate === toRate) {
        const pcm = new Int16Array(buffer.length);
        for (let i = 0; i < buffer.length; i++) {
            let s = Math.max(-1, Math.min(1, buffer[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return pcm;
    }
    
    const sampleRateRatio = fromRate / toRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    
    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        let accum = 0;
        let count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        const avg = count > 0 ? accum / count : 0;
        let s = Math.max(-1, Math.min(1, avg));
        result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
}

function uint8ToBase64(uint8: Uint8Array): string {
    let binary = "";
    const len = uint8.length;
    const chunk = 8192;
    for (let i = 0; i < len; i += chunk) {
        binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunk) as any);
    }
    return btoa(binary);
}

function findBestProductMatch<T extends { name: string; sku?: string }>(items: T[], query: string): T | undefined {
    if (!query) return undefined;
    const normalizedQuery = query.toLowerCase().trim();
    
    // 1. Try absolute exact SKU match first
    const exactSku = items.find(item => item.sku && item.sku.toLowerCase().trim() === normalizedQuery);
    if (exactSku) return exactSku;

    // 2. Try exact Name match (ignoring case/whitespace)
    const exactName = items.find(item => item.name.toLowerCase().trim() === normalizedQuery);
    if (exactName) return exactName;

    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
    if (queryWords.length === 0) return undefined;

    let bestItem: T | undefined = undefined;
    let bestScore = -100000;

    for (const item of items) {
        const itemNameLower = item.name.toLowerCase();
        
        // Exact SKU Match (containment check)
        if (item.sku && normalizedQuery === item.sku.toLowerCase().trim()) {
            return item;
        }

        const itemWords = itemNameLower.split(/\s+/).filter(w => w.length > 0);
        
        let matchCount = 0;
        let missingCount = 0;
        
        for (const qw of queryWords) {
            if (itemNameLower.includes(qw)) {
                matchCount++;
            } else {
                missingCount++;
            }
        }

        if (matchCount === 0) continue;

        // Count extra words in the candidate name that were not specified in the query
        let extraCount = 0;
        for (const iw of itemWords) {
            if (!queryWords.includes(iw)) {
                extraCount++;
            }
        }

        // We want to maximize matchCount, minimize missingCount, and minimize extraCount.
        // Penalty coefficients are calibrated so exact word subset matches (like matching "extreme" to "Extreme")
        // are prioritized over super-set descriptions containing trailing descriptive qualifiers (like "Extreme Pro").
        let score = (matchCount * 10) - (missingCount * 50) - (extraCount * 1.5);

        // Substring alignment bonus (if the exact query is found as a contiguous substring)
        if (itemNameLower.includes(normalizedQuery)) {
            score += 15;
        }

        if (score > bestScore) {
            bestScore = score;
            bestItem = item;
        }
    }

    return bestScore > -20 ? bestItem : undefined;
}

export default function AudioVoice() {
    const { setDarkMode, addToCart, products, fetchProducts, cart, clearCart, setView, setExchangeRate, updateCartItemPrice, updateCartItemQuantity, exchangeRate, departments, fetchDepartments, user } = useAppContext();
    
    // Generate unique, collision-free message IDs
    const genUniqueId = (prefix: string) => {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    };

    const [connected, setConnected] = useState(false);
    const [isListening, setIsListeningState] = useState(false);
    const isListeningRef = useRef(false);
    const setIsListening = (listening: boolean) => {
        setIsListeningState(listening);
        isListeningRef.current = listening;
    };
    const [textCmd, setTextCmd] = useState("");
    const [isLiveActive, setIsLiveActiveState] = useState(false);
    const isLiveActiveRef = useRef(false);
    const setIsLiveActive = (active: boolean) => {
        setIsLiveActiveState(active);
        isLiveActiveRef.current = active;
        if (!active) {
            if (wsRef.current) {
                console.log("Deactivating Live Voice. Closing WebSocket.");
                try {
                    wsRef.current.close();
                } catch (_) {}
                wsRef.current = null;
            }
            setConnected(false);
            stopRecording();
            stopAllAudioPlayback();
        }
    };
    const [transcript, setTranscript] = useState("Modo de voz listo. Di algo como: 'IA, agrega un sándwich de jamón'");
    const [audioQueue, setAudioQueue] = useState<string[]>([]);

    useEffect(() => {
        safeDispatchEvent('ai-live-forensic-status', {
            detail: { isLiveActive, connected, transcript }
        });
    }, [isLiveActive, connected, transcript]);
    
    // Facebook Messenger-style expansion/collapse state
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Array<{ 
        id: string; 
        sender: 'user' | 'ai' | 'system'; 
        text: string; 
        time: string; 
        imageUrl?: string; 
        imageUrls?: string[];
        action?: { name: string; payload: any };
        _processed?: boolean;
    }>>([
        { id: 'welcome', sender: 'ai', text: '¡Hola! Soy la IA inteligente de GTR POS. Escríbeme o háblame pulsando el micrófono. Puedo agregar productos al carrito, procesar cobros y cambiar el modo de color.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);

    // Media Capture/Upload and AI Analysis states
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [latestAnalysisText, setLatestAnalysisText] = useState<string>("");
    const [latestAnalysisAction, setLatestAnalysisAction] = useState<any>(null);
    const backgroundAnalysisRef = useRef<Promise<any> | null>(null);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const isMutedRef = useRef(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const recognitionRef = useRef<any>(null);
    const recordingAudioCtxRef = useRef<AudioContext | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [isAiSpeaking, setIsAiSpeakingState] = useState(false);
    const isAiSpeakingRef = useRef(false);
    const currentVoiceMessageIdRef = useRef<string | null>(null);
    const currentAiMessageIdRef = useRef<string | null>(null);
    const setIsAiSpeaking = (speaking: boolean) => {
        setIsAiSpeakingState(speaking);
        isAiSpeakingRef.current = speaking;
    };

    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
    const handleCopyMessageText = (id: string, text: string) => {
        try {
            navigator.clipboard.writeText(text);
            setCopiedMessageId(id);
            setTimeout(() => setCopiedMessageId(null), 2000);
        } catch (e) {
            console.error("No se pudo copiar al portapapeles: ", e);
        }
    };

    const [isTtsActive, setIsTtsActive] = useState<boolean>(() => {
        try {
            return localStorage.getItem('isTtsActive') !== 'false';
        } catch (_) {
            return true;
        }
    });

    const speakText = (text: string) => {
        if (!window.speechSynthesis) return;
        try {
            window.speechSynthesis.cancel();

            let cleanText = text
                .replace(/\*\*?/g, '')
                .replace(/\[[^\]]+\]:?/g, '')
                .replace(/`[^`]+`/g, '')
                .trim();

            if (!cleanText) return;

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'es-ES';
            
            const voices = window.speechSynthesis.getVoices();
            const spanishVoice = voices.find(v => v.lang.startsWith('es-') && (v.name.includes('Google') || v.name.includes('Premium') || v.name.includes('Natural'))) 
                || voices.find(v => v.lang.startsWith('es-'))
                || voices[0];
            if (spanishVoice) {
                utterance.voice = spanishVoice;
            }

            utterance.onstart = () => {
                setIsAiSpeaking(true);
            };
            utterance.onend = () => {
                setIsAiSpeaking(false);
            };
            utterance.onerror = () => {
                setIsAiSpeaking(false);
            };

            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn("Speech synthesis issue:", e);
        }
    };

    // Messenger movable coordinates to position freely on screen
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
    const hasDragged = useRef(false);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement | HTMLButtonElement> | React.TouchEvent<HTMLDivElement | HTMLButtonElement>) => {
        // Prevent action on children elements that should trigger normal click events (like buttons, etc.)
        const target = e.target as HTMLElement;
        if (target.closest('button') && !target.closest('.cursor-grab')) {
            return;
        }

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        dragStart.current = {
            mouseX: clientX,
            mouseY: clientY,
            posX: position.x,
            posY: position.y
        };
        isDragging.current = true;
        hasDragged.current = false;
        
        document.body.style.userSelect = 'none';

        const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
            if (!isDragging.current) return;
            const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

            const dx = currentX - dragStart.current.mouseX;
            const dy = currentY - dragStart.current.mouseY;

            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                hasDragged.current = true;
            }

            setPosition({
                x: dragStart.current.posX + dx,
                y: dragStart.current.posY + dy
            });
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleMouseMove);
            window.removeEventListener('touchend', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleMouseMove, { passive: true });
        window.addEventListener('touchend', handleMouseUp);
    };

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    const nextStartTimeRef = useRef<number>(0);
    const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

    // Dynamic state reference for callback function to avoid closures
    const productsRef = useRef(products);
    const cartRef = useRef(cart);

    useEffect(() => {
        productsRef.current = products;
    }, [products]);

    useEffect(() => {
        cartRef.current = cart;
    }, [cart]);

    useEffect(() => {
        const handleOpenAi = () => {
            setIsOpen(true);
        };
        const handleStartLiveForensic = (e: any) => {
            setIsOpen(true);
            setIsLiveActive(true);
            setTimeout(() => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'context_update',
                        text: `[MODO AUDITORÍA FORENSE PERICIAL ACTIVO]: El Administrador está inspeccionando la auditoría de registros en tiempo real en la pantalla de Auditoría Forense. Tienes acceso completo a todos los registros del sistema. Usa tus herramientas periciales ('auditPeriodForensicCheck', 'auditInvestigateProduct', 'auditSearchTransactions') para responder de forma hablada con precisión matemática, detallando nombres, fechas, horas, cajeros y montos en Bs.`
                    }));
                }
            }, 700);
        };
        const handleStopLiveForensic = () => {
            setIsLiveActive(false);
        };
        window.addEventListener('open-ai-quick-commands', handleOpenAi);
        window.addEventListener('start-ai-live-forensic', handleStartLiveForensic);
        window.addEventListener('stop-ai-live-forensic', handleStopLiveForensic);
        return () => {
            window.removeEventListener('open-ai-quick-commands', handleOpenAi);
            window.removeEventListener('start-ai-live-forensic', handleStartLiveForensic);
            window.removeEventListener('stop-ai-live-forensic', handleStopLiveForensic);
        };
    }, []);

    // Automatic smooth scroll to feed bottom when a message arrives
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 80);
            return () => clearTimeout(timer);
        }
    }, [messages, isOpen]);



    const sendCartContext = () => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const cartSummary = cartRef.current.map(item => `- ${item.name} (SKU: ${item.sku || 'N/A'}, ID: ${item.id}): Cantidad actual en el carrito = ${item.cartQuantity}, Precio unitario = Bs. ${(item.price_unit * exchangeRate).toFixed(2)}, Precio por mayor = Bs. ${(item.price_bulk * exchangeRate).toFixed(2)}, Tipo de precio actual = ${item.price_type || 'unit'}`).join('\n');
            const cartContext = `[SITUACIÓN ACTUAL DEL CARRITO DE COMPRAS]\n` +
                (cartSummary ? cartSummary : "(El carrito está vacío en este momento)") +
                `\n\n[INSTRUCCIÓN CRÍTICA DE CÁLCULO]: Cuando el usuario te pida agregar, quitar o de editar cantidades (por ejemplo "súmale 3", "restale 5", "sácame 2", "pon 10"), tú debes hacer el cálculo de suma/resta matemáticamente sobre la cantidad actual de ese producto. \n\nEjemplo de Cálculo:\n- Si te dicen "restale 5" y en el carrito dice que hay 10 unidades, tú calculas (10 - 5 = 5) y debes llamar a la función de herramienta "modifyCartItemQuantity" pasándole la cantidad resultante exacta calculada por ti (quantity: 5).\n- Si te dicen "súmale 10" y en el carrito dice que hay 2 unidades, tú calculas (2 + 10 = 12) y llamas a "modifyCartItemQuantity" con (quantity: 12).\n- Si te dicen "quitale 3" y en el carrito solo hay 2, calculas (2 - 3 <= 0), por lo que lo dejas en 0 (quantity: 0).\n- Haz el cálculo tú mismo de forma 100% exacta y confiable, sin cometer ningún error aritmético. Llama siempre a "modifyCartItemQuantity" con el número absoluto calculado por ti. ¡Sé ultra-meticuloso! Si el producto no aparece en el resumen anterior, su cantidad actual es de 0 unidades.`;

            // Enviar context_update clásico
            wsRef.current.send(JSON.stringify({
                type: 'context_update',
                text: cartContext
            }));

            // Enviar cart_sync estructurado
            wsRef.current.send(JSON.stringify({
                type: 'cart_sync',
                cart: cartRef.current
            }));
        }
    };

    useEffect(() => {
        if (connected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            sendCartContext();
        }
    }, [connected, cart]);

    useEffect(() => {
        if (connected && latestAnalysisText && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'context_update',
                text: `[CONTEXTO DE PRODUCTO CARGADO: El usuario ha capturado/subido una imagen de un producto. Tu análisis es: "${latestAnalysisText}". Si el usuario te habla o te escribe por chat de esto, ya sabes qué producto es y estás listo para asistir con herramientas de venta, agregarlo al carrito o cambiar de pestaña.]`
            }));
        }
    }, [connected, latestAnalysisText]);

    const handleAIAction = (action: string, payload: any) => {
        console.log("UI received AI action:", action, payload);
        if (action === 'toggleDarkMode') {
            setDarkMode(payload.enable);
            const msgVal = `Ajuste cambiado a ${payload.enable ? "Modo Noche" : "Modo Día"}`;
            setTranscript(msgVal);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_mode'),
                sender: 'system',
                text: `🎨 ${msgVal}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } else if (action === 'createProduct') {
            const requestedName = (payload.name || "Nuevo Producto IA").trim();
            const normReqName = normalizeProductName(requestedName);
            const requestedSku = payload.sku ? String(payload.sku).trim().toLowerCase() : '';
            
            const existingMatch = products.find(p => 
                (requestedSku && p.sku && p.sku.toLowerCase() === requestedSku) || 
                normalizeProductName(p.name) === normReqName
            );

            if (existingMatch) {
                const msgVal = `El producto "${existingMatch.name}" ya existe en catálogo (#${existingMatch.id}, SKU: ${existingMatch.sku}). Se agregó directamente al carrito de compras.`;
                setTranscript(msgVal);
                setMessages(prev => [...prev, {
                    id: genUniqueId('sys_exist_prod'),
                    sender: 'system',
                    text: `ℹ️ ${msgVal}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
                addToCart(existingMatch, payload.quantity || 1);
                return;
            }

            const newProduct = {
                name: requestedName,
                category: payload.category || "General",
                sku: payload.sku || "IA-GET-" + Math.floor(100 + Math.random() * 900),
                stock: payload.stock !== undefined ? Number(payload.stock) : 15,
                price_unit: payload.price_unit !== undefined ? Number(payload.price_unit) : 1.5,
                price_bulk: payload.price_bulk !== undefined ? Number(payload.price_bulk) : 1.2,
                price_cost: payload.price_cost !== undefined ? Number(payload.price_cost) : 0.8,
                stock_alarm: payload.stock_alarm !== undefined ? Number(payload.stock_alarm) : 3,
                image: payload.image || null
            };

            fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newProduct)
            })
            .then(async res => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Error en el servidor al registrar.");
                return data;
            })
            .then(data => {
                const msgVal = `Producto creado exitosamente: ${newProduct.name} (SKU: ${newProduct.sku}) con precio de Bs.${(newProduct.price_unit * 6.96).toFixed(2)}.`;
                setTranscript(msgVal);
                setMessages(prev => [...prev, {
                    id: genUniqueId('sys_new_prod'),
                    sender: 'system',
                    text: `🆕 ${msgVal}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);

                // Sincronizar stock
                fetchProducts();

                // Agregar automáticamente al carrito de compras
                const localProd = {
                    id: data.id || Date.now(),
                    ...newProduct
                };
                addToCart(localProd, payload.quantity || 1);
            })
            .catch(err => {
                console.error("AI automated product creation failed:", err);
                setMessages(prev => [...prev, {
                    id: genUniqueId('sys_err_prod'),
                    sender: 'system',
                    text: `⚠️ Falló registro automático de "${newProduct.name}": ${err.message || 'Producto duplicado o error técnico'}.`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
            });
        } else if (action === 'createDepartment') {
            const deptName = payload.departmentName || "";
            if (!deptName) {
                const msgVal = "No se especificó el nombre del departamento.";
                setTranscript(msgVal);
                return;
            }
            fetch("/api/departments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: deptName })
            })
            .then(res => {
                if (!res.ok) throw new Error("Fallo en el servidor al registrar el departamento.");
                return res.json();
            })
            .then(() => {
                const msgVal = `Departamento "${deptName}" creado exitosamente.`;
                setTranscript(msgVal);
                setMessages(prev => [...prev, {
                    id: genUniqueId('sys_new_dept'),
                    sender: 'system',
                    text: `📁 ${msgVal}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
                fetchDepartments();
            })
            .catch(err => {
                console.error(err);
                const msgVal = `No se pudo registrar el departamento "${deptName}".`;
                setTranscript(msgVal);
            });
        } else if (action === 'classifyProduct') {
            const matchName = payload.productNameOrSku || "";
            const categoryName = payload.categoryName || "";
            if (!matchName || !categoryName) {
                const msgVal = "Parámetros insuficientes para clasificar producto.";
                setTranscript(msgVal);
                return;
            }

            const targetProd = findBestProductMatch(products, matchName) as any;
            if (!targetProd) {
                const msgVal = `No se encontró un producto similar a "${matchName}" para clasificar.`;
                setTranscript(msgVal);
                return;
            }

            const exists = (departments || []).some((d: any) => d.name.toLowerCase() === categoryName.toLowerCase());

            const performClassification = () => {
                const updatedProd = {
                    ...targetProd,
                    category: categoryName
                };
                fetch(`/api/products/${targetProd.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updatedProd)
                })
                .then(res => {
                    if (!res.ok) throw new Error("Fallo en el servidor al actualizar la categoría.");
                    return res.json();
                })
                .then(() => {
                    const msgVal = `Producto "${targetProd.name}" clasificado en el departamento "${categoryName}" con éxito.`;
                    setTranscript(msgVal);
                    setMessages(prev => [...prev, {
                        id: genUniqueId('sys_class_prod'),
                        sender: 'system',
                        text: `🏷️ ${msgVal}`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }]);
                    fetchProducts();
                })
                .catch(err => {
                    console.error(err);
                    const msgVal = `Error al cambiar la categoría de "${targetProd.name}".`;
                    setTranscript(msgVal);
                });
            };

            if (!exists) {
                fetch("/api/departments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: categoryName })
                })
                .then(res => {
                    if (!res.ok) throw new Error("Error auto-creando departamento.");
                    return res.json();
                })
                .then(() => {
                    fetchDepartments();
                    performClassification();
                })
                .catch(err => {
                    console.error(err);
                    performClassification();
                });
            } else {
                performClassification();
            }
        } else if (action === 'addProductToCart') {
            const matchName = payload.productName || "";
            const qty = payload.quantity || 1;
            
            const target = findBestProductMatch(productsRef.current, matchName) as any;
            if (target) {
                if (target.stock <= 0) {
                    const msgVal = `Lo siento, el producto "${target.name}" está agotado (0 unidades en stock).`;
                    setTranscript(msgVal);
                    setMessages(prev => [...prev, {
                        id: genUniqueId('sys_err_stock'),
                        sender: 'system',
                        text: `⚠️ ${msgVal}`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }]);
                    speakText(msgVal);
                    return;
                }
                
                let targetQty = qty;
                let stockWarning = false;
                
                // Calculate current quantity in cart to check aggregate limit
                const currentCartItem = cartRef.current.find(item => item.id === target.id);
                const currentInCart = currentCartItem ? currentCartItem.cartQuantity : 0;
                
                if (currentInCart + qty > target.stock) {
                    targetQty = target.stock - currentInCart;
                    stockWarning = true;
                }
                
                if (targetQty <= 0) {
                    const msgVal = `No se puede agregar más de "${target.name}". Ya tienes el límite de stock de ${target.stock} unidades en el carrito.`;
                    setTranscript(msgVal);
                    setMessages(prev => [...prev, {
                        id: genUniqueId('sys_err_stock'),
                        sender: 'system',
                        text: `⚠️ ${msgVal}`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }]);
                    speakText(msgVal);
                    return;
                }

                addToCart(target, targetQty);
                
                let msgVal = "";
                if (stockWarning) {
                    msgVal = `Agregado solo ${targetQty}x ${target.name} al carrito (con tope por stock límite de ${target.stock} unidades).`;
                } else {
                    msgVal = `Agregado ${targetQty}x ${target.name} al carrito.`;
                }
                setTranscript(msgVal);
                setMessages(prev => [...prev, {
                    id: genUniqueId('sys_add'),
                    sender: 'system',
                    text: `🛒 ${msgVal}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
            } else {
                const msgVal = `No pudimos localizar un producto similar a "${payload.productName}".`;
                setTranscript(msgVal);
                setMessages(prev => [...prev, {
                    id: genUniqueId('sys_err'),
                    sender: 'system',
                    text: `⚠️ ${msgVal}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
            }
        } else if (action === 'checkoutSale') {
            const event = createSafeCustomEvent('aiCheckout', { detail: { paymentMethod: payload.paymentMethod || 'Efectivo' } });
            window.dispatchEvent(event);
            const msgVal = `Procesando cobro por ${payload.paymentMethod || 'Efectivo'}...`;
            setTranscript(msgVal);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_pay'),
                sender: 'system',
                text: `💸 ${msgVal}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } else if (action === 'changeClientSelection') {
            const event = createSafeCustomEvent('aiClientChange', { detail: { name: payload.clientName, phone: payload.clientPhone || '' } });
            window.dispatchEvent(event);
            const msgVal = `Asociando cliente "${payload.clientName}" a la venta actual.`;
            setTranscript(msgVal);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_client'),
                sender: 'system',
                text: `👤 ${msgVal}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } else if (action === 'applyDiscountCode') {
            const event = createSafeCustomEvent('aiApplyDiscount', { detail: { discount: payload.discount, discountType: payload.discountType } });
            window.dispatchEvent(event);
            const msgVal = `Asignando descuento de ${payload.discount}${payload.discountType === 'porcentaje' ? '%' : '$'}.`;
            setTranscript(msgVal);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_disc'),
                sender: 'system',
                text: `🏷️ ${msgVal}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } else if (action === 'clearCartItems') {
            clearCart();
            const msgVal = "El carrito de compras se ha vaciado.";
            setTranscript(msgVal);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_clear'),
                sender: 'system',
                text: `🗑️ ${msgVal}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } else if (action === 'switchActiveView') {
            const targetView = payload.viewName;
            setView(targetView);
            const viewLabels: any = { pos: "Punto de Venta", dashboard: "Dashboard KPI", inventory: "Inventario de Stock", permissions: "Consola de Personal" };
            const msgVal = `Pantalla cambiada a "${viewLabels[targetView] || targetView}".`;
            setTranscript(msgVal);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_view'),
                sender: 'system',
                text: `📺 ${msgVal}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } else if (action === 'refreshProducts') {
            fetchProducts();
            const msgVal = "Artículos sincronizados con la base de datos.";
            setTranscript(msgVal);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_refresh'),
                sender: 'system',
                text: `🔄 ${msgVal}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } else if (action === 'exchangeRateUpdated') {
            setExchangeRate(payload.exchange_rate);
            const msgVal = `Tipo de cambio configurado a $1 USD = ${payload.exchange_rate} Bs.`;
            setTranscript(msgVal);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_rate_ai'),
                sender: 'system',
                text: `💵 ${msgVal}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } else if (action === 'refreshUsers') {
            safeDispatchEvent('aiUsersRefresh');
            const msgVal = "Lista de usuarios y personal sincronizados.";
            setTranscript(msgVal);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_users_ai'),
                sender: 'system',
                text: `👥 ${msgVal}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } else if (action === 'refreshReceivables') {
            safeDispatchEvent('aiRefreshReceivables');
            const msgVal = payload.message || "Cuentas y cobros de crédito actualizados.";
            setTranscript(msgVal);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_receivables_ai'),
                sender: 'system',
                text: `💸 ${msgVal}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } else if (action === 'modifyCartItemPrice') {
            const query = payload.productNameOrSku || "";
            // Find item in cart using high precision match
            const cartItem = findBestProductMatch(cart, query) as any;

            if (cartItem) {
                const targetPriceType = payload.priceType || 'custom';
                let usdPrice: number | undefined = undefined;
                let messageDetail = `Cambiado precio de "${cartItem.name}"`;

                if (payload.customPriceBs !== undefined) {
                    usdPrice = payload.customPriceBs / exchangeRate;
                    updateCartItemPrice(cartItem.id, 'custom', usdPrice);
                    messageDetail = `Precio de "${cartItem.name}" establecido a Bs. ${payload.customPriceBs.toFixed(2)}`;
                } else if (targetPriceType === 'bulk') {
                    updateCartItemPrice(cartItem.id, 'bulk');
                    messageDetail = `Precio de "${cartItem.name}" cambiado a "Por Mayor" (Bs. ${(cartItem.price_bulk * exchangeRate).toFixed(2)})`;
                } else if (targetPriceType === 'unit') {
                    updateCartItemPrice(cartItem.id, 'unit');
                    messageDetail = `Precio de "${cartItem.name}" cambiado a "Por Unidad" (Bs. ${(cartItem.price_unit * exchangeRate).toFixed(2)})`;
                } else {
                    updateCartItemPrice(cartItem.id, 'custom');
                    messageDetail = `Precio de "${cartItem.name}" en modo personalizado`;
                }

                setTranscript(messageDetail);
                setMessages(prev => [...prev, {
                    id: genUniqueId('sys_cart_price'),
                    sender: 'system',
                    text: `💰 ${messageDetail}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
            } else {
                // If item not in cart, find in products catalog, add it, then set price
                const targetProd = findBestProductMatch(productsRef.current, query) as any;
                if (targetProd) {
                    addToCart(targetProd, 1);
                    const targetPriceType = payload.priceType || 'custom';
                    let usdPrice: number | undefined = undefined;
                    
                    setTimeout(() => {
                        let messageDetail = `Agregado "${targetProd.name}" al carrito `;
                        if (payload.customPriceBs !== undefined) {
                            usdPrice = payload.customPriceBs / exchangeRate;
                            updateCartItemPrice(targetProd.id, 'custom', usdPrice);
                            messageDetail += `y su precio establecido a Bs. ${payload.customPriceBs.toFixed(2)}`;
                        } else if (targetPriceType === 'bulk') {
                            updateCartItemPrice(targetProd.id, 'bulk');
                            messageDetail += `con precio "Por Mayor" (Bs. ${(targetProd.price_bulk * exchangeRate).toFixed(2)})`;
                        } else if (targetPriceType === 'unit') {
                            updateCartItemPrice(targetProd.id, 'unit');
                            messageDetail += `con precio "Por Unidad" (Bs. ${(targetProd.price_unit * exchangeRate).toFixed(2)})`;
                        } else {
                            updateCartItemPrice(targetProd.id, 'custom');
                            messageDetail += `en modo de precio personalizado`;
                        }
                        
                        setTranscript(messageDetail);
                        setMessages(prev => [...prev, {
                            id: genUniqueId('sys_cart_price'),
                            sender: 'system',
                            text: `🛒💰 ${messageDetail}`,
                            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }]);
                    }, 80);
                } else {
                    const msgVal = `No se halló el artículo "${payload.productNameOrSku}" para modificarle el precio.`;
                    setTranscript(msgVal);
                    setMessages(prev => [...prev, {
                        id: genUniqueId('sys_cart_price_err'),
                        sender: 'system',
                        text: `⚠️ ${msgVal}`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }]);
                }
            }
        } else if (action === 'modifyCartItemQuantity') {
            const query = payload.productNameOrSku || "";
            const cartItem = findBestProductMatch(cart, query) as any;

            if (cartItem) {
                let targetQty = Number(payload.quantity);
                if (!isNaN(targetQty) && targetQty >= 0) {
                    let stockWarning = false;
                    if (targetQty > cartItem.stock) {
                        targetQty = cartItem.stock;
                        stockWarning = true;
                    }
                    
                    updateCartItemQuantity(cartItem.id, targetQty);
                    
                    let msgVal = "";
                    if (stockWarning) {
                        msgVal = `Cantidad de "${cartItem.name}" cambiada a ${targetQty} unidades (límite stock superado; ajustado al tope).`;
                        speakText(`He ajustado la cantidad a ${targetQty} unidades porque es el stock máximo disponible.`);
                    } else {
                        msgVal = `Cantidad de "${cartItem.name}" cambiada a ${targetQty} unidades.`;
                    }
                    
                    setTranscript(msgVal);
                    setMessages(prev => [...prev, {
                        id: genUniqueId('sys_cart_qty'),
                        sender: 'system',
                        text: `🔢 ${msgVal}`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }]);
                }
            } else {
                const targetProd = findBestProductMatch(productsRef.current, query) as any;
                if (targetProd) {
                    let targetQty = Number(payload.quantity);
                    if (!isNaN(targetQty) && targetQty >= 0) {
                        let stockWarning = false;
                        if (targetQty > targetProd.stock) {
                            targetQty = targetProd.stock;
                            stockWarning = true;
                        }
                        
                        if (targetQty <= 0) {
                            const msgVal = `El producto "${targetProd.name}" está agotado (stock actual: 0).`;
                            setTranscript(msgVal);
                            setMessages(prev => [...prev, {
                                id: genUniqueId('sys_cart_qty_err'),
                                sender: 'system',
                                text: `⚠️ ${msgVal}`,
                                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }]);
                            speakText(msgVal);
                            return;
                        }

                        addToCart(targetProd, targetQty);
                        
                        let msgVal = "";
                        if (stockWarning) {
                            msgVal = `Agregado ${targetQty} unidades de "${targetProd.name}" al carrito (tope por stock disponible).`;
                            speakText(`Agregado solo ${targetQty} unidades por límite de stock.`);
                        } else {
                            msgVal = `Agregado ${targetQty} unidades de "${targetProd.name}" al carrito.`;
                        }
                        
                        setTranscript(msgVal);
                        setMessages(prev => [...prev, {
                            id: genUniqueId('sys_cart_qty'),
                            sender: 'system',
                            text: `🛒🔢 ${msgVal}`,
                            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }]);
                    }
                } else {
                    const msgVal = `No se halló "${payload.productNameOrSku}" para asignar cantidad.`;
                    setTranscript(msgVal);
                    setMessages(prev => [...prev, {
                        id: genUniqueId('sys_cart_qty_err'),
                        sender: 'system',
                        text: `⚠️ ${msgVal}`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }]);
                }
            }
        }
    };

    const toggleMute = () => {
        const nextMuted = !isMuted;
        setIsMuted(nextMuted);
        isMutedRef.current = nextMuted;
    };

    const startCamera = async () => {
        setIsCameraActive(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            setCameraStream(stream);
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(e => console.warn("Video play failed:", e));
                }
            }, 100);
        } catch (err: any) {
            console.error("No se pudo acceder a la cámara:", err);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_cam_err'),
                sender: 'system',
                text: "⚠️ No se pudo acceder a la cámara o no se otorgaron permisos de cámara.",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
            setIsCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setIsCameraActive(false);
    };

    const triggerAutoAnalysis = async (base64DataUrls: string[]) => {
        if (base64DataUrls.length === 0) return;
        setLatestAnalysisText("");
        setLatestAnalysisAction(null);
        setIsAnalyzing(true);

        const payloads = base64DataUrls.map(url => {
            const base64Clean = url.split(',')[1];
            const mimeType = url.split(';')[0].split(':')[1];
            return { image: base64Clean, mimeType };
        });

        // Prepare context promise so that send click can await if not finished
        const promise = (async () => {
            const res = await fetch("/api/analyze-file", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    images: payloads.map(p => p.image),
                    mimeTypes: payloads.map(p => p.mimeType),
                    prompt: "Identifica detalladamente de qué producto o artículo se trata analizando todas las imágenes aportadas (pueden ser cara frontal y posterior). Describe sus atributos físicos y determina la mejor acción."
                })
            });

            if (!res.ok) {
                throw new Error("No se pudo completar el análisis rápido de múltiples imágenes.");
            }
            return await res.json();
        })();

        backgroundAnalysisRef.current = promise;

        try {
            const data = await promise;
            const aiText = data.text || "La IA analizó tus archivos con éxito.";
            setLatestAnalysisText(aiText);
            setLatestAnalysisAction(data.action || null);

            // Sync visual context proactively with the active live WebSocket session
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'context_update',
                    text: `[CONTEXTO DE PRODUCTO CARGADO: El usuario ha cargado múltiples imágenes de un producto. Tu análisis de las imágenes es: "${aiText}". Si el usuario te habla por voz o texto de este producto, brinda asistencia inmediata o ayúdalo a agregarlo/venderlo usando tus herramientas si lo solicita con naturalidad.]`
                }));
            }

            // Standard unobtrusive status feedback
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_auto_seen'),
                sender: 'system',
                text: `👁️ Cerebro GTR analizó las imágenes: "${aiText.slice(0, 100)}..."`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);

        } catch (err: any) {
            console.warn("Proactive image analysis bypassed or failed:", err?.message || String(err));
        } finally {
            setIsAnalyzing(false);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            const videoWidth = videoRef.current.videoWidth || 640;
            const videoHeight = videoRef.current.videoHeight || 480;
            
            // Limit the maximum dimension of the photo to 800px while maintaining the aspect ratio
            const maxDim = 800;
            let width = videoWidth;
            let height = videoHeight;
            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, width, height);
                // Export at 0.7 JPEG quality to shrink payload and load instantly
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                setImagePreviews(prev => {
                    const updated = [...prev, dataUrl];
                    triggerAutoAnalysis(updated);
                    return updated;
                });
            }
            stopCamera();
        }
    };

    const handleSendWithAnalysis = async () => {
        if (imagePreviews.length === 0) return;
        const textToSend = textCmd.trim();
        setIsAnalyzing(true);
        
        // Add image & text preview user bubbles to chat log
        const userMsgId = genUniqueId('user_upload');
        setMessages(prev => [...prev, {
            id: userMsgId,
            sender: 'user',
            text: textToSend ? `[Instrucción]: ${textToSend}` : `📸 ${imagePreviews.length} imágenes enviadas para análisis`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            imageUrls: imagePreviews
        }]);

        try {
            let data: any = null;
            if (latestAnalysisText) {
                data = {
                    text: latestAnalysisText,
                    action: latestAnalysisAction
                };
            } else if (backgroundAnalysisRef.current) {
                data = await backgroundAnalysisRef.current;
            } else {
                const payloads = imagePreviews.map(url => {
                    const base64Clean = url.split(',')[1];
                    const mimeType = url.split(';')[0].split(':')[1];
                    return { image: base64Clean, mimeType };
                });

                const res = await fetch("/api/analyze-file", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        images: payloads.map(p => p.image),
                        mimeTypes: payloads.map(p => p.mimeType),
                        prompt: textToSend || "Analiza estas imágenes de productos e identifica SKU, modelo, capacidad, marca, etc. y sigue las instrucciones que correspondan."
                    })
                });

                if (!res.ok) {
                    throw new Error("Error en respuesta del servidor");
                }
                data = await res.json();
            }

            const aiText = data.text || "La IA analizó tus archivos con éxito.";
            
            // Add AI response as chat bubble
            setMessages(prev => [...prev, {
                id: genUniqueId('ai_upload'),
                sender: 'ai',
                text: aiText,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                action: data.action || undefined
            }]);

            // Speak the analyzed response out loud if Voice/TTS is toggled on
            if (isTtsActive) {
                speakText(aiText);
            }

            // Execute action if provided & is NOT a proposal action
            if (data.action && data.action.name && !data.action.name.startsWith("propose")) {
                handleAIAction(data.action.name, data.action.payload || {});
            }

            // Clear states
            setImagePreviews([]);
            setTextCmd("");
            setLatestAnalysisText("");
            setLatestAnalysisAction(null);
            backgroundAnalysisRef.current = null;

        } catch (err: any) {
            console.error("Error analyzing visual input:", err);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_analyze_err'),
                sender: 'system',
                text: "⚠️ No se pudo completar el análisis visual: " + err.message,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const loadAndResize = (file: File): Promise<string> => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (typeof reader.result === 'string') {
                        const img = new Image();
                        const readerResult = reader.result;
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const maxDim = 800;
                            let width = img.width;
                            let height = img.height;
                            if (width > maxDim || height > maxDim) {
                                if (width > height) {
                                    height = Math.round((height * maxDim) / width);
                                    width = maxDim;
                                } else {
                                    width = Math.round((width * maxDim) / height);
                                    height = maxDim;
                                }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                ctx.drawImage(img, 0, 0, width, height);
                                resolve(canvas.toDataURL('image/jpeg', 0.7));
                            } else {
                                resolve(readerResult);
                            }
                        };
                        img.onerror = () => {
                            resolve(readerResult);
                        };
                        img.src = readerResult;
                    } else {
                        resolve("");
                    }
                };
                reader.readAsDataURL(file);
            });
        };

        try {
            const promises = Array.from(files).map((f: any) => loadAndResize(f));
            const base64Results = await Promise.all(promises);
            const validImages = base64Results.filter(Boolean);
            if (validImages.length > 0) {
                setImagePreviews(prev => {
                    const updated = [...prev, ...validImages];
                    triggerAutoAnalysis(updated);
                    return updated;
                });
            }
        } catch (error) {
            console.error("Error cargando múltiples archivos:", error);
        }
    };

    const stopAllAudioPlayback = () => {
        try {
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
            activeSourcesRef.current.forEach(source => {
                try {
                    source.stop();
                } catch (e) {
                    // Ignore if already stopped
                }
            });
            activeSourcesRef.current = [];
            nextStartTimeRef.current = 0;
            setIsAiSpeaking(false);
        } catch (e: any) {
            console.warn("Error stopping audio playback:", e?.message || String(e));
        }
    };

    // Low-latency, jitter-free, clickless gapless PCM player at 24000Hz (24kHz)
    const playAudioChunk = async (base64Audio: string) => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            
            // Resume context if suspended (common browser policy auto-prevent)
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            const rawBinary = atob(base64Audio);
            const bufferLen = rawBinary.length;
            const alignedLen = bufferLen - (bufferLen % 2);
            const arrayBuffer = new ArrayBuffer(alignedLen);
            const uint8 = new Uint8Array(arrayBuffer);
            for (let i = 0; i < alignedLen; i++) {
                uint8[i] = rawBinary.charCodeAt(i);
            }

            // Convert raw PCM audio bytes to float32
            const int16Array = new Int16Array(arrayBuffer);
            const float32Array = new Float32Array(int16Array.length);
            for (let i = 0; i < int16Array.length; i++) {
                float32Array[i] = int16Array[i] / 32768.0;
            }

            // Gemini audio output operates at 24000 Hz (24kHz)
            const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
            audioBuffer.getChannelData(0).set(float32Array);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);

            // Keep track of active sources so they can be halted on interruption
            activeSourcesRef.current.push(source);
            setIsAiSpeaking(true);
            source.onended = () => {
                activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
                if (activeSourcesRef.current.length === 0) {
                    setIsAiSpeaking(false);
                }
            };

            // Jitter-free scheduling
            const currentTime = ctx.currentTime;
            if (nextStartTimeRef.current < currentTime) {
                // Add a small 40ms safety buffer to start playing smoothly and avoid underruns
                nextStartTimeRef.current = currentTime + 0.04;
            }

            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
        } catch (e: any) {
            console.warn("PCM streaming playback warning:", e?.message || String(e));
        }
    };

    const startRecording = async () => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        if (isListening || recordingAudioCtxRef.current || mediaStreamRef.current) {
            console.warn("[Audio Engine] Recording is already active. Ignoring call to prevent duplicate captures.");
            return;
        }
        if (isTranscribing) {
            try {
                stopTranscriber();
            } catch (e) {}
        }
        try {
            sendCartContext();
            setTranscript("Escuchando... Di algo como 'Agrega sándwich de jamón'");
            
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            let audioCtx: AudioContext;
            try {
                audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            } catch (err) {
                console.warn("Failed to create AudioContext with 16000Hz, falling back to default:", err);
                audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            recordingAudioCtxRef.current = audioCtx;
            
            const source = audioCtx.createMediaStreamSource(stream);
            sourceRef.current = source;

            // Setup Analyser Node for measuring user's vocal cords intensity
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64; // Small fftSize is highly reactive in time-domain
            analyserRef.current = analyser;
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const processVolume = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);

                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                
                // Normalization - scaled to reflect standard human speaking levels (around 100 max)
                const level = (isMutedRef.current || isAiSpeakingRef.current) ? 0 : Math.min(1.0, average / 100.0);
                setAudioLevel(level);

                animationFrameRef.current = requestAnimationFrame(processVolume);
            };

            // Launch the analysis loop
            animationFrameRef.current = requestAnimationFrame(processVolume);

            // 8192 buffer size to reduce the frame transmission rate and avoid packet congestion over WebSocket proxy
            const processor = audioCtx.createScriptProcessor(8192, 1, 1);
            processorRef.current = processor;
            
            source.connect(processor);
            processor.connect(audioCtx.destination);
            
            processor.onaudioprocess = (e) => {
                if (isMutedRef.current || isAiSpeakingRef.current) {
                    return;
                }
                const floatData = e.inputBuffer.getChannelData(0);
                const fromRate = audioCtx.sampleRate;
                const pcm = downsampleBuffer(floatData, fromRate, 16000);
                
                const uint8 = new Uint8Array(pcm.buffer);
                const base64 = uint8ToBase64(uint8);
                
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ audio: base64 }));
                }
            };
            
            setIsListening(true);
            setMessages(prev => {
                return [...prev, {
                    id: genUniqueId('sys_listening'),
                    sender: 'system',
                    text: '🎙️ Micrófono encendido: Habla ahora...',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }];
            });
        } catch (e: any) {
            console.warn("Microphone not available or permission denied in sandboxed iframe:", e?.message || String(e));
            const errMsg = "Permiso de micrófono denegado. Por favor, abre la barra superior derecha de la vista previa para abrir en nueva pestaña y permitir micro, o escribe tus comandos.";
            setTranscript(errMsg);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_mic_denied'),
                sender: 'system',
                text: `⚠️ ${errMsg}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        }
    };

    const stopRecording = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        analyserRef.current = null;
        setAudioLevel(0);

        if (processorRef.current) {
            try {
                processorRef.current.disconnect();
            } catch (_) {}
            processorRef.current = null;
        }
        if (sourceRef.current) {
            try {
                sourceRef.current.disconnect();
            } catch (_) {}
            sourceRef.current = null;
        }
        if (mediaStreamRef.current) {
            try {
                mediaStreamRef.current.getTracks().forEach(t => t.stop());
            } catch (_) {}
            mediaStreamRef.current = null;
        }
        if (recordingAudioCtxRef.current) {
            try {
                if (recordingAudioCtxRef.current.state !== 'closed') {
                    recordingAudioCtxRef.current.close();
                }
            } catch (_) {}
            recordingAudioCtxRef.current = null;
        }
        setIsListening(false);
        setTranscript("Módulo de voz en pausa. Haz clic en el micrófono para hablar.");
        setMessages(prev => {
            return [...prev, {
                id: genUniqueId('sys_paused'),
                sender: 'system',
                text: '🔇 Micrófono apagado.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }];
        });
    };

    useEffect(() => {
        if (!isLiveActive) {
            if (wsRef.current) {
                console.log("Closing WS because Live Mode is deactivated");
                try {
                    wsRef.current.close();
                } catch (_) {}
                wsRef.current = null;
                setConnected(false);
            }
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/live`;
        console.log("Connecting to Live WS proxy at:", wsUrl);
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            setConnected(true);
            console.log("WS Opened for Live Voice session");
            // Automatically start recording when WebSocket is open
            startRecording();
        };
        ws.onerror = (err: any) => {
            console.warn("Client WS error event handled gracefully:", err?.message || String(err));
        };
        ws.onclose = () => {
            setConnected(false);
            setIsLiveActiveState(false);
            console.log("WS Closed");
        };
        ws.onmessage = async (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === 'action') {
                    handleAIAction(msg.action, msg.payload);
                } else if (msg.type === 'app_update' || msg.type === 'app_push_update') {
                    // Dispatch custom event to force trigger update on AppLayout
                    safeDispatchEvent('app-update-pushed', {
                        detail: {
                            version: msg.version,
                            release_notes: msg.release_notes
                        }
                    });
                } else if (msg.type === 'audio') {
                    playAudioChunk(msg.audio);
                } else if (msg.type === 'userTranscript') {
                    setTranscript(`Tú: ${msg.text}`);
                    currentAiMessageIdRef.current = null;
                    setMessages(prev => {
                        const targetId = currentVoiceMessageIdRef.current;
                        const existing = targetId ? prev.find(m => m.id === targetId) : null;
                        if (existing) {
                            return prev.map(m => m.id === targetId ? { ...m, text: msg.text } : m);
                        } else {
                            const newId = genUniqueId('user_voice');
                            currentVoiceMessageIdRef.current = newId;
                            return [...prev, {
                                id: newId,
                                sender: 'user',
                                text: msg.text,
                                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }];
                        }
                    });
                } else if (msg.type === 'transcript') {
                    setTranscript(prev => {
                        if (prev === "Modo de voz listo. Di algo como: 'IA, agrega un sándwich de jamón'" || prev === "Transcriptor de voz desactivado.") {
                            return msg.text;
                        }
                        return prev + msg.text;
                    });
                    currentVoiceMessageIdRef.current = null;
                    setMessages(prev => {
                        const targetId = currentAiMessageIdRef.current;
                        const existing = targetId ? prev.find(m => m.id === targetId) : null;
                        if (existing) {
                            return prev.map(m => m.id === targetId ? { ...m, text: m.text + msg.text } : m);
                        } else {
                            const newId = genUniqueId('ai_voice');
                            currentAiMessageIdRef.current = newId;
                            return [...prev, {
                                id: newId,
                                sender: 'ai',
                                text: msg.text,
                                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }];
                        }
                    });
                } else if (msg.type === 'interrupted') {
                    if (isListeningRef.current && !isMutedRef.current) {
                        stopAllAudioPlayback();
                    }
                } else if (msg.type === 'error') {
                    setConnected(false);
                    setIsLiveActiveState(false);
                    setMessages(prev => [...prev, {
                        id: genUniqueId('sys_err'),
                        sender: 'system',
                        text: `⚠️ Error IA: ${msg.message || 'Error de conexión'}`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }]);
                }
            } catch (err: any) {
                console.warn("WS parse warning in client:", err?.message || String(err));
            }
        };
        wsRef.current = ws;

        return () => {
            ws.close();
            stopRecording();
            stopAllAudioPlayback();
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (_) {}
            }
        };
    }, [isLiveActive]);

    const startTranscriber = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setMessages(prev => [...prev, {
                id: genUniqueId('transcribe_err'),
                sender: 'system',
                text: "⚠️ Tu navegador no soporta el transcriptor por voz de la API Web Speech (ej. Chrome o Safari).",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
            return;
        }

        // Avoid multiple concurrent instances of SpeechRecognition running
        if (recognitionRef.current) {
            console.log("[Speech Engine] Cleaning up older active SpeechRecognition instance.");
            try {
                recognitionRef.current.onstart = null;
                recognitionRef.current.onresult = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.onend = null;
                recognitionRef.current.stop();
            } catch (_) {}
            recognitionRef.current = null;
        }

        if (isListening) {
            stopRecording();
        }

        try {
            const rec = new SpeechRecognition();
            rec.lang = 'es-ES';
            rec.continuous = true;
            rec.interimResults = true;

            rec.onstart = () => {
                setIsTranscribing(true);
                setTranscript("Transcriptor de voz activado. Habla para dictar texto...");
                setMessages(prev => [...prev, {
                    id: genUniqueId('transcribe_on'),
                    sender: 'system',
                    text: "✍️ Dictado por voz activado: lo que digas se transcribirá directamente en el campo de texto.",
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
            };

            rec.onresult = (event: any) => {
                let currentSpeech = '';
                for (let i = 0; i < event.results.length; i++) {
                    currentSpeech += event.results[i][0].transcript;
                }
                setTextCmd(currentSpeech);
            };

            rec.onerror = (e: any) => {
                console.warn("Transcription status error:", e);
                if (e.error !== 'no-speech') {
                    setIsTranscribing(false);
                }
            };

            rec.onend = () => {
                setIsTranscribing(false);
            };

            recognitionRef.current = rec;
            rec.start();
        } catch (err: any) {
            console.error("Failed to start speech dictation:", err);
            setIsTranscribing(false);
        }
    };

    const stopTranscriber = () => {
        if (recognitionRef.current) {
            try {
                recognitionRef.current.onstart = null;
                recognitionRef.current.onresult = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.onend = null;
                recognitionRef.current.stop();
            } catch (_) {}
            recognitionRef.current = null;
        }
        setIsTranscribing(false);
        setTranscript("Transcriptor de voz desactivado.");
        setMessages(prev => [...prev, {
            id: genUniqueId('transcribe_off'),
            sender: 'system',
            text: "🔌 Dictado por voz desactivado.",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
    };

    // Text alternative to communicate to operational neural engine
    const handleSendText = async () => {
        if (!textCmd.trim()) return;
        const textToSend = textCmd.trim();
        setTextCmd("");

        // Reset bubble reference tracking so we start a clean voice/text turn
        currentVoiceMessageIdRef.current = null;
        currentAiMessageIdRef.current = null;

        // Reset browser SpeechRecognition segment history if currently in dictation mode
        if (isTranscribing && recognitionRef.current) {
            try {
                const originalOnEnd = recognitionRef.current.onend;
                recognitionRef.current.onend = null;
                recognitionRef.current.stop();
                
                setTimeout(() => {
                    if (recognitionRef.current) {
                        try {
                            recognitionRef.current.onend = originalOnEnd;
                            recognitionRef.current.start();
                        } catch (_) {}
                    }
                }, 150);
            } catch (err) {
                console.warn("[Speech Engine] Error resetting recognition cache:", err);
            }
        }

        // Add user typed text bubble to messages log
        setMessages(prev => [...prev, {
            id: genUniqueId('user_text'),
            sender: 'user',
            text: textToSend,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);

        // If the live WebSocket connection is active, send it over WebSocket!
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            sendCartContext();
            wsRef.current.send(JSON.stringify({ text: textToSend }));
            setTranscript(`Procesando comando: "${textToSend}"`);
            return;
        }

        // If NOT in active voice session / WebSocket is closed, treat it as a REST chat request!
        setIsAnalyzing(true);
        setTranscript(`Procesando comando: "${textToSend}"`);
        try {
            const response = await fetch("/api/chat-text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: textToSend,
                    cart: cartRef.current
                })
            });

            if (!response.ok) {
                let errorMsg = "Error en respuesta del servidor chat-text";
                try {
                    const errData = await response.json();
                    if (errData && errData.error) {
                        errorMsg = errData.error;
                    }
                } catch (_) {}
                throw new Error(errorMsg);
            }

            const data = await response.json();
            const aiText = data.text || "Comando procesado por el cerebro operativo GTR.";

            setMessages(prev => [...prev, {
                id: genUniqueId('ai_text'),
                sender: 'ai',
                text: aiText,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                action: data.action || undefined
            }]);

            // Speak response if TTS is enabled
            if (isTtsActive) {
                speakText(aiText);
            }

            // Apply operations
            if (data.action && data.action.name) {
                // If the action is NOT propose, execute immediately
                if (!data.action.name.startsWith("propose")) {
                    handleAIAction(data.action.name, data.action.payload || {});
                }
            }
        } catch (err: any) {
            console.error("Text command processing issue:", err);
            setMessages(prev => [...prev, {
                id: genUniqueId('sys_err'),
                sender: 'system',
                text: `⚠️ Hubo un error al conectar con la IA: ${err.message || 'Intenta de nuevo.'}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (!hasPermission(user, 'access_ai')) {
        return null;
    }

    return (
        <div 
            style={{ 
                transform: `translate(${position.x}px, ${position.y}px)`,
                transition: isDragging.current ? 'none' : 'transform 0.1s ease-out'
            }}
            className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 pointer-events-none"
        >
            
            {/* Expanded Messenger-Style Window Chat Balloon */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.85, y: 35 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.85, y: 35 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                        className="pointer-events-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-[330px] sm:w-[370px] h-[500px] flex flex-col overflow-hidden"
                    >
                        
                        {/* Chat Header */}
                        <div 
                            onMouseDown={handleMouseDown}
                            onTouchStart={handleMouseDown}
                            className={`bg-gradient-to-r ${isAiSpeaking ? 'from-purple-600 via-indigo-600 to-blue-700' : 'from-blue-600 to-blue-700'} text-white px-4 py-3 pb-3.5 flex items-center justify-between select-none cursor-grab active:cursor-grabbing transition-colors duration-500`}
                        >
                            <div className="flex items-center gap-2 pointer-events-none">
                                <div className="p-1.5 bg-white/10 rounded-lg relative">
                                    <Sparkles size={16} className={`text-yellow-300 ${isAiSpeaking ? 'animate-bounce' : 'animate-pulse'}`} />
                                    {isAiSpeaking && (
                                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-400 rounded-full animate-ping" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-xs tracking-wide uppercase">Cerebro Operativo GTR</h3>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400 animate-ping'}`} />
                                        <span className="text-[10px] text-white/85 font-semibold font-mono lowercase">
                                            {connected ? (isAiSpeaking ? 'IA respondiendo...' : 'conectado en vivo') : 'desconectado'}
                                        </span>
                                        {isAiSpeaking && (
                                            <div className="flex items-end gap-0.5 h-2.5 ml-1.5 self-center shrink-0">
                                                <span className="w-0.5 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.8s' }} />
                                                <span className="w-0.5 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '0.7s' }} />
                                                <span className="w-0.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '0.9s' }} />
                                                <span className="w-0.5 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '450ms', animationDuration: '0.6s' }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsOpen(false);
                                }}
                                className="p-1 hover:bg-white/10 rounded-lg transition text-white/95 pointer-events-auto cursor-pointer"
                                title="Minimizar"
                            >
                                <Minus size={18} />
                            </button>
                        </div>

                        {/* Chat Body (Message log with scrolling feed) */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/70 dark:bg-gray-950/20">
                            {messages.map((m) => {
                                if (m.sender === 'system') {
                                    return (
                                        <motion.div 
                                            key={m.id} 
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="flex justify-center select-none py-1"
                                        >
                                            <div className="bg-blue-50/90 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl px-3 py-1 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
                                                <span>{m.text}</span>
                                            </div>
                                        </motion.div>
                                    );
                                }

                                const isUser = m.sender === 'user';
                                return (
                                    <motion.div 
                                        key={m.id} 
                                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.18, ease: "easeOut" }}
                                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                                    >
                                    <div className="flex items-end gap-1.5">
                                        {!isUser && (
                                            <div className="w-6 h-6 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center shrink-0 border border-blue-400/20 self-end mb-1">
                                                <Sparkles size={11} className="text-blue-500" />
                                            </div>
                                        )}
                                        <div 
                                            className={`max-w-[220px] px-3.5 py-2.5 text-xs font-semibold rounded-2xl leading-relaxed shadow-xs flex flex-col gap-1.5 ${
                                                isUser 
                                                    ? 'bg-blue-600 text-white rounded-tr-xs' 
                                                    : 'bg-white dark:bg-gray-850 text-gray-800 dark:text-gray-200 border border-gray-150/90 dark:border-gray-800/80 rounded-tl-xs'
                                            }`}
                                        >
                                            {m.imageUrl && (
                                                <img 
                                                    src={m.imageUrl} 
                                                    alt="Archivo" 
                                                    className="max-w-[180px] max-h-[140px] rounded-xl object-cover border border-black/10 dark:border-white/10"
                                                    referrerPolicy="no-referrer"
                                                />
                                            )}
                                            {m.imageUrls && m.imageUrls.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1 max-w-[200px]">
                                                    {m.imageUrls.map((url, uidx) => (
                                                        <img 
                                                            key={uidx}
                                                            src={url} 
                                                            alt={`Archivo ${uidx + 1}`} 
                                                            className="w-12 h-12 rounded-lg object-cover border border-black/10 dark:border-white/10"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            <div className="relative group/copy text-start flex flex-col gap-1.5 w-full">
                                                <div className="whitespace-pre-wrap break-words pr-2">{m.text}</div>
                                                <div className="flex justify-end pt-1 border-t border-gray-150/40 dark:border-gray-800/40 text-[9px]">
                                                    <button
                                                        onClick={() => handleCopyMessageText(m.id, m.text)}
                                                        className="flex items-center gap-1 hover:text-blue-500 text-gray-400 dark:text-gray-500 transition cursor-pointer pointer-events-auto select-none"
                                                        title="Copiar texto de diagnóstico"
                                                    >
                                                        {copiedMessageId === m.id ? (
                                                            <>
                                                                <Check size={11} className="text-emerald-500" />
                                                                <span className="text-emerald-500 font-bold">¡Copiado!</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy size={11} />
                                                                <span>Copiar</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            {m.action && m.action.name === 'proposeAddProductToCart' && m.action.payload && (
                                                <div className="mt-2.5 p-2 bg-blue-50/50 dark:bg-gray-900 border border-blue-100 dark:border-gray-800 rounded-xl flex flex-col gap-1.5 text-[11px] font-sans">
                                                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider text-[8px]">
                                                        <ShoppingBag size={10} />
                                                        <span>Registrado</span>
                                                    </div>
                                                    <div className="font-bold text-gray-950 dark:text-white leading-snug">
                                                        {m.action.payload.productName || m.action.payload.name}
                                                    </div>
                                                    <div className="text-[9px] text-gray-500 font-mono">
                                                        SKU: {m.action.payload.sku}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            handleAIAction('addProductToCart', m.action.payload);
                                                            setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, _processed: true } : msg));
                                                        }}
                                                        disabled={m._processed}
                                                        className={`w-full py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 group transition cursor-pointer pointer-events-auto ${
                                                            m._processed 
                                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600' 
                                                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                                        }`}
                                                    >
                                                        <ShoppingCart size={11} />
                                                        {m._processed ? 'En Carrito' : 'Agregar Carrito'}
                                                    </button>
                                                </div>
                                            )}

                                            {m.action && m.action.name === 'proposeCreateProduct' && m.action.payload && (
                                                <div className="mt-2.5 p-2 bg-amber-50/60 dark:bg-gray-900 border border-amber-100/50 dark:border-gray-800 rounded-xl flex flex-col gap-1 text-[11px] font-sans">
                                                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider text-[8px]">
                                                        <PlusCircle size={10} />
                                                        <span>Registrar Producto</span>
                                                    </div>
                                                    
                                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                                        <span className="text-[8px] text-gray-500 uppercase font-extrabold">Nombre</span>
                                                        <input 
                                                            type="text" 
                                                            defaultValue={m.action.payload.name}
                                                            onChange={(e) => { m.action.payload.name = e.target.value; }}
                                                            className="px-1.5 py-0.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded text-[10px] text-gray-950 dark:text-white pointer-events-auto focus:ring-1 focus:ring-amber-500"
                                                        />
                                                    </div>

                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[8px] text-gray-500 uppercase font-extrabold">SKU / Código</span>
                                                        <input 
                                                            type="text" 
                                                            defaultValue={m.action.payload.sku}
                                                            onChange={(e) => { m.action.payload.sku = e.target.value; }}
                                                            className="px-1.5 py-0.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded font-mono text-[10px] text-gray-950 dark:text-white pointer-events-auto focus:ring-1 focus:ring-amber-500"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-1 mt-0.5">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[8px] text-gray-500 uppercase font-extrabold">Precio (Bs)</span>
                                                            <input 
                                                                type="number" 
                                                                step="any"
                                                                defaultValue={m.action.payload.price_unit}
                                                                onChange={(e) => { m.action.payload.price_unit = parseFloat(e.target.value) || 0; }}
                                                                className="px-1.5 py-0.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded font-sans text-[10px] font-bold text-gray-950 dark:text-white pointer-events-auto focus:ring-1 focus:ring-amber-500"
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[8px] text-gray-500 uppercase font-extrabold">Stock</span>
                                                            <input 
                                                                type="number" 
                                                                defaultValue={m.action.payload.stock}
                                                                onChange={(e) => { m.action.payload.stock = parseInt(e.target.value) || 0; }}
                                                                className="px-1.5 py-0.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded font-sans text-[10px] font-bold text-gray-950 dark:text-white pointer-events-auto focus:ring-1 focus:ring-amber-500"
                                                            />
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => {
                                                            handleAIAction('createProduct', m.action.payload);
                                                            setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, _processed: true } : msg));
                                                        }}
                                                        disabled={m._processed}
                                                        className={`w-full mt-1.5 py-1.5 rounded-lg font-bold text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 group transition cursor-pointer pointer-events-auto ${
                                                            m._processed 
                                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600' 
                                                                : 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                                                        }`}
                                                    >
                                                        <Check size={11} />
                                                        {m._processed ? 'Registrado' : 'Registrar'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-1 pb-0.5">
                                        <span className="text-[9px] text-gray-400 dark:text-gray-500 font-bold select-none font-mono">
                                            {m.time}
                                        </span>
                                        {!isUser && (
                                            <button
                                                onClick={() => speakText(m.text)}
                                                className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition active:scale-95 cursor-pointer flex items-center gap-0.5"
                                                title="Reproducir respuesta en voz alta"
                                            >
                                                <Volume2 size={10} className="text-gray-400 hover:text-blue-500 transition-colors" />
                                                <span className="text-[8px] font-extrabold uppercase tracking-wide">Escuchar</span>
                                            </button>
                                        )}
                                    </div>
                                    </motion.div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                    {/* Chat Footer Actions */}
                    <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xs flex flex-col gap-2">
                        
                        {/* Camera Preview rendering block inside Messenger */}
                        {isCameraActive && (
                            <div className="mx-0.5 my-1 border border-blue-100 dark:border-blue-900/40 bg-black rounded-xl overflow-hidden relative shadow-md">
                                <video ref={videoRef} className="w-full h-[140px] object-cover scale-x-[-1]" playsInline muted />
                                <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1.5 px-3">
                                    <button
                                        onClick={capturePhoto}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9px] px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer"
                                    >
                                        <Camera size={10} />
                                        Capturar Foto
                                    </button>
                                    <button
                                        onClick={stopCamera}
                                        className="bg-gray-800/80 hover:bg-gray-800 text-white font-bold text-[9px] px-2.5 py-1 rounded-full shadow-md transition active:scale-95 cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Image preview indicator before sending */}
                        {imagePreviews.length > 0 && (
                            <div className={`mx-0.5 p-2 bg-gray-50 dark:bg-gray-950/80 border ${isAnalyzing ? 'border-green-400/50 shadow-sm shadow-green-500/10' : 'border-gray-150/50 dark:border-gray-800/60'} rounded-xl flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150 transition-colors`}>
                                <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto">
                                    {imagePreviews.map((preview, idx) => (
                                        <div key={idx} className="relative overflow-hidden w-11 h-11 rounded-lg shrink-0">
                                            <img 
                                                src={preview} 
                                                alt={`Miniatura ${idx + 1}`} 
                                                className="w-11 h-11 rounded-lg object-cover border border-gray-200 dark:border-gray-800"
                                                referrerPolicy="no-referrer"
                                            />
                                            {isAnalyzing && (
                                                <motion.div
                                                    className="absolute top-0 left-0 right-0 h-0.5 bg-green-400 shadow-[0_0_8px_rgba(74,222,128,1)]"
                                                    initial={{ y: 0 }}
                                                    animate={{ y: 39 }}
                                                    transition={{
                                                        repeat: Infinity,
                                                        repeatType: "reverse",
                                                        duration: 1.0,
                                                        ease: "easeInOut"
                                                    }}
                                                />
                                            )}
                                            <button
                                                onClick={() => {
                                                    const updated = [...imagePreviews];
                                                    updated.splice(idx, 1);
                                                    setImagePreviews(updated);
                                                    setLatestAnalysisText("");
                                                    setLatestAnalysisAction(null);
                                                    backgroundAnalysisRef.current = null;
                                                }}
                                                className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition shadow-md hover:scale-105 active:scale-95 cursor-pointer z-10"
                                                title="Quitar imagen"
                                                disabled={isAnalyzing}
                                            >
                                                <X size={8} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[9px] font-bold uppercase tracking-wide ${isAnalyzing ? 'text-green-600 dark:text-green-400 animate-pulse' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {isAnalyzing ? 'Escaneando Producto GTR...' : `Imágenes cargadas (${imagePreviews.length})`}
                                    </p>
                                    <p className="text-[8px] text-gray-400 dark:text-gray-500 font-medium truncate">
                                        {isAnalyzing ? 'Identificando y procesando con Inteligencia GTR...' : 'Escribe instrucciones y presiona enviar'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Loading / analyzing overlay status */}
                        {isAnalyzing && (
                            <div className="flex justify-center select-none py-1.5 animate-in fade-in zoom-in-95 duration-100">
                                <div className="bg-blue-50/90 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 rounded-xl px-3 py-1 text-[9px] font-bold tracking-wider uppercase flex items-center gap-1.5">
                                    <Loader size={12} className="animate-spin text-blue-500" />
                                    <span>IA está analizando tu imagen...</span>
                                </div>
                            </div>
                        )}

                        {/* Media and Microphone Control Toolbar */}
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-1.5 mb-1 px-0.5">
                            <div className="flex items-center gap-1.5">
                                {/* Camera input trigger */}
                                <button 
                                    type="button"
                                    onClick={isCameraActive ? stopCamera : startCamera}
                                    className={`p-1.5 rounded-lg transition hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 ${isCameraActive ? 'bg-red-50 text-red-500 dark:bg-red-950/20' : ''}`}
                                    title="Tomar fotografía con cámara"
                                >
                                    <Camera size={14} />
                                </button>

                                {/* File input trigger */}
                                <button 
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-1.5 rounded-lg transition hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
                                    title="Subir archivo/imagen"
                                >
                                    <Upload size={14} />
                                </button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    accept="image/*" 
                                    multiple
                                    className="hidden" 
                                    onChange={handleFileUpload} 
                                />

                                {/* Automatic voice output (TTS) read aloud toggle */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextVal = !isTtsActive;
                                        setIsTtsActive(nextVal);
                                        try {
                                            localStorage.setItem('isTtsActive', String(nextVal));
                                        } catch (_) {}
                                        if (!nextVal && window.speechSynthesis) {
                                            window.speechSynthesis.cancel();
                                        }
                                    }}
                                    className={`p-1 text-xs font-bold flex items-center gap-1 transition rounded-lg border ${
                                        isTtsActive 
                                            ? 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/50' 
                                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border-transparent'
                                    }`}
                                    title={isTtsActive ? "Voz de Análisis de Imagen: ACTIVADA (la IA leerá las respuestas en voz alta)" : "Voz de Análisis de Imagen: DESACTIVADA (solo texto)"}
                                >
                                    {isTtsActive ? <Volume2 size={13} className="text-purple-500 animate-pulse" /> : <VolumeX size={13} />}
                                    <span className="text-[9px] font-extrabold uppercase select-none tracking-tight">
                                        {isTtsActive ? 'Voz On' : 'Voz Off'}
                                    </span>
                                </button>
                            </div>

                            {/* Microphone mute switcher */}
                            {isListening && (
                                <button
                                    type="button"
                                    onClick={toggleMute}
                                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase transition-colors duration-150 border cursor-pointer ${
                                        isMuted 
                                            ? 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-900/40 animate-pulse' 
                                            : 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 border-green-300 dark:border-green-900/40'
                                    }`}
                                    title={isMuted ? "Quitar silencio de micrófono" : "Silenciar micrófono"}
                                >
                                    {isMuted ? <MicOff size={10} className="inline animate-pulse" /> : <Mic size={10} className="inline text-green-500" />}
                                    <span>{isMuted ? 'Micrófono Silenciado' : 'Micrófono Vivo'}</span>
                                </button>
                            )}
                        </div>

                        {/* Real-time spectrum voice wave visualizer */}
                        {(isListening || isAiSpeaking) && (
                            <div className={`mx-0.5 p-2.5 border rounded-xl flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-205 ${
                                isAiSpeaking 
                                    ? 'bg-blue-500/10 border-blue-300/30 dark:border-blue-900/40' 
                                    : 'bg-red-500/10 dark:bg-red-500/5 border-red-300/30 dark:border-red-900/40'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <span className={`flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest animate-pulse ${
                                        isAiSpeaking ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full animate-ping ${isAiSpeaking ? 'bg-blue-500' : 'bg-red-500'}`} />
                                        {isAiSpeaking ? 'IA respondiendo...' : isMuted ? 'Micrófono Silenciado' : 'Transmitiendo voz en vivo'}
                                    </span>
                                    <span className={`text-[9px] font-mono font-bold uppercase ${
                                        isAiSpeaking ? 'text-blue-500/80' : 'text-red-500/80'
                                    }`}>
                                        {isAiSpeaking ? 'Voz de salida' : isMuted ? 'Mute' : `${Math.round(audioLevel * 105)}% SPL`}
                                    </span>
                                </div>
                                
                                {/* Sound Bar Wave Spectrum */}
                                <div className="flex items-end justify-center gap-1 h-10 bg-black/5 dark:bg-black/35 py-1.5 rounded-lg px-2 text-center select-none overflow-hidden">
                                    {[0.3, 0.5, 0.8, 1.1, 0.7, 0.9, 1.2, 0.8, 1.0, 0.6, 0.4, 0.2].map((scale, idx) => {
                                        let finalBarHeight = 3;
                                        if (isAiSpeaking) {
                                            // Beautiful smooth dancing wave animation for the AI's speaking voice spectrum
                                            finalBarHeight = Math.max(3, Math.sin(Date.now() / 90 + idx * 0.7) * 11 + 16);
                                        } else if (isListening && !isMuted) {
                                            const baseMovement = Math.sin(Date.now() / 80 + idx) * 3 + 4;
                                            const reactiveHeight = audioLevel * 25;
                                            finalBarHeight = Math.max(3, reactiveHeight * scale + baseMovement);
                                        }
                                        const shadowRadius = isAiSpeaking ? 4 : isMuted ? 0 : audioLevel * 8;
                                        return (
                                            <motion.div
                                                key={idx}
                                                className={`w-1.5 rounded-full ${
                                                    isAiSpeaking 
                                                        ? 'bg-gradient-to-t from-blue-600 via-indigo-500 to-cyan-400' 
                                                        : 'bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400'
                                                }`}
                                                style={{
                                                    height: `${finalBarHeight}px`,
                                                    filter: shadowRadius > 0 ? `drop-shadow(0 0 ${shadowRadius}px ${isAiSpeaking ? 'rgba(59, 130, 246, 0.8)' : 'rgba(239, 68, 68, 0.8)'})` : 'none'
                                                }}
                                                animate={{ height: finalBarHeight }}
                                                transition={{ type: 'spring', damping: 20, stiffness: 350 }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-1.5">
                            <input 
                                type="text" 
                                placeholder="Escribe un comando..." 
                                className="flex-1 text-xs px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 dark:bg-gray-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold transition-all text-ellipsis"
                                value={textCmd}
                                onChange={e => setTextCmd(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (imagePreviews.length > 0 ? handleSendWithAnalysis() : handleSendText())}
                            />
                            
                            {/* Speech Transcriber Button */}
                            <motion.button 
                                type="button"
                                onClick={isTranscribing ? stopTranscriber : startTranscriber}
                                whileHover={{ scale: 1.1, boxShadow: "0px 0px 15px rgba(124, 58, 237, 0.45)" }}
                                whileTap={{ scale: 0.9 }}
                                className={`relative p-2.5 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden flex items-center justify-center min-w-[42px] h-[42px] ${
                                    isTranscribing 
                                        ? 'bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-700 text-white border-violet-500 shadow-lg shadow-violet-500/30' 
                                        : 'bg-violet-50/90 hover:bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/50'
                                }`}
                                title={isTranscribing ? "Detener Dictado de Voz" : "Dictar y transcribir voz a texto manualmente (Dictado)"}
                            >
                                {/* Glowing Aura Waves for Attention Grabber */}
                                {isTranscribing && (
                                    <>
                                        <motion.span 
                                            className="absolute inset-0 rounded-xl bg-violet-400/40"
                                            initial={{ scale: 1, opacity: 0.6 }}
                                            animate={{ scale: 1.8, opacity: 0 }}
                                            transition={{ repeat: Infinity, duration: 1.2, ease: "easeOut" }}
                                        />
                                        <motion.span 
                                            className="absolute inset-0 rounded-xl bg-fuchsia-400/30"
                                            initial={{ scale: 1, opacity: 0.4 }}
                                            animate={{ scale: 1.4, opacity: 0 }}
                                            transition={{ repeat: Infinity, duration: 1.6, ease: "easeOut", delay: 0.3 }}
                                        />
                                    </>
                                )}
                                
                                {/* Dynamic Mobile Icon */}
                                <div className="relative z-10 flex items-center justify-center">
                                    {isTranscribing ? (
                                        <div className="flex items-center gap-1">
                                            <Loader size={15} className="animate-spin text-white" />
                                            <motion.div 
                                                className="w-1.5 h-1.5 bg-red-400 rounded-full"
                                                animate={{ scale: [1, 1.5, 1] }}
                                                transition={{ repeat: Infinity, duration: 0.8 }}
                                            />
                                        </div>
                                    ) : (
                                        <motion.div
                                            whileHover={{ y: -1 }}
                                            className="flex items-center justify-center"
                                        >
                                            <FileText size={15} />
                                        </motion.div>
                                    )}
                                </div>
                            </motion.button>

                            {/* Center Send Button */}
                            <button 
                                onClick={imagePreviews.length > 0 ? handleSendWithAnalysis : handleSendText}
                                disabled={isAnalyzing || (!textCmd.trim() && imagePreviews.length === 0)}
                                className="p-2.5 bg-blue-50/80 hover:bg-blue-100 active:scale-95 text-blue-600 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 rounded-xl transition disabled:opacity-50 cursor-pointer h-[42px] min-w-[42px] flex items-center justify-center border border-transparent"
                                title="Enviar comando"
                            >
                                {isAnalyzing ? <Loader size={15} className="animate-spin text-blue-500" /> : <Send size={15} />}
                            </button>

                            {/* Live Audio Mic Button */}
                            <motion.button 
                                type="button"
                                onClick={() => setIsLiveActive(!isLiveActive)}
                                whileHover={{ scale: 1.1, boxShadow: "0px 0px 15px rgba(124, 58, 237, 0.45)" }}
                                whileTap={{ scale: 0.9 }}
                                className={`relative p-2.5 rounded-xl border font-bold transition-all duration-200 cursor-pointer overflow-hidden flex items-center justify-center min-w-[42px] h-[42px] ${
                                    isLiveActive 
                                        ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-700 text-white border-violet-500 shadow-lg shadow-violet-500/30' 
                                        : 'bg-violet-50/90 hover:bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-955/20 dark:text-violet-400 dark:border-violet-900/50'
                                }`}
                                style={isLiveActive && !isMuted ? {
                                    boxShadow: `0 0 ${12 + audioLevel * 30}px rgba(139, 92, 246, ${0.4 + audioLevel * 0.6})`,
                                } : {}}
                                title={isLiveActive ? "Apagar IA de Voz en Vivo" : "Hablar con la IA en vivo (Modo Realtime)"}
                            >
                                {/* Glowing Aura Waves for Attention Grabber */}
                                {isLiveActive && (
                                    <>
                                        <motion.span 
                                            className="absolute inset-0 rounded-xl bg-violet-400/40"
                                            initial={{ scale: 1, opacity: 0.6 }}
                                            animate={{ scale: 1.8 + audioLevel * 0.8, opacity: 0 }}
                                            transition={{ repeat: Infinity, duration: 1.2, ease: "easeOut" }}
                                        />
                                        <motion.span 
                                            className="absolute inset-0 rounded-xl bg-indigo-400/30"
                                            initial={{ scale: 1, opacity: 0.4 }}
                                            animate={{ scale: 1.4 + audioLevel * 0.5, opacity: 0 }}
                                            transition={{ repeat: Infinity, duration: 1.6, ease: "easeOut", delay: 0.3 }}
                                        />
                                    </>
                                )}
                                
                                {/* Dynamic Mobile Icon */}
                                <div className="relative z-10 flex items-center justify-center">
                                    {isLiveActive ? (
                                        isMuted ? (
                                            <MicOff size={15} className="text-white/80 animate-pulse" />
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                {/* Animated sound wave bars */}
                                                <div className="flex items-center gap-0.5 h-3.5 px-0.5">
                                                    <motion.div 
                                                        className="w-0.5 bg-white rounded-full"
                                                        animate={{ height: [4, 12, 4] }}
                                                        transition={{ repeat: Infinity, duration: 0.5, ease: "easeInOut" }}
                                                        style={{ height: 4 }}
                                                    />
                                                    <motion.div 
                                                        className="w-0.5 bg-white rounded-full"
                                                        animate={{ height: [6, 16, 6] }}
                                                        transition={{ repeat: Infinity, duration: 0.4, ease: "easeInOut", delay: 0.15 }}
                                                        style={{ height: 6 }}
                                                    />
                                                    <motion.div 
                                                        className="w-0.5 bg-white rounded-full"
                                                        animate={{ height: [4, 10, 4] }}
                                                        transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut", delay: 0.3 }}
                                                        style={{ height: 4 }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    ) : (
                                        <motion.div
                                            whileHover={{ y: -1 }}
                                            className="flex items-center justify-center"
                                        >
                                            <Mic size={15} />
                                        </motion.div>
                                    )}
                                </div>
                            </motion.button>
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-gray-400 font-bold tracking-wide uppercase select-none mt-0.5">
                            <span className="flex items-center gap-1 select-none">
                                <Info size={11} className="text-gray-400" />
                                Ej: "Agrega 2 hamburguesas", "cobrar con tarjeta"
                            </span>
                        </div>
                    </div>
                </motion.div>
            )}
            </AnimatePresence>

            {/* Messenger Floating Launcher Bubble/Badge - Only visible when open to offer draggable close toggle, hidden when closed */}
            {isOpen && (
                <div className="flex items-center gap-2 pointer-events-auto select-none">
                    
                    {/* Floating tooltip clue on hover */}
                    {!isOpen && (
                        <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-full px-3.5 py-1.5 shadow-lg flex items-center gap-1.5 animate-bounce text-xs font-bold text-gray-700 dark:text-gray-300">
                            <Sparkles size={12} className="text-blue-500 animate-pulse" />
                            <span>Mueve la IA aquí:</span>
                        </div>
                    )}

                    {/* Floating Round Action Icon Button */}
                    <motion.button
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleMouseDown}
                        onClick={(e) => {
                            if (hasDragged.current) {
                                e.preventDefault();
                                e.stopPropagation();
                                return;
                            }
                            setIsOpen(!isOpen);
                        }}
                        style={{
                            boxShadow: isAiSpeaking
                                ? `0 0 25px rgba(59, 130, 246, 0.65)`
                                : isLiveActive 
                                    ? `0 0 ${15 + audioLevel * 30}px rgba(239, 68, 68, ${0.4 + audioLevel * 0.6})` 
                                    : '0 10px 25px -5px rgba(59, 130, 246, 0.35)',
                            scale: isLiveActive ? 1 + audioLevel * 0.08 : 1
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center relative cursor-grab active:cursor-grabbing outline-none focus:ring-4 focus:ring-blue-500/20 transition-all ${
                            isOpen 
                                ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-900 rotate-90 shadow-2xl' 
                                : isAiSpeaking 
                                    ? 'bg-blue-600 text-white shadow-blue-500/40'
                                    : isLiveActive 
                                        ? 'bg-red-600 text-white shadow-red-500/30'
                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/25'
                        }`}
                    >
                        {/* Ring aura expanding animation when user is talking / listening or AI is speaking */}
                        {(isAiSpeaking || (isLiveActive && !isMuted)) && (
                            <>
                                <motion.span 
                                    className={`absolute inset-0 rounded-full ${isAiSpeaking ? 'bg-blue-500/30' : 'bg-red-500/30'}`}
                                    initial={{ scale: 1, opacity: 0.6 }}
                                    animate={{ scale: isAiSpeaking ? 1.6 : 1.8 + audioLevel * 0.7, opacity: 0 }}
                                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                                />
                                <motion.span 
                                    className={`absolute inset-0 rounded-full ${isAiSpeaking ? 'bg-indigo-400/20' : 'bg-red-400/20'}`}
                                    initial={{ scale: 1, opacity: 0.4 }}
                                    animate={{ scale: isAiSpeaking ? 1.25 : 1.4 + audioLevel * 1.0, opacity: 0 }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.5 }}
                                />
                            </>
                        )}
                        
                        {!isOpen && isAiSpeaking && (
                            <Bot size={24} className="animate-pulse text-white dark:text-gray-900" />
                        )}
                        {!isOpen && !isAiSpeaking && isLiveActive && (
                            <Mic size={24} className={isMuted ? 'opacity-65' : 'animate-pulse'} />
                        )}
                        {!isOpen && !isAiSpeaking && !isLiveActive && (
                            <Sparkles size={24} className="hover:rotate-12 transition-transform" />
                        )}
                        {isOpen && (
                            <X size={24} />
                        )}

                        {/* Little Online/Offline status light badge in the bubble */}
                        <span className={`absolute top-0 right-0 w-4.5 h-4.5 rounded-full border-2 border-white dark:border-gray-950 flex items-center justify-center shadow-sm ${
                            connected ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                    </motion.button>
                </div>
            )}

        </div>
    );
}
