import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Download, Monitor, Smartphone, Apple, CheckCircle2, 
    ExternalLink, Sparkles, X, ShieldCheck, Zap, Laptop, 
    Layers, HelpCircle, HardDrive, WifiOff, Maximize2, RefreshCw
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface PWAInstallModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function PWAInstallModal({ isOpen, onClose }: PWAInstallModalProps) {
    const { 
        pwaPrompt, setPwaPrompt, isPwaInstalled, setIsPwaInstalled,
        hasPwaUpdate, isUpdatingPwa, pwaUpdateStepMessage, pwaVersionInfo, checkForPwaUpdates, applyPwaUpdate
    } = useAppContext();
    const [activeOsTab, setActiveOsTab] = useState<'desktop' | 'android' | 'ios'>('desktop');
    const [isInIframe, setIsInIframe] = useState<boolean>(false);
    const [isStandalone, setIsStandalone] = useState<boolean>(false);
    const [installStatus, setInstallStatus] = useState<'idle' | 'installing' | 'success'>('idle');
    const [isCheckingUpdates, setIsCheckingUpdates] = useState<boolean>(false);
    const [updateCheckMsg, setUpdateCheckMsg] = useState<string | null>(null);

    useEffect(() => {
        try {
            setIsInIframe(window.self !== window.top);
        } catch {
            setIsInIframe(true);
        }

        const standaloneCheck = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        setIsStandalone(standaloneCheck);

        // Auto-detect OS
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        if (/android/i.test(userAgent)) {
            setActiveOsTab('android');
        } else if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
            setActiveOsTab('ios');
        } else {
            setActiveOsTab('desktop');
        }
    }, [isOpen]);

    const handleCheckUpdatesNow = async () => {
        setIsCheckingUpdates(true);
        setUpdateCheckMsg(null);
        try {
            const found = await checkForPwaUpdates();
            if (found) {
                setUpdateCheckMsg('¡Nueva versión encontrada! Lista para actualizar.');
            } else {
                setUpdateCheckMsg('La aplicación ya cuenta con la versión más reciente.');
            }
        } catch {
            setUpdateCheckMsg('No fue posible consultar el servidor en este momento.');
        } finally {
            setIsCheckingUpdates(false);
            setTimeout(() => setUpdateCheckMsg(null), 4000);
        }
    };

    const handleNativeInstall = async () => {
        if (pwaPrompt) {
            try {
                setInstallStatus('installing');
                pwaPrompt.prompt();
                const { outcome } = await pwaPrompt.userChoice;
                if (outcome === 'accepted') {
                    setInstallStatus('success');
                    setIsPwaInstalled(true);
                    localStorage.setItem('pwa_installed', 'true');
                    setPwaPrompt(null);
                    setTimeout(() => {
                        onClose();
                    }, 1800);
                } else {
                    setInstallStatus('idle');
                }
            } catch (err) {
                console.error("Error triggering native PWA prompt:", err);
                setInstallStatus('idle');
            }
        } else {
            // If in iframe or no prompt yet, open full window to trigger browser prompt
            handleOpenInStandaloneWindow();
        }
    };

    const handleOpenInStandaloneWindow = () => {
        const appUrl = window.location.origin;
        window.open(appUrl, '_blank', 'noopener,noreferrer');
    };

    const handleDownloadDesktopLauncher = () => {
        const appUrl = window.location.origin;
        // Generate Windows .bat launcher that opens Chrome/Edge in standalone app mode
        const batContent = `@echo off
:: GTR POS - Acceso Directo de Aplicacion Nativa
title GTR POS Launcher
echo Iniciando GTR POS en modo aplicacion de escritorio...
start msedge --app="${appUrl}" || start chrome --app="${appUrl}" || start "" "${appUrl}"
exit
`;
        const blob = new Blob([batContent], { type: 'application/bat' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'GTR_POS_Escritorio.bat';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadUrlShortcut = () => {
        const appUrl = window.location.origin;
        // Generate standard .url internet shortcut
        const urlContent = `[InternetShortcut]
URL=${appUrl}
IconIndex=0
IconFile=${appUrl}/icon.svg
HotKey=0
IDList=
`;
        const blob = new Blob([urlContent], { type: 'application/internet-shortcut' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'GTR_POS.url';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 15 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white dark:bg-[#0c111e] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl flex flex-col gap-6 max-h-[92vh] overflow-y-auto text-slate-800 dark:text-slate-100"
                    id="pwa-install-modal-container"
                >
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-850/80 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl shadow-md shadow-indigo-500/20">
                                <Download size={22} className="animate-bounce" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                        Instalar GTR POS
                                    </h2>
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50">
                                        PWA Nativa
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                    Ejecución en ventana independiente sin barras de navegador y con rendimiento acelerado.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Standalone Live Status Alert */}
                    {isStandalone ? (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold">
                            <div className="flex items-center gap-2.5">
                                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                                <span>¡GTR POS ya está ejecutándose como aplicación instalada e independiente!</span>
                            </div>
                            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                                Activo
                            </span>
                        </div>
                    ) : isInIframe ? (
                        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-2xl flex items-start gap-2.5 text-xs font-semibold">
                            <Zap size={17} className="text-amber-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <span className="font-extrabold block">Vista en Marco / Vista Previa Detectada</span>
                                <p className="text-[11px] font-normal leading-relaxed opacity-90">
                                    Para instalar la aplicación con 1 clic en tu sistema operativo, abre GTR POS en una ventana completa usando el botón principal inferior.
                                </p>
                            </div>
                        </div>
                    ) : null}

                    {/* Primary Direct Action Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {hasPwaUpdate ? (
                            <button
                                type="button"
                                onClick={applyPwaUpdate}
                                disabled={isUpdatingPwa}
                                className="w-full py-4 px-5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2.5 transition active:scale-[0.98] cursor-pointer animate-pulse"
                            >
                                {isUpdatingPwa ? (
                                    <div className="flex items-center gap-2 max-w-full">
                                        <RefreshCw size={16} className="animate-spin shrink-0" />
                                        <span className="font-mono text-xs truncate">{pwaUpdateStepMessage || 'Limpiando caché...'}</span>
                                    </div>
                                ) : (
                                    <>
                                        <Zap size={16} className="text-yellow-200 animate-bounce" />
                                        <span>Actualizar App Ahora (v{pwaVersionInfo.latestVersion})</span>
                                    </>
                                )}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleNativeInstall}
                                disabled={installStatus === 'installing'}
                                className="w-full py-4 px-5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2.5 transition active:scale-[0.98] cursor-pointer"
                            >
                                {installStatus === 'installing' ? (
                                    <span>Instalando en el sistema...</span>
                                ) : installStatus === 'success' ? (
                                    <>
                                        <CheckCircle2 size={16} className="text-emerald-300" />
                                        <span>¡Instalación Confirmada!</span>
                                    </>
                                ) : pwaPrompt ? (
                                    <>
                                        <Sparkles size={16} className="text-amber-300 animate-pulse" />
                                        <span>Instalar en este Dispositivo</span>
                                    </>
                                ) : (
                                    <>
                                        <ExternalLink size={16} />
                                        <span>Abrir e Instalar en Ventana Completa</span>
                                    </>
                                )}
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleCheckUpdatesNow}
                            disabled={isCheckingUpdates}
                            className="w-full py-4 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-xs uppercase tracking-wider border border-slate-200 dark:border-slate-750 flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                        >
                            <RefreshCw size={15} className={isCheckingUpdates ? 'animate-spin text-indigo-500' : ''} />
                            <span>{isCheckingUpdates ? 'Buscando...' : 'Comprobar Actualizaciones'}</span>
                        </button>
                    </div>

                    {updateCheckMsg && (
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-800/50 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 text-center animate-in fade-in">
                            {updateCheckMsg}
                        </div>
                    )}

                    {/* Desktop Native Launchers (1-click .bat / .url) */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                <HardDrive size={14} className="text-indigo-500" />
                                Accesos Directos de Escritorio para Windows / PC:
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">Descarga Directa</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                                type="button"
                                onClick={handleDownloadDesktopLauncher}
                                className="py-2.5 px-3 bg-white dark:bg-[#0c111e] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between transition cursor-pointer group"
                            >
                                <span className="flex items-center gap-2">
                                    <Monitor size={14} className="text-indigo-500" />
                                    <span>Lanzador App (.bat)</span>
                                </span>
                                <Download size={13} className="text-slate-400 group-hover:text-indigo-500 transition" />
                            </button>

                            <button
                                type="button"
                                onClick={handleDownloadUrlShortcut}
                                className="py-2.5 px-3 bg-white dark:bg-[#0c111e] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between transition cursor-pointer group"
                            >
                                <span className="flex items-center gap-2">
                                    <Laptop size={14} className="text-blue-500" />
                                    <span>Acceso Directo Web (.url)</span>
                                </span>
                                <Download size={13} className="text-slate-400 group-hover:text-blue-500 transition" />
                            </button>
                        </div>
                    </div>

                    {/* Step-by-Step Instructions Tabs */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-2">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                                Guía de Instalación según Dispositivo:
                            </span>
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                <button
                                    onClick={() => setActiveOsTab('desktop')}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                                        activeOsTab === 'desktop' 
                                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <Monitor size={13} />
                                    <span>PC / Mac</span>
                                </button>
                                <button
                                    onClick={() => setActiveOsTab('android')}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                                        activeOsTab === 'android' 
                                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <Smartphone size={13} />
                                    <span>Android</span>
                                </button>
                                <button
                                    onClick={() => setActiveOsTab('ios')}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition ${
                                        activeOsTab === 'ios' 
                                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <Apple size={13} />
                                    <span>iPhone / iOS</span>
                                </button>
                            </div>
                        </div>

                        {/* OS Specific Instruction Body */}
                        <div className="p-4 bg-slate-50/70 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs space-y-2.5">
                            {activeOsTab === 'desktop' && (
                                <ol className="space-y-2 text-slate-600 dark:text-slate-300 font-medium">
                                    <li className="flex items-start gap-2">
                                        <span className="font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded-md text-[10px]">1</span>
                                        <span>En <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>, abre la aplicación en una pestaña directa.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded-md text-[10px]">2</span>
                                        <span>Haz clic en el icono de instalación <strong>(pantalla con flecha hacia abajo ⤓)</strong> ubicado a la derecha de la barra de direcciones URL.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-1.5 py-0.5 rounded-md text-[10px]">3</span>
                                        <span>Selecciona <strong>"Instalar"</strong>. GTR POS se añadirá al menú de inicio y escritorio como una app nativa independiente.</span>
                                    </li>
                                </ol>
                            )}

                            {activeOsTab === 'android' && (
                                <ol className="space-y-2 text-slate-600 dark:text-slate-300 font-medium">
                                    <li className="flex items-start gap-2">
                                        <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded-md text-[10px]">1</span>
                                        <span>Abre GTR POS en <strong>Chrome</strong> en tu celular o tablet Android.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded-md text-[10px]">2</span>
                                        <span>Toca los <strong>3 puntos verticales (⋮)</strong> en la esquina superior derecha.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded-md text-[10px]">3</span>
                                        <span>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a la pantalla de inicio"</strong>.</span>
                                    </li>
                                </ol>
                            )}

                            {activeOsTab === 'ios' && (
                                <ol className="space-y-2 text-slate-600 dark:text-slate-300 font-medium">
                                    <li className="flex items-start gap-2">
                                        <span className="font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 rounded-md text-[10px]">1</span>
                                        <span>Abre GTR POS en <strong>Safari</strong> en tu iPhone o iPad.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 rounded-md text-[10px]">2</span>
                                        <span>Toca el botón <strong>Compartir (icono de cuadrado con flecha hacia arriba ↑)</strong>.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 rounded-md text-[10px]">3</span>
                                        <span>Desplaza hacia abajo y selecciona <strong>"Añadir a pantalla de inicio"</strong>.</span>
                                    </li>
                                </ol>
                            )}
                        </div>
                    </div>

                    {/* Features list */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850">
                            <span className="text-[10px] font-black uppercase text-indigo-500 block">100% Offline</span>
                            <span className="text-[10.5px] font-medium text-slate-600 dark:text-slate-400">Vende sin internet</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850">
                            <span className="text-[10px] font-black uppercase text-emerald-500 block">Velocidad</span>
                            <span className="text-[10.5px] font-medium text-slate-600 dark:text-slate-400">Caché instantánea</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850">
                            <span className="text-[10px] font-black uppercase text-amber-500 block">Sin Barras</span>
                            <span className="text-[10.5px] font-medium text-slate-600 dark:text-slate-400">Pantalla completa</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-850">
                            <span className="text-[10px] font-black uppercase text-purple-500 block">Hardware</span>
                            <span className="text-[10.5px] font-medium text-slate-600 dark:text-slate-400">Impresoras & Balanzas</span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end border-t border-slate-100 dark:border-slate-850/80 pt-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                        >
                            Cerrar
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
