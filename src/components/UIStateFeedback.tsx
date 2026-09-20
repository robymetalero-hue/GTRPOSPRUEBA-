import React from 'react';
import { LucideIcon, Inbox, AlertCircle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

// ==========================================
// 1. SKELETON LOADERS
// ==========================================

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
    return (
        <div className="w-full animate-pulse">
            <div className="h-10 bg-slate-100 dark:bg-slate-850/60 rounded-t-xl mb-2 flex items-center px-4 gap-4">
                {Array.from({ length: cols }).map((_, i) => (
                    <div key={i} className="h-3 bg-slate-200 dark:bg-slate-700/60 rounded-md flex-1" />
                ))}
            </div>
            <div className="flex flex-col gap-2">
                {Array.from({ length: rows }).map((_, r) => (
                    <div key={r} className="h-12 bg-slate-50 dark:bg-slate-900/40 rounded-xl flex items-center px-4 gap-4 border border-slate-150/40 dark:border-slate-800/40">
                        {Array.from({ length: cols }).map((_, c) => (
                            <div key={c} className="h-3.5 bg-slate-200/80 dark:bg-slate-800/80 rounded-md flex-1" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 animate-pulse">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-[#0c111e] rounded-2xl p-3 border border-slate-200/60 dark:border-slate-800 flex flex-col gap-2.5 shadow-xs">
                    <div className="w-full aspect-square bg-slate-100 dark:bg-slate-850/60 rounded-xl" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700/60 rounded-md w-3/4" />
                    <div className="h-4 bg-slate-200/90 dark:bg-slate-700/80 rounded-md w-1/2" />
                </div>
            ))}
        </div>
    );
}

export function StatCardSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-[#0c111e] p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex flex-col gap-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700/60 rounded-md w-1/3" />
                    <div className="h-6 bg-slate-200/90 dark:bg-slate-700/80 rounded-md w-2/3 my-1" />
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-md w-1/2" />
                </div>
            ))}
        </div>
    );
}

// ==========================================
// 2. EMPTY STATES
// ==========================================

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

export function EmptyState({
    icon: Icon = Inbox,
    title,
    description,
    actionLabel,
    onAction,
    className = ''
}: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/20 ${className}`}>
            <div className="w-13 h-13 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 shadow-xs">
                <Icon size={26} strokeWidth={1.75} />
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-100 mb-1">
                {title}
            </h3>
            {description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4 font-medium leading-relaxed">
                    {description}
                </p>
            )}
            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-2"
                >
                    <RefreshCw size={13} />
                    <span>{actionLabel}</span>
                </button>
            )}
        </div>
    );
}

// ==========================================
// 3. UNIFIED STATUS BADGES
// ==========================================

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
    status: StatusType;
    label: string;
    dot?: boolean;
    size?: 'sm' | 'md';
}

export function StatusBadge({ status, label, dot = true, size = 'sm' }: StatusBadgeProps) {
    const colorClasses: Record<StatusType, { bg: string; text: string; border: string; dotColor: string }> = {
        success: {
            bg: 'bg-emerald-500/10 dark:bg-emerald-950/30',
            text: 'text-emerald-700 dark:text-emerald-400',
            border: 'border-emerald-500/20',
            dotColor: 'bg-emerald-500'
        },
        warning: {
            bg: 'bg-amber-500/10 dark:bg-amber-950/30',
            text: 'text-amber-700 dark:text-amber-400',
            border: 'border-amber-500/20',
            dotColor: 'bg-amber-500'
        },
        error: {
            bg: 'bg-rose-500/10 dark:bg-rose-950/30',
            text: 'text-rose-700 dark:text-rose-400',
            border: 'border-rose-500/20',
            dotColor: 'bg-rose-500'
        },
        info: {
            bg: 'bg-indigo-500/10 dark:bg-indigo-950/30',
            text: 'text-indigo-700 dark:text-indigo-400',
            border: 'border-indigo-500/20',
            dotColor: 'bg-indigo-500'
        },
        neutral: {
            bg: 'bg-slate-500/10 dark:bg-slate-800/40',
            text: 'text-slate-700 dark:text-slate-300',
            border: 'border-slate-500/20',
            dotColor: 'bg-slate-400'
        }
    };

    const cfg = colorClasses[status] || colorClasses.neutral;
    const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-lg border font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClasses}`}>
            {dot && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor} shrink-0`} />}
            <span>{label}</span>
        </span>
    );
}
