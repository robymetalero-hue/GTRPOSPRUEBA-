import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, Cell, ReferenceLine
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Clock, RotateCw, ZoomIn, ZoomOut, Maximize2, Minimize2, 
    Sparkles, Trophy, Zap, Layers, RefreshCw, BarChart3, 
    HelpCircle, Eye, Compass, Move, Flame, ArrowUpRight
} from 'lucide-react';

export interface HourlySalesItem {
    hour: string;
    label: string;
    total: number;
    count: number;
    [key: string]: any;
}

interface ThreeDHourlySalesChartProps {
    data: HourlySalesItem[];
    exchangeRate?: number;
    isLoading?: boolean;
    isAdmin?: boolean;
    title?: string;
    subtitle?: string;
}

type MetricType = 'total' | 'count' | 'avgTicket';
type PresetView = 'isometric' | 'front' | 'dynamic' | 'top' | 'side';

export default function ThreeDHourlySalesChart({
    data = [],
    exchangeRate = 6.96,
    isLoading = false,
    isAdmin = true,
    title = "Rendimiento de Ventas por Hora (24h)",
    subtitle = "Gráfico volumétrico 3D interactivo con rotación espacial 360° y zoom táctil"
}: ThreeDHourlySalesChartProps) {
    // 3D Viewport transformation states
    const [is3DMode, setIs3DMode] = useState<boolean>(true);
    const [rotateX, setRotateX] = useState<number>(22);
    const [rotateY, setRotateY] = useState<number>(-24);
    const [zoom, setZoom] = useState<number>(1.02);
    const [isAutoRotating, setIsAutoRotating] = useState<boolean>(false);
    const [selectedMetric, setSelectedMetric] = useState<MetricType>('total');
    const [activePreset, setActivePreset] = useState<PresetView | 'custom'>('isometric');
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [showHelpHint, setShowHelpHint] = useState<boolean>(false);

    // Interaction tracking refs
    const stageRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef<boolean>(false);
    const lastPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const touchDistanceRef = useRef<number | null>(null);
    const autoRotateAnimRef = useRef<number | null>(null);

    // Prepare enriched 24h data
    const chartData = useMemo(() => {
        if (!data || data.length === 0) {
            return Array.from({ length: 24 }, (_, i) => {
                const hourStr = i.toString().padStart(2, '0');
                return {
                    hour: hourStr,
                    label: `${i}:00`,
                    total: 0,
                    count: 0,
                    avgTicket: 0,
                    usdTotal: 0
                };
            });
        }

        return data.map(item => {
            const total = Number(item.total) || 0;
            const count = Number(item.count) || 0;
            const avgTicket = count > 0 ? total / count : 0;
            const usdTotal = exchangeRate > 0 ? total / exchangeRate : 0;

            return {
                ...item,
                total,
                count,
                avgTicket,
                usdTotal
            };
        });
    }, [data, exchangeRate]);

    // Calculate aggregated metrics & peak hours
    const metricsSummary = useMemo(() => {
        let maxVal = 0;
        let peakItem: any = null;
        let grandTotal = 0;
        let grandCount = 0;
        let activeHoursCount = 0;

        chartData.forEach(item => {
            grandTotal += item.total;
            grandCount += item.count;
            if (item.total > 0 || item.count > 0) {
                activeHoursCount++;
            }

            const currentMetricVal = selectedMetric === 'total' 
                ? item.total 
                : selectedMetric === 'count' 
                    ? item.count 
                    : item.avgTicket;

            if (currentMetricVal > maxVal) {
                maxVal = currentMetricVal;
                peakItem = item;
            }
        });

        // Calculate best 3-hour consecutive window
        let best3hTotal = 0;
        let best3hStart = 0;
        for (let i = 0; i <= 21; i++) {
            const sum3 = (chartData[i]?.total || 0) + (chartData[i+1]?.total || 0) + (chartData[i+2]?.total || 0);
            if (sum3 > best3hTotal) {
                best3hTotal = sum3;
                best3hStart = i;
            }
        }

        const avgHourlySales = activeHoursCount > 0 ? grandTotal / activeHoursCount : 0;

        return {
            peakItem,
            maxVal,
            grandTotal,
            grandCount,
            activeHoursCount,
            avgHourlySales,
            best3hStart,
            best3hTotal
        };
    }, [chartData, selectedMetric]);

    // Apply preset viewing angles
    const applyPreset = useCallback((preset: PresetView) => {
        setIsAutoRotating(false);
        setActivePreset(preset);
        switch (preset) {
            case 'isometric':
                setRotateX(22);
                setRotateY(-25);
                setZoom(1.02);
                break;
            case 'front':
                setRotateX(8);
                setRotateY(0);
                setZoom(1.0);
                break;
            case 'dynamic':
                setRotateX(32);
                setRotateY(-42);
                setZoom(1.1);
                break;
            case 'top':
                setRotateX(58);
                setRotateY(-12);
                setZoom(1.05);
                break;
            case 'side':
                setRotateX(16);
                setRotateY(-65);
                setZoom(1.05);
                break;
        }
    }, []);

    // Reset 3D view
    const resetView = () => {
        applyPreset('isometric');
    };

    // Auto-rotation engine
    useEffect(() => {
        if (!isAutoRotating || !is3DMode) {
            if (autoRotateAnimRef.current) {
                cancelAnimationFrame(autoRotateAnimRef.current);
            }
            return;
        }

        let lastTime = performance.now();
        const loop = (time: number) => {
            const delta = (time - lastTime) / 1000;
            lastTime = time;
            setRotateY(prev => {
                const next = prev + delta * 18; // 18 deg/sec
                return next > 180 ? next - 360 : next;
            });
            autoRotateAnimRef.current = requestAnimationFrame(loop);
        };

        autoRotateAnimRef.current = requestAnimationFrame(loop);
        return () => {
            if (autoRotateAnimRef.current) cancelAnimationFrame(autoRotateAnimRef.current);
        };
    }, [isAutoRotating, is3DMode]);

    // Pointer & Mouse drag rotation handler
    const handlePointerDown = (e: React.PointerEvent) => {
        if (!is3DMode) return;
        isDraggingRef.current = true;
        lastPointerPosRef.current = { x: e.clientX, y: e.clientY };
        setIsAutoRotating(false);
        setActivePreset('custom');
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current || !is3DMode) return;
        const deltaX = e.clientX - lastPointerPosRef.current.x;
        const deltaY = e.clientY - lastPointerPosRef.current.y;
        lastPointerPosRef.current = { x: e.clientX, y: e.clientY };

        setRotateY(prev => {
            const next = prev + deltaX * 0.45;
            return next > 180 ? next - 360 : next < -180 ? next + 360 : next;
        });

        setRotateX(prev => {
            const next = prev - deltaY * 0.35;
            return Math.max(-10, Math.min(75, next)); // Clamp pitch
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDraggingRef.current = false;
        try {
            (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        } catch (err) {
            // Ignore if pointer capture release fails
        }
    };

    // Touch events for Pinch-to-Zoom & Multitouch gestures
    const handleTouchStart = (e: React.TouchEvent) => {
        if (!is3DMode) return;
        if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            touchDistanceRef.current = dist;
            setIsAutoRotating(false);
            setActivePreset('custom');
        } else if (e.touches.length === 1) {
            lastPointerPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            isDraggingRef.current = true;
            setIsAutoRotating(false);
            setActivePreset('custom');
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!is3DMode) return;
        if (e.touches.length === 2 && touchDistanceRef.current !== null) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const factor = dist / touchDistanceRef.current;
            setZoom(prev => Math.max(0.55, Math.min(2.2, prev * (1 + (factor - 1) * 0.6))));
            touchDistanceRef.current = dist;
        } else if (e.touches.length === 1 && isDraggingRef.current) {
            const deltaX = e.touches[0].clientX - lastPointerPosRef.current.x;
            const deltaY = e.touches[0].clientY - lastPointerPosRef.current.y;
            lastPointerPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

            setRotateY(prev => {
                const next = prev + deltaX * 0.5;
                return next > 180 ? next - 360 : next < -180 ? next + 360 : next;
            });
            setRotateX(prev => {
                const next = prev - deltaY * 0.4;
                return Math.max(-10, Math.min(75, next));
            });
        }
    };

    const handleTouchEnd = () => {
        touchDistanceRef.current = null;
        isDraggingRef.current = false;
    };

    // Wheel listener for smooth trackpad / mouse wheel zoom
    const handleWheel = (e: React.WheelEvent) => {
        if (!is3DMode) return;
        if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
            e.preventDefault();
            const delta = e.deltaY * -0.0015;
            setZoom(prev => Math.max(0.55, Math.min(2.2, prev + delta)));
            setActivePreset('custom');
        }
    };

    // Custom 3D SVG Bar Renderer with volumetric prism faces
    const render3DBar = (props: any) => {
        const { x, y, width, height, payload, index } = props;
        if (width <= 0 || isNaN(x) || isNaN(y)) return null;

        const val = selectedMetric === 'total' 
            ? payload.total 
            : selectedMetric === 'count' 
                ? payload.count 
                : payload.avgTicket;

        const isZero = val <= 0 || height <= 2;
        const isPeak = metricsSummary.peakItem && payload.hour === metricsSummary.peakItem.hour && val > 0;

        // Calculate dynamic 3D extrusion offsets based on rotation angles
        const radY = (rotateY * Math.PI) / 180;
        const radX = (rotateX * Math.PI) / 180;
        
        // Depth scale factors
        const depthX = is3DMode ? Math.sin(-radY) * 9 : 0;
        const depthY = is3DMode ? Math.sin(radX) * 9 : 0;
        const barHeight = Math.max(height, 2);

        // Color palettes
        const frontFill = isPeak 
            ? 'url(#peakFrontGrad)' 
            : isZero 
                ? 'rgba(148, 163, 184, 0.12)' 
                : 'url(#activeFrontGrad)';

        const topFill = isPeak 
            ? 'url(#peakTopGrad)' 
            : isZero 
                ? 'rgba(148, 163, 184, 0.18)' 
                : 'url(#activeTopGrad)';

        const sideFill = isPeak 
            ? 'url(#peakSideGrad)' 
            : isZero 
                ? 'rgba(100, 116, 139, 0.15)' 
                : 'url(#activeSideGrad)';

        return (
            <g className="transition-all duration-300 group cursor-pointer" key={`3d-bar-${index}`}>
                {/* Ground Shadow Projection in 3D */}
                {is3DMode && !isZero && (
                    <path
                        d={`M ${x},${y + barHeight} L ${x + depthX},${y + barHeight - depthY * 0.5} L ${x + width + depthX},${y + barHeight - depthY * 0.5} L ${x + width},${y + barHeight} Z`}
                        fill="rgba(0, 0, 0, 0.35)"
                        filter="blur(1.5px)"
                    />
                )}

                {/* Front Face */}
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={barHeight}
                    fill={frontFill}
                    rx={is3DMode ? 0 : 4}
                    stroke={isPeak ? '#f59e0b' : isZero ? 'rgba(148,163,184,0.15)' : '#3b82f6'}
                    strokeWidth={isPeak ? 1.5 : 0.8}
                    strokeOpacity={isZero ? 0.3 : 0.8}
                />

                {/* Top Cap (3D Roof) */}
                {is3DMode && (
                    <path
                        d={`M ${x},${y} L ${x + depthX},${y - depthY} L ${x + width + depthX},${y - depthY} L ${x + width},${y} Z`}
                        fill={topFill}
                        stroke={isPeak ? '#fbbf24' : isZero ? 'rgba(148,163,184,0.2)' : '#60a5fa'}
                        strokeWidth={0.8}
                    />
                )}

                {/* Right / Lateral Face (3D Side) */}
                {is3DMode && depthX !== 0 && (
                    <path
                        d={depthX > 0 
                            ? `M ${x + width},${y} L ${x + width + depthX},${y - depthY} L ${x + width + depthX},${y + barHeight - depthY} L ${x + width},${y + barHeight} Z`
                            : `M ${x},${y} L ${x + depthX},${y - depthY} L ${x + depthX},${y + barHeight - depthY} L ${x},${y + barHeight} Z`
                        }
                        fill={sideFill}
                        stroke={isPeak ? '#d97706' : isZero ? 'rgba(71,85,105,0.2)' : '#2563eb'}
                        strokeWidth={0.8}
                    />
                )}

                {/* Peak 3D Floating Crown Badge */}
                {isPeak && (
                    <g transform={`translate(${x + width / 2 + depthX * 0.5}, ${y - depthY - 14})`}>
                        <circle cx={0} cy={0} r={7} fill="#f59e0b" className="animate-pulse" />
                        <text
                            x={0}
                            y={3}
                            textAnchor="middle"
                            fontSize="8"
                            fontWeight="900"
                            fill="#ffffff"
                        >
                            ★
                        </text>
                    </g>
                )}
            </g>
        );
    };

    // Custom 3D Tooltip component
    const Custom3DTooltip = ({ active, payload }: any) => {
        if (!active || !payload || !payload.length) return null;
        const dataPoint = payload[0].payload;
        const isPeak = metricsSummary.peakItem && dataPoint.hour === metricsSummary.peakItem.hour && dataPoint.total > 0;
        const pctOfTotal = metricsSummary.grandTotal > 0 
            ? ((dataPoint.total / metricsSummary.grandTotal) * 100).toFixed(1) 
            : '0.0';

        const nextHour = (parseInt(dataPoint.hour, 10) + 1).toString().padStart(2, '0');

        return (
            <div className="bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl shadow-black/80 text-white min-w-[210px] select-none pointer-events-none z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Header with Hour Badge */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2.5">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-xl ${isPeak ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            <Clock size={14} />
                        </div>
                        <div>
                            <span className="text-xs font-black tracking-tight text-white block">
                                {dataPoint.hour}:00 - {nextHour}:00
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                                Intervalo de 60 minutos
                            </span>
                        </div>
                    </div>
                    {isPeak && (
                        <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Flame size={10} /> Pico
                        </span>
                    )}
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px] mb-2.5 font-mono">
                    <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/60">
                        <span className="text-[9px] font-sans font-extrabold text-slate-400 uppercase block">Recaudación</span>
                        <span className="text-emerald-400 font-black text-xs block mt-0.5">
                            Bs. {dataPoint.total.toFixed(2)}
                        </span>
                        <span className="text-[9px] text-slate-500 block">
                            ${dataPoint.usdTotal.toFixed(2)} USD
                        </span>
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/60">
                        <span className="text-[9px] font-sans font-extrabold text-slate-400 uppercase block">Transacciones</span>
                        <span className="text-blue-400 font-black text-xs block mt-0.5">
                            {dataPoint.count} {dataPoint.count === 1 ? 'venta' : 'ventas'}
                        </span>
                        <span className="text-[9px] text-slate-500 block">
                            {pctOfTotal}% del día
                        </span>
                    </div>
                </div>

                {/* Average Ticket Row */}
                <div className="flex items-center justify-between text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1.5 rounded-xl text-indigo-300 font-semibold">
                    <span>Ticket Promedio en Hora:</span>
                    <span className="font-mono font-bold text-white">Bs. {dataPoint.avgTicket.toFixed(2)}</span>
                </div>
            </div>
        );
    };

    return (
        <div className={`bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/80 dark:border-slate-850 shadow-xs flex flex-col justify-between overflow-hidden transition-all ${
            isFullscreen ? 'fixed inset-4 z-50 p-6 shadow-2xl bg-white/98 dark:bg-[#0c111e]/98 backdrop-blur-xl' : 'p-5 md:p-6'
        }`}>
            {/* SVG Global Gradients Definition for 3D Volume */}
            <svg style={{ height: 0, width: 0, position: 'absolute' }}>
                <defs>
                    {/* Active Bar Gradients */}
                    <linearGradient id="activeFrontGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#60a5fa" />
                        <stop offset="50%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#1d4ed8" />
                    </linearGradient>
                    <linearGradient id="activeTopGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#93c5fd" />
                        <stop offset="100%" stopColor="#60a5fa" />
                    </linearGradient>
                    <linearGradient id="activeSideGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#2563eb" />
                        <stop offset="100%" stopColor="#1e40af" />
                    </linearGradient>

                    {/* Peak / Best Hour Gradients (Golden Amber) */}
                    <linearGradient id="peakFrontGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fde047" />
                        <stop offset="40%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#b45309" />
                    </linearGradient>
                    <linearGradient id="peakTopGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#fef08a" />
                        <stop offset="100%" stopColor="#fcd34d" />
                    </linearGradient>
                    <linearGradient id="peakSideGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#92400e" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Header & Controls Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-850">
                <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl">
                            <BarChart3 size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm md:text-base font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                {title}
                                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-lg border border-amber-500/20">
                                    3D INTERACTIVO
                                </span>
                            </h2>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                {subtitle}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Top Action Toolbar */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Metric Switcher */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                        <button
                            onClick={() => setSelectedMetric('total')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition cursor-pointer ${
                                selectedMetric === 'total'
                                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                            }`}
                        >
                            Monto (Bs.)
                        </button>
                        <button
                            onClick={() => setSelectedMetric('count')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition cursor-pointer ${
                                selectedMetric === 'count'
                                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                            }`}
                        >
                            Tickets
                        </button>
                        <button
                            onClick={() => setSelectedMetric('avgTicket')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition cursor-pointer ${
                                selectedMetric === 'avgTicket'
                                    ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-xs'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                            }`}
                        >
                            Ticket Promedio
                        </button>
                    </div>

                    {/* 3D vs 2D Mode Switch */}
                    <button
                        onClick={() => {
                            setIs3DMode(!is3DMode);
                            if (isAutoRotating) setIsAutoRotating(false);
                        }}
                        className={`px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase border transition flex items-center gap-1.5 cursor-pointer ${
                            is3DMode 
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-600/20' 
                                : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                        }`}
                        title="Alternar entre visualización volumétrica 3D y vista clásica plana 2D"
                    >
                        <Layers size={12} />
                        <span>{is3DMode ? 'Modo 3D' : 'Modo 2D'}</span>
                    </button>

                    {/* Fullscreen Expand Button */}
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl border border-slate-200/80 dark:border-slate-800 transition cursor-pointer"
                        title={isFullscreen ? "Minimizar vista" : "Pantalla Completa 3D"}
                    >
                        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                </div>
            </div>

            {/* Quick KPI Ribbon Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3.5">
                {/* 1. Peak Hour */}
                <div className="p-3 bg-amber-500/10 dark:bg-amber-950/30 rounded-2xl border border-amber-500/20 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <Trophy size={11} /> Hora Pico
                    </span>
                    <div className="mt-1">
                        <span className="text-sm md:text-base font-black font-mono text-slate-900 dark:text-white">
                            {metricsSummary.peakItem ? `${metricsSummary.peakItem.hour}:00` : 'Sin datos'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                            Bs. {(metricsSummary.peakItem?.total || 0).toFixed(0)} ({metricsSummary.peakItem?.count || 0} v.)
                        </span>
                    </div>
                </div>

                {/* 2. Best 3-Hour Continuous Window */}
                <div className="p-3 bg-emerald-500/10 dark:bg-emerald-950/30 rounded-2xl border border-emerald-500/20 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <Zap size={11} /> Ventana Más Rentable (3h)
                    </span>
                    <div className="mt-1">
                        <span className="text-sm md:text-base font-black font-mono text-slate-900 dark:text-white">
                            {metricsSummary.best3hStart}:00 - {metricsSummary.best3hStart + 3}:00
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                            Bs. {metricsSummary.best3hTotal.toFixed(0)} acumulados
                        </span>
                    </div>
                </div>

                {/* 3. Average per Active Hour */}
                <div className="p-3 bg-blue-500/10 dark:bg-blue-950/30 rounded-2xl border border-blue-500/20 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                        <ArrowUpRight size={11} /> Promedio x Hora Activa
                    </span>
                    <div className="mt-1">
                        <span className="text-sm md:text-base font-black font-mono text-slate-900 dark:text-white">
                            Bs. {metricsSummary.avgHourlySales.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                            {metricsSummary.activeHoursCount} de 24 horas con ventas
                        </span>
                    </div>
                </div>

                {/* 4. Total Volume in Range */}
                <div className="p-3 bg-violet-500/10 dark:bg-violet-950/30 rounded-2xl border border-violet-500/20 flex flex-col justify-between">
                    <span className="text-[9px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles size={11} /> Total Recaudado (24h)
                    </span>
                    <div className="mt-1">
                        <span className="text-sm md:text-base font-black font-mono text-slate-900 dark:text-white">
                            Bs. {metricsSummary.grandTotal.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                            {metricsSummary.grandCount} tickets registrados
                        </span>
                    </div>
                </div>
            </div>

            {/* 3D Interactive Stage Canvas Container */}
            <div className="relative w-full overflow-hidden rounded-3xl bg-radial from-slate-900/5 via-slate-900/20 to-slate-950/40 dark:from-slate-900/40 dark:via-[#070a12] dark:to-[#04060a] border border-slate-200/60 dark:border-slate-800/80 p-2 md:p-4 my-2">
                
                {/* 3D Control Floating Overlay */}
                {is3DMode && (
                    <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 flex-wrap pointer-events-auto">
                        {/* Auto-Rotation Toggle */}
                        <button
                            onClick={() => setIsAutoRotating(!isAutoRotating)}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                                isAutoRotating 
                                    ? 'bg-amber-500 text-slate-950 shadow-amber-500/30 font-extrabold animate-pulse' 
                                    : 'bg-slate-900/80 text-white hover:bg-slate-800 border border-slate-700/60 backdrop-blur-md'
                            }`}
                            title="Activar/desactivar rotación espacial automática 360°"
                        >
                            <RotateCw size={12} className={isAutoRotating ? 'animate-spin' : ''} />
                            <span>{isAutoRotating ? 'Auto-Giro Activo' : 'Girar 360°'}</span>
                        </button>

                        {/* Angle Presets */}
                        <div className="hidden sm:flex items-center bg-slate-900/80 backdrop-blur-md p-0.5 rounded-xl border border-slate-700/60">
                            <button
                                onClick={() => applyPreset('isometric')}
                                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition cursor-pointer ${
                                    activePreset === 'isometric' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                Isométrica
                            </button>
                            <button
                                onClick={() => applyPreset('front')}
                                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition cursor-pointer ${
                                    activePreset === 'front' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                Frontal
                            </button>
                            <button
                                onClick={() => applyPreset('dynamic')}
                                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition cursor-pointer ${
                                    activePreset === 'dynamic' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                Dinámica
                            </button>
                            <button
                                onClick={() => applyPreset('top')}
                                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition cursor-pointer ${
                                    activePreset === 'top' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                                }`}
                            >
                                Aérea
                            </button>
                        </div>
                    </div>
                )}

                {/* 3D Zoom & Reset Floating Overlay */}
                {is3DMode && (
                    <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 pointer-events-auto">
                        <div className="flex items-center bg-slate-900/80 backdrop-blur-md p-1 rounded-2xl border border-slate-700/60 shadow-md">
                            <button
                                onClick={() => setZoom(prev => Math.max(0.55, prev - 0.15))}
                                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
                                title="Reducir Zoom"
                            >
                                <ZoomOut size={13} />
                            </button>
                            <span className="text-[10px] font-mono font-bold text-slate-300 px-1.5">
                                {Math.round(zoom * 100)}%
                            </span>
                            <button
                                onClick={() => setZoom(prev => Math.min(2.2, prev + 0.15))}
                                className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
                                title="Aumentar Zoom"
                            >
                                <ZoomIn size={13} />
                            </button>
                            <button
                                onClick={resetView}
                                className="ml-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[9px] font-black uppercase rounded-lg text-slate-200 transition cursor-pointer"
                                title="Restablecer posición original"
                            >
                                <RefreshCw size={11} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Gesture Helper Badge */}
                {is3DMode && (
                    <div className="absolute bottom-3 left-3 z-30 pointer-events-none hidden md:flex items-center gap-2 bg-slate-950/70 backdrop-blur-md border border-slate-800/80 px-2.5 py-1 rounded-xl text-[10px] text-slate-400 font-semibold">
                        <Move size={12} className="text-amber-400" />
                        <span>Arrastra para rotar en 3D • Pellizca o rueda para Zoom</span>
                    </div>
                )}

                {/* 3D Perspective Viewport Area */}
                <div
                    ref={stageRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onWheel={handleWheel}
                    className={`w-full relative transition-all cursor-grab active:cursor-grabbing ${
                        isFullscreen ? 'h-[520px]' : 'h-[280px] md:h-[340px]'
                    }`}
                    style={{
                        perspective: is3DMode ? '1200px' : 'none',
                        perspectiveOrigin: '50% 50%',
                        touchAction: is3DMode ? 'none' : 'auto'
                    }}
                >
                    {/* The 3D Transformed Chart Plane */}
                    <div
                        className="w-full h-full transform-gpu transition-transform duration-75 ease-out flex items-center justify-center"
                        style={{
                            transform: is3DMode 
                                ? `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${zoom})`
                                : 'none',
                            transformStyle: is3DMode ? 'preserve-3d' : 'flat'
                        }}
                    >
                        {isLoading ? (
                            <div className="h-full w-full flex items-center justify-center text-xs text-slate-400 animate-pulse">
                                Cargando rendimiento horario 3D...
                            </div>
                        ) : chartData && chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={chartData}
                                    margin={{ top: 35, right: 15, left: -10, bottom: 5 }}
                                >
                                    <CartesianGrid 
                                        strokeDasharray="3 3" 
                                        vertical={false} 
                                        stroke="#334155" 
                                        opacity={0.25} 
                                    />
                                    <XAxis 
                                        dataKey="label" 
                                        stroke="#94a3b8" 
                                        fontSize={9} 
                                        tickLine={false} 
                                        interval={is3DMode ? 1 : 1}
                                        tick={{ fill: '#94a3b8', fontWeight: 600 }}
                                    />
                                    <YAxis 
                                        stroke="#94a3b8" 
                                        fontSize={9} 
                                        tickLine={false} 
                                        tickFormatter={(v) => selectedMetric === 'total' || selectedMetric === 'avgTicket' ? `Bs.${v}` : `${v}`}
                                        tick={{ fill: '#94a3b8', fontWeight: 600 }}
                                    />
                                    <Tooltip 
                                        content={<Custom3DTooltip />}
                                        cursor={{ fill: 'rgba(59, 130, 246, 0.08)', radius: 8 }}
                                    />
                                    
                                    {/* 3D Bar with custom volumetric renderer */}
                                    <Bar
                                        dataKey={selectedMetric}
                                        shape={render3DBar}
                                        isAnimationActive={true}
                                        animationDuration={600}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400 text-xs font-semibold">
                                Sin registros de ventas por hora en este periodo.
                            </div>
                        )}
                    </div>
                </div>

                {/* 3D Floor Grid Projection Line */}
                {is3DMode && (
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent blur-[1px] mt-1"></div>
                )}
            </div>

            {/* Bottom Legend & Interactive Guide */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] text-slate-400 font-semibold pt-3 border-t border-slate-100 dark:border-slate-850 gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-md bg-gradient-to-r from-amber-400 to-amber-600 shadow-xs shadow-amber-500/40"></span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold">Hora Pico de Ventas (Pico Máximo)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-md bg-gradient-to-r from-blue-400 to-blue-600 shadow-xs shadow-blue-500/40"></span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold">Ventas Activas</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-md bg-slate-300 dark:bg-slate-800"></span>
                        <span>Sin Movimiento</span>
                    </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                    <Compass size={13} className="text-indigo-400" />
                    <span>Inclinación X: {Math.round(rotateX)}° | Giro Y: {Math.round(rotateY)}°</span>
                </div>
            </div>
        </div>
    );
}
