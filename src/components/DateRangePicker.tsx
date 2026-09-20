import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Filter, X, ChevronDown, Check, Clock, CalendarDays, ArrowRight } from 'lucide-react';

export interface DateRange {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    preset: string;    // 'all' | 'today' | '7days' | '30days' | 'thisMonth' | 'thisYear' | 'custom'
    compare?: boolean; // compare with the previous period
}

interface DateRangePickerProps {
    value: DateRange;
    onChange: (range: DateRange) => void;
    className?: string;
}

export default function DateRangePicker({ value, onChange, className = '' }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [tempStart, setTempStart] = useState(value.startDate);
    const [tempEnd, setTempEnd] = useState(value.endDate);

    const presets = [
        { id: 'today', name: 'Hoy', icon: Clock },
        { id: '7days', name: 'Últimos 7 Días', icon: CalendarDays },
        { id: '30days', name: 'Últimos 30 Días', icon: Calendar },
        { id: 'thisMonth', name: 'Este Mes', icon: Calendar },
        { id: 'thisYear', name: 'Este Año', icon: Calendar },
        { id: 'all', name: 'Todo el Historial', icon: Filter },
        { id: 'custom', name: 'Rango Personalizado', icon: CalendarDays },
    ];

    const getPresetDates = (presetId: string): { start: string; end: string } => {
        const today = new Date();
        const formatDate = (d: Date) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };
        const todayStr = formatDate(today);

        if (presetId === 'all') {
            return { start: '', end: '' };
        } else if (presetId === 'today') {
            return { start: todayStr, end: todayStr };
        } else if (presetId === '7days') {
            const prior = new Date();
            prior.setDate(today.getDate() - 6);
            return { start: formatDate(prior), end: todayStr };
        } else if (presetId === '30days') {
            const prior = new Date();
            prior.setDate(today.getDate() - 29);
            return { start: formatDate(prior), end: todayStr };
        } else if (presetId === 'thisMonth') {
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            return { start: `${yyyy}-${mm}-01`, end: todayStr };
        } else if (presetId === 'thisYear') {
            const yyyy = today.getFullYear();
            return { start: `${yyyy}-01-01`, end: todayStr };
        }
        return { start: value.startDate, end: value.endDate };
    };

    const handlePresetClick = (presetId: string) => {
        if (presetId === 'custom') {
            onChange({
                ...value,
                preset: 'custom'
            });
            return;
        }

        const dates = getPresetDates(presetId);
        setTempStart(dates.start);
        setTempEnd(dates.end);
        onChange({
            startDate: dates.start,
            endDate: dates.end,
            preset: presetId,
            compare: value.compare
        });
        setIsOpen(false);
    };

    const handleApplyCustom = (e: React.FormEvent) => {
        e.preventDefault();
        if (!tempStart || !tempEnd) return;
        
        let start = tempStart;
        let end = tempEnd;
        if (new Date(start) > new Date(end)) {
            const t = start;
            start = end;
            end = t;
            setTempStart(start);
            setTempEnd(end);
        }

        onChange({
            startDate: start,
            endDate: end,
            preset: 'custom',
            compare: value.compare
        });
        setIsOpen(false);
    };

    const getActiveLabel = () => {
        const found = presets.find(p => p.id === value.preset);
        if (!found) return 'Período';
        if (value.preset === 'custom') {
            if (!value.startDate || !value.endDate) return 'Personalizado';
            return `${value.startDate.slice(5)} al ${value.endDate.slice(5)}`;
        }
        return found.name;
    };

    const renderPickerContent = () => (
        <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider flex items-center gap-1.5">
                    <Filter size={13} className="text-indigo-500" />
                    Filtrar por Período
                </span>
                <button 
                    onClick={() => setIsOpen(false)} 
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                    <X size={15} />
                </button>
            </div>

            {/* Presets List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {presets.map((preset) => {
                    const isSelected = value.preset === preset.id;
                    const Icon = preset.icon;
                    return (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => handlePresetClick(preset.id)}
                            className={`px-3 py-2 text-xs font-bold rounded-xl text-left transition-all flex items-center justify-between cursor-pointer border ${
                                isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-extrabold shadow-xs'
                                    : 'bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                            }`}
                        >
                            <span className="flex items-center gap-2 truncate">
                                <Icon size={12} className={isSelected ? 'text-indigo-500 shrink-0' : 'text-slate-400 shrink-0'} />
                                <span className="truncate">{preset.name}</span>
                            </span>
                            {isSelected && <Check size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0 ml-1" />}
                        </button>
                    );
                })}
            </div>

            {/* Custom Date Inputs */}
            {value.preset === 'custom' && (
                <form onSubmit={handleApplyCustom} className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Desde</label>
                            <input
                                type="date"
                                value={tempStart}
                                onChange={(e) => setTempStart(e.target.value)}
                                required
                                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-[#070c14] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Hasta</label>
                            <input
                                type="date"
                                value={tempEnd}
                                onChange={(e) => setTempEnd(e.target.value)}
                                required
                                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white dark:bg-[#070c14] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <span>Aplicar Rango</span>
                        <ArrowRight size={13} />
                    </button>
                </form>
            )}

            {/* Compare Toggle */}
            {value.preset !== 'all' && (
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Comparar vs período anterior</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={!!value.compare} 
                            onChange={(e) => {
                                onChange({
                                    ...value,
                                    compare: e.target.checked
                                });
                            }}
                            className="sr-only peer" 
                        />
                        <div className="relative w-8 h-4.5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2.5px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            )}
        </div>
    );

    return (
        <div className={`relative inline-block text-left select-none ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-[#0c111e] border border-slate-200/90 dark:border-slate-800 hover:border-indigo-500/50 rounded-2xl text-xs font-extrabold text-slate-750 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
            >
                <Calendar size={14} className="text-indigo-500 shrink-0" />
                <span className="whitespace-nowrap">{getActiveLabel()}</span>
                <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Mobile Modal Overlay (< 640px) */}
                        <div className="sm:hidden fixed inset-0 z-50 flex items-center justify-center p-4">
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" 
                                onClick={() => setIsOpen(false)} 
                            />
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                className="bg-white dark:bg-[#0c111e] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 w-full max-w-sm relative z-10 shadow-2xl overflow-hidden"
                            >
                                {renderPickerContent()}
                            </motion.div>
                        </div>

                        {/* Desktop Dropdown Popover (>= 640px) */}
                        <div className="hidden sm:block">
                            <div 
                                className="fixed inset-0 z-40 bg-transparent" 
                                onClick={() => setIsOpen(false)} 
                            />
                            <motion.div 
                                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                transition={{ duration: 0.15 }}
                                className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-84 origin-top-right rounded-3xl bg-white dark:bg-[#0c111e] border border-slate-200/90 dark:border-slate-800 shadow-xl p-4.5 z-50"
                            >
                                {renderPickerContent()}
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
