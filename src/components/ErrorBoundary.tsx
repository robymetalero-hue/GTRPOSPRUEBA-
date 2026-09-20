import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled exception:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      let errMessage = this.state.error?.message || "Unknown error";
      let isFirestorePermission = false;
      try {
        if (errMessage.startsWith('{') && errMessage.includes('operationType')) {
          const parsed = JSON.parse(errMessage);
          errMessage = `Firestore Permission Denied during ${parsed.operationType} on "${parsed.path}"`;
          isFirestorePermission = true;
        }
      } catch (e) {}

      return (
        <div id="error-boundary-layout" className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#080c14] p-6 text-slate-800 dark:text-slate-100">
          <div id="error-card" className="max-w-md w-full bg-white dark:bg-[#0c111e] rounded-3xl p-8 border border-slate-200/80 dark:border-slate-850/40 shadow-xl flex flex-col items-center text-center">
            <div id="error-icon-wrapper" className="w-14 h-14 bg-red-100 dark:bg-red-950/30 text-red-650 dark:text-red-405 rounded-2xl flex items-center justify-center mb-5">
              <AlertCircle size={28} />
            </div>
            
            <h1 className="font-sans font-black text-xl tracking-tight mb-2 text-slate-850 dark:text-white">
              Ocurrió un inconveniente
            </h1>
            
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              {isFirestorePermission 
                ? "El módulo en la nube reportó una restricción de permisos. GTR POS puede continuar operando con la Base de Datos Local independiente." 
                : "Se detectó un error inesperado al procesar la interfaz."}
            </p>

            <div id="error-details-box" className="w-full bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 text-left border border-slate-100 dark:border-slate-880 mb-6 max-h-32 overflow-y-auto">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 font-mono">Detalle Técnico</span>
              <code className="text-xs font-mono text-red-650 dark:text-red-400 break-all">
                {errMessage}
              </code>
            </div>

            <button
              id="error-retry-action"
              onClick={() => {
                // If it's a specific auth error, maybe log out. Otherwise, just reload.
                if (errMessage.includes("Firebase") && errMessage.includes("auth")) {
                   localStorage.removeItem('user');
                }
                window.location.reload();
              }}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-650 hover:bg-indigo-700 text-white text-sm font-bold shadow-lg shadow-indigo-650/15 transition-all cursor-pointer"
            >
              <RotateCcw size={16} />
              <span>Reiniciar Terminal POS</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children ? this.props.children : null;
  }
}
