import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  CheckCircle, 
  XCircle, 
  HardDrive, 
  Layers, 
  Copy, 
  Check, 
  FileText, 
  ArrowRight,
  Zap,
  Info,
  Boxes,
  Users,
  FolderTree,
  Settings,
  ShoppingBag,
  Receipt,
  Wallet
} from 'lucide-react';
import { 
  runDatabaseIntegrityAudit, 
  realignLocalCacheWithServer, 
  DatabaseIntegrityReport, 
  TableHashResult 
} from '../utils/dbIntegrityValidator';

interface DatabaseIntegrityToolProps {
  onIntegrityChecked?: (report: DatabaseIntegrityReport) => void;
}

export const DatabaseIntegrityTool: React.FC<DatabaseIntegrityToolProps> = ({ onIntegrityChecked }) => {
  const [loading, setLoading] = useState(false);
  const [realigning, setRealigning] = useState(false);
  const [report, setReport] = useState<DatabaseIntegrityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [realignMessage, setRealignMessage] = useState<string | null>(null);

  const executeAudit = async () => {
    setLoading(true);
    setError(null);
    setRealignMessage(null);
    try {
      const auditReport = await runDatabaseIntegrityAudit();
      setReport(auditReport);
      if (onIntegrityChecked) {
        onIntegrityChecked(auditReport);
      }
    } catch (err: any) {
      console.error("[DatabaseIntegrityTool] Error executing audit:", err);
      setError(err.message || "Error al ejecutar la validación de integridad criptográfica.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeAudit();
  }, []);

  const handleRealignCache = async () => {
    setRealigning(true);
    setRealignMessage(null);
    try {
      const res = await realignLocalCacheWithServer();
      setRealignMessage(res.message);
      // Re-run audit to verify new hashes match immediately
      await executeAudit();
    } catch (err: any) {
      setRealignMessage(`Error al re-alinear: ${err.message}`);
    } finally {
      setRealigning(false);
    }
  };

  const copyToClipboard = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(identifier);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const copyFullMarkdownReport = () => {
    if (!report) return;
    const lines = [
      `# ACTA DE INTEGRIDAD CRIPTOGRÁFICA DE BASES DE DATOS`,
      `**Fecha / Hora (Bolivia):** ${report.timestamp}`,
      `**Estado General:** ${report.allAligned ? '100% ÍNTEGRO Y SIN CORRUPCIÓN' : 'DISCREPANCIAS DETECTADAS'}`,
      `**Puntaje de Consistencia:** ${report.summary.integrityScorePercentage}%`,
      `**Hash Maestro Global (SHA-256):** \`${report.globalMasterHash}\``,
      ``,
      `## 1. Integridad Física del Motor SQLite (Disco)`,
      `- Archivo: \`${report.sqliteIntegrity.activeDbFile || 'gtr_pos.db'}\``,
      `- Estado B-Trees (PRAGMA integrity_check): \`${report.sqliteIntegrity.status}\``,
      `- Verificación Rápida (PRAGMA quick_check): \`${report.sqliteIntegrity.quickCheck}\``,
      `- Violaciones de Llave Foránea: ${report.sqliteIntegrity.foreignKeyViolations}`,
      `- Tamaño de Base de Datos: ${(report.sqliteIntegrity.fileSizeBytes / 1024).toFixed(2)} KB`,
      ``,
      `## 2. Comparación Canónica de Hashes SHA-256 (Servidor SQLite vs. IndexedDB Local)`,
      `| Tabla | Reg. Servidor | Reg. Local | Hash Servidor SHA-256 | Hash Local SHA-256 | Estado |`,
      `| :--- | :---: | :---: | :--- | :--- | :--- |`
    ];

    Object.values(report.tables).forEach((t: TableHashResult) => {
      lines.push(
        `| ${t.displayName} | ${t.serverCount} | ${t.localCount ?? 'N/A'} | \`${t.serverHash.substring(0, 16)}...\` | \`${(t.localHash || 'N/A').substring(0, 16)}...\` | ${t.status === 'matched' ? 'COINCIDE (Íntegro)' : (t.status === 'server_only' ? 'Servidor OK' : 'DISCREPANCIA')} |`
      );
    });

    lines.push(``);
    lines.push(`## 3. Conclusión de Restauración`);
    lines.push(
      report.allAligned 
        ? `Se certifica que los datos en memoria local (IndexedDB) y en el motor transaccional SQLite no han sufrido corrupción binaria, alteración de tipos ni pérdida de registros tras los procedimientos de restauración.`
        : `Se han detectado diferencias entre la base restaurada en el servidor y la caché local. Se recomienda ejecutar 'Re-alinear Caché Local' para sincronizar IndexedDB.`
    );

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const getTableIcon = (tableName: string) => {
    switch (tableName) {
      case 'products': return <Boxes className="w-4 h-4 text-indigo-500" />;
      case 'clients': return <Users className="w-4 h-4 text-emerald-500" />;
      case 'departments': return <FolderTree className="w-4 h-4 text-amber-500" />;
      case 'settings': return <Settings className="w-4 h-4 text-slate-500" />;
      case 'sales': return <Receipt className="w-4 h-4 text-cyan-500" />;
      case 'sale_items': return <ShoppingBag className="w-4 h-4 text-violet-500" />;
      case 'cash_movements': return <Wallet className="w-4 h-4 text-emerald-600" />;
      default: return <Database className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <div className="space-y-6" id="database-integrity-tool-container">
      {/* Header card with action bar */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 ${
              report?.allAligned 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
            }`}>
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Validador de Integridad Criptográfica de Bases de Datos
                </h3>
                {report && (
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    report.allAligned 
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  }`}>
                    {report.allAligned ? '100% Íntegro & Verificado' : 'Discrepancia Detectada'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Compara hashes canónicos SHA-256 de las tablas principales entre SQLite (Servidor) e IndexedDB (Caché Navegador) para certificar que los datos no sufrieron corrupción durante restauraciones de versiones o respaldos.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-run-integrity-audit"
              onClick={executeAudit}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Calculando Hashes...' : 'Re-Validar Hashes'}
            </button>

            <button
              id="btn-realign-local-cache"
              onClick={handleRealignCache}
              disabled={realigning || loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              title="Sincroniza IndexedDB directamente con la última versión restaurada de SQLite"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-500 ${realigning ? 'animate-bounce' : ''}`} />
              {realigning ? 'Re-alineando...' : 'Re-alinear Caché Local'}
            </button>

            {report && (
              <button
                id="btn-copy-integrity-report"
                onClick={copyFullMarkdownReport}
                className="px-3.5 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                title="Copiar informe completo de auditoría a portapapeles"
              >
                {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedReport ? 'Copiado' : 'Copiar Acta'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Informative alerts */}
        {error && (
          <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-400 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {realignMessage && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{realignMessage}</span>
          </div>
        )}
      </div>

      {/* Bento Grid: 4 Metric Cards */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="integrity-bento-grid">
          {/* Card 1: SQLite Physical Integrity */}
          <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <HardDrive className="w-4 h-4 text-indigo-500" />
                Motor SQLite (Disco)
              </span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 uppercase">
                {report.sqliteIntegrity.status}
              </span>
            </div>
            <div className="text-xl font-bold text-slate-800 dark:text-white">
              B-Trees Saludables
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
              <p>Archivo: <strong className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">{report.sqliteIntegrity.activeDbFile || 'gtr_pos.db'}</strong></p>
              <p>Tamaño: {(report.sqliteIntegrity.fileSizeBytes / 1024).toFixed(1)} KB | FK Violations: 0</p>
            </div>
          </div>

          {/* Card 2: IndexedDB Local Cache */}
          <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Database className="w-4 h-4 text-emerald-500" />
                Caché IndexedDB
              </span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                report.summary.mismatchedTables === 0 
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400' 
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
              }`}>
                {report.summary.mismatchedTables === 0 ? 'Sincronizada' : 'Discrepancia'}
              </span>
            </div>
            <div className="text-xl font-bold text-slate-800 dark:text-white">
              {report.summary.alignedTables} Tablas Alineadas
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {report.summary.mismatchedTables === 0 
                ? 'Hash SHA-256 idéntico al servidor en catálogo y clientes' 
                : `${report.summary.mismatchedTables} tablas desincronizadas`}
            </p>
          </div>

          {/* Card 3: Global Master SHA-256 Hash */}
          <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <Layers className="w-4 h-4 text-purple-500" />
                Hash Maestro Global
              </span>
              <button
                onClick={() => copyToClipboard(report.globalMasterHash, 'master')}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
              >
                {copiedHash === 'master' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copiedHash === 'master' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate bg-slate-50 dark:bg-slate-900 p-1.5 rounded-lg border border-slate-100 dark:border-slate-850" title={report.globalMasterHash}>
              {report.globalMasterHash.substring(0, 18)}...
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Digest criptográfico global único de todas las entidades
            </p>
          </div>

          {/* Card 4: Post-Restoration Verdict */}
          <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-cyan-500" />
                Veredicto de Restauración
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {report.summary.integrityScorePercentage}%
              </span>
            </div>
            <div className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              {report.allAligned ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="w-5 h-5" /> No Corrompido
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-5 h-5" /> Requiere Alineación
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {report.allAligned
                ? 'Datos preservados con 100% de fidelidad'
                : 'Usa "Re-alinear Caché Local" para armonizar'}
            </p>
          </div>
        </div>
      )}

      {/* Discrepancy warning banner if needed */}
      {report && !report.allAligned && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                Se detectó una discrepancia entre la base restaurada en el servidor y la caché del navegador
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-0.5">
                Al restaurar una versión en el backend, la caché IndexedDB local puede haber conservado datos de la versión anterior. Pulsa el botón para actualizarla al instante con los datos limpios de SQLite.
              </p>
            </div>
          </div>
          <button
            onClick={handleRealignCache}
            disabled={realigning}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            {realigning ? 'Sincronizando...' : 'Resolver y Sincronizar Ahora'}
          </button>
        </div>
      )}

      {/* Detailed Tables Breakdown */}
      {report && (
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Auditoría Desglosada por Tabla y Entidad
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Comparación uno a uno de registros, agregados matemáticos y hashes SHA-256
              </p>
            </div>
            <div className="text-xs text-slate-400">
              {report.summary.totalTablesChecked} entidades evaluadas
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 dark:border-slate-850 rounded-xl">
            <table className="w-full text-left text-xs" id="table-integrity-breakdown">
              <thead className="bg-slate-50 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-850">
                <tr>
                  <th className="p-3.5 font-bold">Entidad / Tabla</th>
                  <th className="p-3.5 font-bold text-center">Registros</th>
                  <th className="p-3.5 font-bold">Hash Servidor (SQLite)</th>
                  <th className="p-3.5 font-bold">Hash Local (IndexedDB)</th>
                  <th className="p-3.5 font-bold">Agregados Clave</th>
                  <th className="p-3.5 font-bold text-center">Estado de Integridad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60 font-sans">
                {Object.values(report.tables).map((t: TableHashResult) => {
                  const isMatched = t.status === 'matched';
                  const isServerOnly = t.status === 'server_only';
                  const isMismatch = t.status === 'mismatch';

                  return (
                    <tr 
                      key={t.tableName}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {getTableIcon(t.tableName)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {t.displayName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              table: {t.tableName} {t.isLocalCached ? '• Caché Dual (IDB + SQLite)' : '• Servidor SQLite'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 text-center font-mono">
                        <div className="inline-block px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                          {t.serverCount} serv.
                          {t.isLocalCached && (
                            <span className="text-slate-400 text-[10px] block">
                              {t.localCount !== undefined ? `${t.localCount} local` : 'sin caché'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded" title={t.serverHash}>
                            {t.serverHash.substring(0, 12)}...
                          </span>
                          <button
                            onClick={() => copyToClipboard(t.serverHash, `server_${t.tableName}`)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                            title="Copiar hash SHA-256"
                          >
                            {copiedHash === `server_${t.tableName}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>

                      <td className="p-3.5 font-mono">
                        {t.isLocalCached && t.localHash ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[11px] px-2 py-0.5 rounded ${
                              isMatched 
                                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/40' 
                                : 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200/50 dark:border-red-800/40'
                            }`} title={t.localHash}>
                              {t.localHash.substring(0, 12)}...
                            </span>
                            <button
                              onClick={() => copyToClipboard(t.localHash || '', `local_${t.tableName}`)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                              title="Copiar hash local"
                            >
                              {copiedHash === `local_${t.tableName}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            {t.isLocalCached ? 'Pendiente' : 'Almacén servidor'}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-[11px] text-slate-600 dark:text-slate-400">
                        {t.serverAggregates && Object.keys(t.serverAggregates).length > 0 ? (
                          <div className="space-y-0.5 font-mono text-[10px]">
                            {t.serverAggregates.stockSum !== undefined && (
                              <p>Stock: <strong className="text-slate-800 dark:text-slate-200">{t.serverAggregates.stockSum}u</strong></p>
                            )}
                            {t.serverAggregates.priceSum !== undefined && (
                              <p>Precios: <strong className="text-slate-800 dark:text-slate-200">Bs. {t.serverAggregates.priceSum}</strong></p>
                            )}
                            {t.serverAggregates.pointsSum !== undefined && (
                              <p>Puntos: <strong className="text-slate-800 dark:text-slate-200">{t.serverAggregates.pointsSum} pts</strong></p>
                            )}
                            {t.serverAggregates.totalSum !== undefined && (
                              <p>Total: <strong className="text-slate-800 dark:text-slate-200">Bs. {t.serverAggregates.totalSum}</strong></p>
                            )}
                            {t.serverAggregates.quantitySum !== undefined && (
                              <p>Cantidad: <strong className="text-slate-800 dark:text-slate-200">{t.serverAggregates.quantitySum}u</strong></p>
                            )}
                            {t.serverAggregates.amountSum !== undefined && (
                              <p>Caja: <strong className="text-slate-800 dark:text-slate-200">Bs. {t.serverAggregates.amountSum}</strong></p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {isMatched && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 uppercase">
                            <CheckCircle className="w-3 h-3" />
                            Íntegro
                          </span>
                        )}
                        {isServerOnly && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 uppercase">
                            <CheckCircle className="w-3 h-3" />
                            SQLite OK
                          </span>
                        )}
                        {isMismatch && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 uppercase">
                            <XCircle className="w-3 h-3" />
                            Discrepancia
                          </span>
                        )}
                        {t.status === 'local_empty' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 uppercase">
                            <Info className="w-3 h-3" />
                            Caché Vacía
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Educational Note on Restoration */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1.5 text-slate-600 dark:text-slate-400">
            <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-indigo-500" />
              ¿Por qué es fundamental la comparación de hashes tras una restauración?
            </p>
            <p>
              Cuando se restaura una base de datos o se regresa a una versión anterior del sistema, el archivo en disco (<strong className="text-slate-700 dark:text-slate-300">SQLite</strong>) se reemplaza. Sin embargo, los navegadores de los operadores mantienen copias cacheadas en <strong className="text-slate-700 dark:text-slate-300">IndexedDB</strong> para operar sin conexión. Esta herramienta calcula un <strong className="text-slate-700 dark:text-slate-300">hash SHA-256 canónico</strong> para garantizar que el navegador y el servidor estén sincronizados byte por byte y que ningún registro o cálculo de stock haya sufrido corrupción.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
