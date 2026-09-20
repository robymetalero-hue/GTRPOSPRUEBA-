import React from 'react';
import { useAppContext } from '../context/AppContext';
import { Sliders, Palette, Sparkles, Trash2, Activity, Play } from 'lucide-react';

export default function RgbCustomizerPanel() {
    const { rgbSettings, setRgbSettings, user } = useAppContext();
    const isAdmin = user?.role === 'admin';

    const palettes = [
        { id: 'neon', name: '⚡ Ola de Neón', desc: 'Púrpuras, rosas y verdes eléctricos', colors: ['#ff00ff', '#00f0ff', '#39ff14', '#ff0077', '#7000ff'] },
        { id: 'rainbow', name: '🌈 Arcoíris Clásico', desc: 'Espectro continuo tradicional', colors: ['#ff0000', '#ffaa00', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff'] },
        { id: 'cyberpunk', name: '🔮 Cyberpunk Atardecer', desc: 'Violetas de neón y fucsias cibernéticos', colors: ['#ff0055', '#9900ff', '#00ffcc', '#ff9900', '#ff00ff'] },
        { id: 'oceanic', name: '🌊 Azul Océano / Deep', desc: 'Azul profundo, turquesa, esmeralda y verde', colors: ['#002244', '#005588', '#0088cc', '#00ffcc', '#00ffaa'] },
        { id: 'sunset', name: '🌇 Atardecer de Fuego', desc: 'Rojo vivo, naranja radiante, coral y púrpura', colors: ['#ff3300', '#ff6600', '#ff9900', '#cc0066', '#660066'] },
        { id: 'aurora', name: '🌌 Aurora Boreal', desc: 'Verdes boreales, cianes y toques púrpuras', colors: ['#00ffcc', '#2efc3a', '#0d98ba', '#9900ff', '#39ff14'] },
        { id: 'pastel', name: '🍧 Dulce Algodón', desc: 'Tonalidades pastel suaves y relajadas', colors: ['#ffb7b2', '#ffdac1', '#e2f0cb', '#b5ead7', '#c7ceea'] },
        { id: 'custom', name: '✨ Paleta Personalizada', desc: 'Define tus propios colores hexadecimales', colors: [] },
    ];

    const animationStyles = [
        { id: 'linear', name: 'Lineal Constante', desc: 'Movimiento uniforme, ideal para flujos continuos' },
        { id: 'smooth', name: 'Suave Orgánica', desc: 'Aceleración y deceleración física balanceada' },
        { id: 'cyclic', name: 'Cíclica Bucle', desc: 'Bucle que va y regresa (efecto rebote/ondas)' },
    ];

    const glowLevels = [
        { id: 'none', name: 'Ninguno', desc: 'Sin resplandor' },
        { id: 'subtle', name: 'Sutil', desc: 'Brillo tenue' },
        { id: 'normal', name: 'Gamer POS', desc: 'Efecto balanceado' },
        { id: 'intense', name: 'Supernova', desc: 'Máxima energía' },
    ];

    const handleSelectPalette = (id: string) => {
        if (!isAdmin) return;
        setRgbSettings(prev => ({
            ...prev,
            effectType: id as any
        }));
    };

    const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isAdmin) return;
        const val = parseInt(e.target.value, 10);
        setRgbSettings(prev => ({
            ...prev,
            speed: val
        }));
    };

    const handleAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isAdmin) return;
        const val = parseInt(e.target.value, 10);
        setRgbSettings(prev => ({
            ...prev,
            angle: val
        }));
    };

    const handleStyleChange = (id: 'linear' | 'smooth' | 'cyclic') => {
        if (!isAdmin) return;
        setRgbSettings(prev => ({
            ...prev,
            animationStyle: id
        }));
    };

    const handleGlowChange = (id: 'none' | 'subtle' | 'normal' | 'intense') => {
        if (!isAdmin) return;
        setRgbSettings(prev => ({
            ...prev,
            glowIntensity: id
        }));
    };

    const handleAddCustomColor = () => {
        if (!isAdmin) return;
        if (rgbSettings.customColors.length >= 8) return;
        setRgbSettings(prev => ({
            ...prev,
            customColors: [...prev.customColors, '#ff00aa']
        }));
    };

    const handleUpdateCustomColor = (index: number, color: string) => {
        if (!isAdmin) return;
        setRgbSettings(prev => {
            const copy = [...prev.customColors];
            copy[index] = color;
            return {
                ...prev,
                customColors: copy
            };
        });
    };

    const handleRemoveCustomColor = (index: number) => {
        if (!isAdmin) return;
        if (rgbSettings.customColors.length <= 2) return;
        setRgbSettings(prev => ({
            ...prev,
            customColors: prev.customColors.filter((_, i) => i !== index)
        }));
    };

    return (
        <div id="rgb-customizer-panel" className="bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-850 rounded-2xl p-5 flex flex-col gap-5 shadow-xs">
            {/* Header */}
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200/50 dark:border-slate-850/50">
                <Palette className="text-indigo-500 shrink-0" size={18} />
                <div className="flex flex-col">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Configuración Avanzada RGB Gamer / Neón
                    </h3>
                    <p className="text-[9.5px] font-bold text-slate-400">
                        Personaliza los flujos de colores, la velocidad y la física de animación para el modo RGB
                    </p>
                </div>
            </div>

            {/* 1. Seleccionar Paleta */}
            <div className="flex flex-col gap-2">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Palette size={12} /> Paleta de Colores Activa
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {palettes.map((p) => {
                        const isSelected = rgbSettings.effectType === p.id;
                        return (
                            <button
                                key={p.id}
                                type="button"
                                disabled={!isAdmin}
                                onClick={() => handleSelectPalette(p.id)}
                                className={`p-3 rounded-xl border text-left transition relative cursor-pointer select-none group flex flex-col gap-1.5 ${
                                    isSelected
                                        ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-xs'
                                        : !isAdmin
                                            ? 'border-slate-100 dark:border-slate-900 opacity-60 cursor-not-allowed'
                                            : 'border-slate-200/60 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900/40'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
                                        {p.name}
                                    </span>
                                    {/* Color palette preview bubbles */}
                                    {p.colors.length > 0 && (
                                        <div className="flex -space-x-1.5 items-center">
                                            {p.colors.slice(0, 5).map((c, i) => (
                                                <span
                                                    key={i}
                                                    className="w-3 h-3 rounded-full border border-white dark:border-slate-950 shrink-0"
                                                    style={{ backgroundColor: c }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[8.5px] font-bold text-slate-400 leading-normal">
                                    {p.desc}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Editor de Paleta Personalizada */}
            {rgbSettings.effectType === 'custom' && (
                <div className="p-3.5 bg-slate-50 dark:bg-[#070a11] rounded-xl border border-slate-200 dark:border-slate-850 flex flex-col gap-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[9.5px] font-extrabold text-slate-850 dark:text-slate-200">Paleta de Colores Personalizada</span>
                            <span className="text-[8.5px] text-slate-400 font-bold leading-normal">Crea tu propio degradado de hasta 8 colores</span>
                        </div>
                        <button
                            type="button"
                            disabled={!isAdmin || rgbSettings.customColors.length >= 8}
                            onClick={handleAddCustomColor}
                            className="px-2.5 py-1 text-[8.5px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 dark:text-indigo-400 rounded-lg flex items-center gap-1 transition cursor-pointer"
                        >
                            + Añadir Color
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        {rgbSettings.customColors.map((color, index) => (
                            <div key={index} className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg">
                                <input
                                    type="color"
                                    value={color}
                                    disabled={!isAdmin}
                                    onChange={(e) => handleUpdateCustomColor(index, e.target.value)}
                                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent shrink-0"
                                />
                                <input
                                    type="text"
                                    value={color.toUpperCase()}
                                    maxLength={7}
                                    disabled={!isAdmin}
                                    onChange={(e) => {
                                        const newVal = e.target.value;
                                        if (newVal.startsWith('#') && newVal.length <= 7) {
                                            handleUpdateCustomColor(index, newVal);
                                        }
                                    }}
                                    className="w-14 text-[9px] font-mono font-bold uppercase text-center bg-transparent border-b border-transparent focus:border-indigo-500 outline-none"
                                />
                                <button
                                    type="button"
                                    disabled={!isAdmin || rgbSettings.customColors.length <= 2}
                                    onClick={() => handleRemoveCustomColor(index)}
                                    className="p-1 hover:text-rose-500 text-slate-400 dark:text-slate-500 rounded transition shrink-0 cursor-pointer"
                                    title="Eliminar color"
                                >
                                    <Trash2 size={11} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="text-[8px] text-slate-400 font-bold italic">
                        * Se requiere un mínimo de 2 y máximo de 8 colores para garantizar degradados continuos y fluidos.
                    </div>
                </div>
            )}

            {/* Grid para controles (Velocidad, Ángulo, Animación) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 2. Velocidad mediante SLIDER */}
                <div className="flex flex-col gap-2 p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-850/40 rounded-xl">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Velocidad de Transición
                        </label>
                        <span className="text-[10px] font-black font-mono text-indigo-600 dark:text-indigo-400">
                            {rgbSettings.speed} segundos
                        </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-[8px] font-bold text-slate-400">Rápido (2s)</span>
                        <input
                            type="range"
                            min="2"
                            max="120"
                            step="1"
                            value={rgbSettings.speed}
                            disabled={!isAdmin}
                            onChange={handleSpeedChange}
                            className="flex-1 accent-indigo-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="text-[8px] font-bold text-slate-400">Relajante (120s)</span>
                    </div>
                    <p className="text-[8.5px] font-bold text-slate-400 mt-1 leading-normal">
                        Controla el tiempo que le toma a la paleta completar un ciclo de color completo.
                    </p>
                </div>

                {/* Ángulo de dirección mediante SLIDER */}
                <div className="flex flex-col gap-2 p-3 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-850/40 rounded-xl">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Ángulo del Gradiente (Dirección)
                        </label>
                        <span className="text-[10px] font-black font-mono text-indigo-600 dark:text-indigo-400">
                            {rgbSettings.angle}° de inclinación
                        </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-[8px] font-bold text-slate-400">-180°</span>
                        <input
                            type="range"
                            min="-180"
                            max="180"
                            step="15"
                            value={rgbSettings.angle}
                            disabled={!isAdmin}
                            onChange={handleAngleChange}
                            className="flex-1 accent-indigo-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className="text-[8px] font-bold text-slate-400">180°</span>
                    </div>
                    <p className="text-[8.5px] font-bold text-slate-400 mt-1 leading-normal">
                        Ajusta la dirección angular hacia la cual fluye la ola de color.
                    </p>
                </div>
            </div>

            {/* Grid para Estilo de Animación y Resplandor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 3. Estilo de Animación */}
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Activity size={12} /> Estilo de Física / Animación
                    </label>
                    <div className="flex flex-col gap-1.5">
                        {animationStyles.map((style) => {
                            const isSelected = rgbSettings.animationStyle === style.id;
                            return (
                                <button
                                    key={style.id}
                                    type="button"
                                    disabled={!isAdmin}
                                    onClick={() => handleStyleChange(style.id as any)}
                                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer select-none flex flex-col gap-0.5 ${
                                        isSelected
                                            ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-xs'
                                            : !isAdmin
                                                ? 'border-slate-100 dark:border-slate-900 opacity-60 cursor-not-allowed'
                                                : 'border-slate-200/60 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-600 dark:text-slate-400'
                                    }`}
                                >
                                    <span className="text-[10px] font-extrabold">{style.name}</span>
                                    <span className="text-[8px] font-bold text-slate-400 leading-normal">{style.desc}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 4. Intensidad de Brillo (Glow) */}
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Sparkles size={12} /> Resplandor / Brillo Neón
                    </label>
                    <div className="flex flex-col gap-1.5">
                        {glowLevels.map((g) => {
                            const isSelected = rgbSettings.glowIntensity === g.id;
                            return (
                                <button
                                    key={g.id}
                                    type="button"
                                    disabled={!isAdmin}
                                    onClick={() => handleGlowChange(g.id as any)}
                                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer select-none flex flex-col gap-0.5 ${
                                        isSelected
                                            ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-xs'
                                            : !isAdmin
                                                ? 'border-slate-100 dark:border-slate-900 opacity-60 cursor-not-allowed'
                                                : 'border-slate-200/60 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900/40 text-slate-600 dark:text-slate-400'
                                    }`}
                                >
                                    <span className="text-[10px] font-extrabold">{g.name}</span>
                                    <span className="text-[8px] font-bold text-slate-400 leading-normal">{g.desc}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Live Interactive Preview */}
            <div className="mt-2 p-4 bg-indigo-500/5 dark:bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col">
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full gamer-rgb-glow animate-pulse" />
                        Vista Previa Interactiva en Tiempo Real
                    </span>
                    <span className="text-[8.5px] text-slate-400 font-bold leading-normal">
                        Prueba cómo reacciona tu diseño RGB configurado al interactuar o pasar el cursor.
                    </span>
                </div>
                <div className="gamer-rgb-glow px-4 py-2 text-[10px] font-black rounded-xl text-white text-center shadow-md select-none">
                    BOTÓN PREVIEW RGB
                </div>
            </div>
        </div>
    );
}
