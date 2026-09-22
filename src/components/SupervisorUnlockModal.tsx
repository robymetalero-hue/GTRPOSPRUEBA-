import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, KeyRound, Lock, Eye, EyeOff, X, AlertCircle, Loader2 } from 'lucide-react';

interface SupervisorUnlockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (supervisor: { id: number; username: string; role: string }) => void;
}

export const SupervisorUnlockModal: React.FC<SupervisorUnlockModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) {
            setErrorMessage('Por favor, ingresa la contraseña o PIN de supervisor.');
            return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch('/api/auth/verify-supervisor', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    username: username.trim() || undefined,
                    password: password.trim(),
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setErrorMessage(data.error || 'Credenciales de supervisor no válidas.');
                setIsLoading(false);
                return;
            }

            setPassword('');
            setUsername('');
            onSuccess(data.supervisor);
            onClose();
        } catch (err: any) {
            setErrorMessage('No se pudo verificar las credenciales con el servidor. Revisa tu conexión.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Dialog Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    className="relative w-full max-w-md bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 overflow-hidden z-10"
                >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <ShieldCheck size={22} className="animate-pulse" />
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 font-mono">
                                    Modo Kiosco • Seguridad
                                </span>
                                <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                                    Desbloqueo de Supervisor
                                </h3>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
                        Ingresa las credenciales de un <strong>Administrador</strong> o <strong>Propietario</strong> para habilitar temporalmente la navegación completa sin cerrar la sesión de caja.
                    </p>

                    {errorMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5"
                        >
                            <AlertCircle size={16} className="shrink-0" />
                            <span>{errorMessage}</span>
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div>
                            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                                Usuario Administrador <span className="font-normal lowercase text-slate-400">(opcional)</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Ej: admin (opcional)"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                                Contraseña o PIN de Supervisor <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                    <KeyRound size={16} />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Contraseña del supervisor"
                                    autoFocus
                                    required
                                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-850 transition cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        <span>Verificando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Lock size={14} />
                                        <span>Desbloquear</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
