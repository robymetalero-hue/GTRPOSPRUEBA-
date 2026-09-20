import { backupDatabaseToDrive } from "../utils/driveBackup";
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Settings, TrendingUp, History, ShieldAlert, Lock, Save, Cloud, Database, Download, Upload, FileJson, RefreshCw, DollarSign, Info, ShieldCheck, Receipt, Eye, Sliders, Type, RotateCcw, Printer, Users, Star, Trash2, Search, CloudUpload, CloudDownload, Activity, Smartphone, Sparkles, HardDrive, Archive, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import RgbCustomizerPanel from '../components/RgbCustomizerPanel';
import { saveOfflineAction, clearAllOfflineStorage, cacheAppState } from '../utils/offlineStorage';
import { EmptyState, TableSkeleton } from '../components/UIStateFeedback';

interface AuditLog {
    id: number;
    user_id: number;
    username: string;
    old_rate: number;
    new_rate: number;
    changed_at: string;
}

export default function ConfiguracionesView() {
    const { 
        exchangeRate, setExchangeRate, fetchExchangeRate, user, showNotification, receiptTemplate, 
        updateReceiptTemplate, clients, fetchClients, theme, setTheme, rgbSettings, setRgbSettings, 
        pwaPrompt, installPWA, isPwaInstalled, kioskMode, setKioskMode,
        hasPwaUpdate, isUpdatingPwa, pwaUpdateStepMessage, pwaVersionInfo, handlePwaPrimaryAction, checkForPwaUpdates, applyPwaUpdate
    } = useAppContext();
    const [rateInput, setRateInput] = useState<string>("");
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // customizable digital receipt templates draft states
    const [logoText, setLogoText] = useState("");
    const [showLogo, setShowLogo] = useState(true);
    const [headerText, setHeaderText] = useState("");
    const [footerText, setFooterText] = useState("");
    const [showDate, setShowDate] = useState(true);
    const [showCashier, setShowCashier] = useState(true);
    const [showClientInfo, setShowClientInfo] = useState(true);
    const [showHeaderDivider, setShowHeaderDivider] = useState(true);
    const [showFooterDivider, setShowFooterDivider] = useState(true);
    const [showItemSKU, setShowItemSKU] = useState(false);
    const [showPaymentMethod, setShowPaymentMethod] = useState(true);
    const [fontFamily, setFontFamily] = useState<'Helvetica' | 'Courier' | 'Times'>('Helvetica');
    const [fontSizeHeader, setFontSizeHeader] = useState(14);
    const [fontSizeBody, setFontSizeBody] = useState(8);
    const [ticketWidth, setTicketWidth] = useState(80);
    const [logoImage, setLogoImage] = useState<string | null>(null);
    const [isSavingTemplate, setIsSavingTemplate] = useState(false);

    // CRM and points states (Sugerencia 3)
    const [crmSearch, setCrmSearch] = useState("");
    const [editingClientPointsId, setEditingClientPointsId] = useState<number | null>(null);
    const [editingPointsValue, setEditingPointsValue] = useState<number>(0);
    const [isUpdatingPoints, setIsUpdatingPoints] = useState(false);

    // Dynamic Server Version and Push Controls
    const [pushVersion, setPushVersion] = useState("2.3.0");
    const [pushNotes, setPushNotes] = useState("");
    const [isPushingUpdate, setIsPushingUpdate] = useState(false);

    const fetchAppVersion = async () => {
        try {
            const res = await fetch('/api/app-version');
            if (res.ok) {
                const data = await res.json();
                if (data.version) {
                    setPushVersion(data.version);
                    setPushNotes(data.release_notes || "");
                }
            }
        } catch (err) {
            console.error("Error grabbing server version:", err);
        }
    };

    useEffect(() => {
        fetchClients();
        fetchAppVersion();
    }, []);

    useEffect(() => {
        if (receiptTemplate) {
            setLogoText(receiptTemplate.logoText || "GTR POS TERMINAL");
            setShowLogo(receiptTemplate.showLogo !== undefined ? receiptTemplate.showLogo : true);
            setHeaderText(receiptTemplate.headerText || "Cochabamba - Bolivia\nTelf: 444-XXXXX\nNIT: 382910023");
            setFooterText(receiptTemplate.footerText || "¡Gracias por su preferencia!\nConserve su recibo para cualquier reclamo.");
            setShowDate(receiptTemplate.showDate !== undefined ? receiptTemplate.showDate : true);
            setShowCashier(receiptTemplate.showCashier !== undefined ? receiptTemplate.showCashier : true);
            setShowClientInfo(receiptTemplate.showClientInfo !== undefined ? receiptTemplate.showClientInfo : true);
            setShowHeaderDivider(receiptTemplate.showHeaderDivider !== undefined ? receiptTemplate.showHeaderDivider : true);
            setShowFooterDivider(receiptTemplate.showFooterDivider !== undefined ? receiptTemplate.showFooterDivider : true);
            setShowItemSKU(receiptTemplate.showItemSKU !== undefined ? receiptTemplate.showItemSKU : false);
            setShowPaymentMethod(receiptTemplate.showPaymentMethod !== undefined ? receiptTemplate.showPaymentMethod : true);
            setFontFamily(receiptTemplate.fontFamily || 'Helvetica');
            setFontSizeHeader(receiptTemplate.fontSizeHeader || 14);
            setFontSizeBody(receiptTemplate.fontSizeBody || 8);
            setTicketWidth(receiptTemplate.ticketWidth || 80);
            setLogoImage(receiptTemplate.logoImage || null);
        }
    }, [receiptTemplate]);

    const handleResetToDefault = () => {
        setLogoText("GTR POS TERMINAL");
        setShowLogo(true);
        setHeaderText("Cochabamba - Bolivia\nTelf: 444-XXXXX\nNIT: 382910023");
        setFooterText("¡Gracias por su preferencia!\nConserve su recibo para cualquier reclamo.");
        setShowDate(true);
        setShowCashier(true);
        setShowClientInfo(true);
        setShowHeaderDivider(true);
        setShowFooterDivider(true);
        setShowItemSKU(false);
        setShowPaymentMethod(true);
        setFontFamily('Helvetica');
        setFontSizeHeader(14);
        setFontSizeBody(8);
        setTicketWidth(80);
        setLogoImage(null);
        showNotification?.("✓ Campos restaurados a plantilla predeterminada. Guarde los cambios para confirmarlos.", "success");
    };

    const handleSaveTemplate = async () => {
        setIsSavingTemplate(true);
        try {
            const updated = {
                logoText,
                showLogo,
                headerText,
                footerText,
                showDate,
                showCashier,
                showClientInfo,
                showHeaderDivider,
                showFooterDivider,
                showItemSKU,
                showPaymentMethod,
                fontFamily,
                fontSizeHeader,
                fontSizeBody,
                ticketWidth,
                logoImage
            };
            await updateReceiptTemplate(updated);
            showNotification?.("✓ Plantilla de recibo digital guardada y sincronizada correctamente.", "success");
        } catch (err: any) {
            console.error(err);
            showNotification?.("Error al guardar la plantilla: " + err.message, "error");
        } finally {
            setIsSavingTemplate(false);
        }
    };

    const handleDownloadMockPDF = () => {
        try {
            const width = ticketWidth;
            const ml = width === 58 ? 4 : 8;
            const mr = width - ml;
            const cx = width / 2;
            const font = fontFamily;
            
            let totalLines = 0;
            if (showLogo) totalLines += 3;
            if (headerText) totalLines += headerText.split('\n').length * 1.5;
            if (showHeaderDivider) totalLines += 1;
            if (showDate) totalLines += 1;
            if (showCashier) totalLines += 1;
            if (showClientInfo) totalLines += 1;
            totalLines += 2;
            totalLines += 2;
            if (showItemSKU) totalLines += 1.6;
            totalLines += 2;
            if (showPaymentMethod) totalLines += 1;
            if (showFooterDivider) totalLines += 1;
            if (footerText) totalLines += footerText.split('\n').length * 1.5;
            totalLines += 4;

            const predictedHeight = Math.max(120, Math.round(totalLines * 5) + 20);

            const doc = new jsPDF({
                unit: 'mm',
                format: [width, predictedHeight]
            });

            doc.setFont(font, "normal");
            let y = 12;

            // Logo
            if (showLogo && logoText) {
                doc.setFont(font, "bold");
                doc.setFontSize(fontSizeHeader);
                const wrappedLogo = doc.splitTextToSize(logoText, mr - ml);
                wrappedLogo.forEach((line: string) => {
                    doc.text(line, cx, y, { align: 'center' });
                    y += (fontSizeHeader / 2) + 1;
                });
                y += 2;
            }

            doc.setFont(font, "normal");
            doc.setFontSize(fontSizeBody);

            // Header info
            if (headerText) {
                const wrappedHeader = doc.splitTextToSize(headerText, mr - ml);
                wrappedHeader.forEach((line: string) => {
                    doc.text(line, cx, y, { align: 'center' });
                    y += (fontSizeBody / 2) + 1.5;
                });
                y += 2;
            }

            // Divider
            if (showHeaderDivider) {
                const divText = "-".repeat(width === 58 ? 32 : 44);
                doc.text(divText, cx, y, { align: 'center' });
                y += 5;
            }

            // Meta info
            if (showDate) {
                doc.text(`Fecha: ${new Date().toLocaleString()}`, ml, y);
                y += 4.5;
            }
            if (showCashier) {
                doc.text(`Atendió: ${user?.username || 'admin'} [PRUEBA]`, ml, y);
                y += 4.5;
            }
            if (showClientInfo) {
                doc.text(`Clie: Juan Pérez (77712345)`, ml, y);
                y += 5;
            }

            y += 1.5;

            // columns
            doc.setFont(font, "bold");
            doc.text("ITEM", ml, y);
            const colQtyX = mr - (width === 58 ? 16 : 24);
            const colPriceX = mr;
            doc.text("CANT", colQtyX, y, { align: 'right' });
            doc.text("SUB (Bs.)", colPriceX, y, { align: 'right' });
            y += 3.5;

            const itemDivider = "-".repeat(width === 58 ? 32 : 44);
            doc.text(itemDivider, cx, y, { align: 'center' });
            y += 5;

            // Mock list
            const mockItems = [
                { name: "Coca Cola Retornable 3Lt", sku: "CC-BOB3000", qty: 2, price: 13.50 },
                { name: "Arroz Grano de Oro Especial", sku: "AR-GDE-5KG", qty: 1, price: 45.00 }
            ];

            mockItems.forEach(item => {
                doc.setFont(font, "normal");
                doc.setFontSize(fontSizeBody);

                const maxNameWidth = width === 58 ? 20 : 32;
                const wrappedName = doc.splitTextToSize(item.name, maxNameWidth);

                const firstLine = wrappedName[0] || "";
                doc.text(firstLine, ml, y);
                doc.text(`${item.qty}`, colQtyX, y, { align: 'right' });
                doc.text(`Bs.${(item.price * item.qty).toFixed(2)}`, colPriceX, y, { align: 'right' });
                y += 4.5;

                if (wrappedName.length > 1) {
                    for (let i = 1; i < wrappedName.length; i++) {
                        doc.text(wrappedName[i], ml, y);
                        y += 4.5;
                    }
                }

                if (showItemSKU && item.sku) {
                    doc.setFont(font, "italic");
                    doc.setFontSize(fontSizeBody - 1.5);
                    doc.text(`SKU: ${item.sku}`, ml + 2, y - 1);
                    y += 4;
                }
            });

            y += 2;
            doc.setFont(font, "normal");
            doc.setFontSize(fontSizeBody);
            doc.text(itemDivider, cx, y, { align: 'center' });
            y += 5.5;

            doc.text(`Subtotal:`, ml, y);
            doc.text(`Bs. 72.00`, colPriceX, y, { align: 'right' });
            y += 4.5;

            doc.setFont(font, "bold");
            doc.text(`TOTAL GENERAL:`, ml, y);
            doc.text(`Bs. 72.00`, colPriceX, y, { align: 'right' });
            y += 5.5;

            if (showPaymentMethod) {
                doc.setFont(font, "normal");
                doc.setFontSize(fontSizeBody);
                doc.text(`Pago: Efectivo`, ml, y);
                y += 6;
            }

            if (showFooterDivider) {
                doc.setFont(font, "normal");
                doc.text(itemDivider, cx, y, { align: 'center' });
                y += 5.5;
            }

            if (footerText) {
                doc.setFont(font, "normal");
                doc.setFontSize(fontSizeBody);
                const wrappedFooter = doc.splitTextToSize(footerText, mr - ml);
                wrappedFooter.forEach((line: string) => {
                    doc.text(line, cx, y, { align: 'center' });
                    y += (fontSizeBody / 2) + 1.5;
                });
            }

            doc.save(`Recibo_Térmico_Prueba_${width}mm.pdf`);
            showNotification?.("✓ Recibo de prueba de PDF descargado con éxito.", "success");
        } catch (e) {
            console.error("PDF download failure:", e);
            showNotification?.("Error al generar PDF: " + String(e), "error");
        }
    };

    // States for Backup & Restore
    const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
    const [isImporting, setIsImporting] = useState<boolean>(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState<boolean>(false);

    // Restore validation modal states
    const [restoreValidationData, setRestoreValidationData] = useState<any | null>(null);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState<boolean>(false);
    const [isValidatingFile, setIsValidatingFile] = useState<boolean>(false);

    // Reset database modal states
    const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
    const [resetConfirmInput, setResetConfirmInput] = useState<string>("");
    const [isResettingDb, setIsResettingDb] = useState<boolean>(false);

    const isAdmin = user?.role === 'admin';

    const getAuthHeaders = (extra: Record<string, string> = {}) => {
        const token = localStorage.getItem('auth_token');
        const currentUser = user || (localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null);
        const headers: Record<string, string> = {
            'x-user-id': String(currentUser?.id || 4),
            'x-user-username': currentUser?.username || 'admin',
            'x-user-name': currentUser?.username || 'admin',
            'x-user-role': currentUser?.role || 'admin',
            ...extra
        };
        if (token && token.trim()) {
            headers['Authorization'] = `Bearer ${token.trim()}`;
        }
        return headers;
    };

    const triggerBlobDownload = (blob: Blob, filename: string) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            a.remove();
            window.URL.revokeObjectURL(blobUrl);
        }, 2000);
    };

    const handleDownloadBackup = async () => {
        setIsBackingUp(true);
        try {
            showNotification?.("Generando y descargando copia de seguridad JSON...", "info");
            const res = await fetch('/api/backup', { 
                headers: getAuthHeaders() 
            });

            if (!res.ok) {
                let errMsg = "No se pudo generar la copia de seguridad";
                try {
                    const errData = await res.json();
                    if (errData.error) errMsg += ": " + errData.error;
                } catch(e) {}
                throw new Error(errMsg);
            }

            const blob = await res.blob();
            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `gtrpos_backup_${dateStr}.json`;

            triggerBlobDownload(blob, filename);

            const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
            showNotification?.(`✓ Copia de seguridad exportada con éxito (${sizeMb} MB). Archivo ${filename} descargado.`, "success");
        } catch (err: any) {
            console.error("Backup download error:", err);
            showNotification?.("Error al exportar copia de seguridad: " + err.message, "error");
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleDriveBackup = async () => {
        setIsBackingUp(true);
        try {
            showNotification?.("Iniciando respaldo en Google Drive...", "info");
            const backupSuccess = await backupDatabaseToDrive();
            if (backupSuccess) {
                showNotification?.("✓ Respaldo subido exitosamente a Google Drive.", "success");
            }
        } catch (err: any) {
            console.error("Backup to Drive failed:", err);
            showNotification?.("El respaldo en Google Drive falló: " + err.message, "error");
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleSelectBackupFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsValidatingFile(true);
        setImportError(null);
        setImportSuccess(false);

        try {
            const text = await file.text();
            let parsed: any;
            try {
                parsed = JSON.parse(text);
            } catch (parseErr) {
                throw new Error("El archivo seleccionado no es un archivo JSON válido o está corrupto.");
            }

            // Validate via backend endpoint with auth headers
            const valRes = await fetch('/api/backup/validate', {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(parsed)
            });

            const valData = await valRes.json();
            if (!valRes.ok || !valData.valid) {
                throw new Error(valData.error || "Formato de archivo de respaldo no compatible.");
            }

            setRestoreValidationData({
                filePayload: parsed,
                validation: valData
            });
            setIsRestoreModalOpen(true);
        } catch (err: any) {
            console.error("Validation error:", err);
            setImportError(err.message);
            showNotification?.("Error al validar archivo: " + err.message, "error");
        } finally {
            setIsValidatingFile(false);
            if (event.target) event.target.value = ""; // Reset file input
        }
    };

    const handleExecuteRestore = async () => {
        if (!restoreValidationData?.filePayload) return;

        setIsImporting(true);
        setImportError(null);

        try {
            const res = await fetch('/api/backup/import', {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(restoreValidationData.filePayload)
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setImportSuccess(true);
                setIsRestoreModalOpen(false);
                setRestoreValidationData(null);
                showNotification?.(`✓ ${data.message}`, "success");
                if (fetchExchangeRate) fetchExchangeRate();
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                throw new Error(data.error || "Fallo indeterminado al restaurar base de datos.");
            }
        } catch (err: any) {
            console.error("Restore Execution Error:", err);
            setImportError(err.message);
            showNotification?.("Error al restaurar: " + err.message, "error");
        } finally {
            setIsImporting(false);
        }
    };

    const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
    const [isRestoringSafety, setIsRestoringSafety] = useState<boolean>(false);

    const handleCloudPush = async () => {
        setIsSyncingCloud(true);
        try {
            const res = await fetch('/api/backup/push', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                showNotification?.("✓ " + data.message, "success");
            } else {
                throw new Error(data.error || "Fallo al subir a Google Cloud.");
            }
        } catch (err: any) {
            showNotification?.("Error: " + err.message, "error");
        } finally {
            setIsSyncingCloud(false);
        }
    };

    const handleCloudPull = async () => {
        if (!window.confirm("¿Seguro de descargar todos los registros desde Google Cloud? Esto reemplazará tus tablas locales.")) return;
        setIsSyncingCloud(true);
        try {
            const res = await fetch('/api/backup/pull', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                showNotification?.("✓ " + data.message, "success");
                setTimeout(() => window.location.reload(), 1500);
            } else {
                throw new Error(data.error || "Fallo al descargar de Google Cloud.");
            }
        } catch (err: any) {
            showNotification?.("Error: " + err.message, "error");
        } finally {
            setIsSyncingCloud(false);
        }
    };

    const handleRestoreSafetyBackup = async () => {
        if (!window.confirm("⚠️ ¿Deseas RESTAURAR la copia de seguridad SQLite (gtr_pos.db.bak)? Esto recuperará la última versión antes de cualquier sincronización defectuosa con la web.")) return;
        setIsRestoringSafety(true);
        try {
            const res = await fetch('/api/backup/restore-safety-backup', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                showNotification?.("✓ " + data.message, "success");
                setTimeout(() => window.location.reload(), 1500);
            } else {
                throw new Error(data.error || "Fallo al restaurar seguridad.");
            }
        } catch (err: any) {
            showNotification?.("Error: " + err.message, "error");
        } finally {
            setIsRestoringSafety(false);
        }
    };

    // --- Automatic & Rolling Snapshots (Data Loss Prevention) ---
    const [snapshots, setSnapshots] = useState<Array<{ filename: string; sizeBytes: number; createdAt: string; formattedDate: string }>>([]);
    const [isLoadingSnapshots, setIsLoadingSnapshots] = useState<boolean>(false);
    const [isCreatingSnapshot, setIsCreatingSnapshot] = useState<boolean>(false);

    const fetchSnapshots = async () => {
        setIsLoadingSnapshots(true);
        try {
            const res = await fetch('/api/backup/snapshots', {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setSnapshots(data.snapshots || []);
            }
        } catch (e) {
            console.warn("Failed to fetch snapshots:", e);
        } finally {
            setIsLoadingSnapshots(false);
        }
    };

    useEffect(() => {
        fetchSnapshots();
    }, []);

    const handleCreateSnapshot = async () => {
        setIsCreatingSnapshot(true);
        try {
            const res = await fetch('/api/backup/create-snapshot', {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showNotification?.("✓ " + data.message, "success");
                await fetchSnapshots();
            } else {
                throw new Error(data.error || "No se pudo crear la instantánea");
            }
        } catch (err: any) {
            showNotification?.("Error: " + err.message, "error");
        } finally {
            setIsCreatingSnapshot(false);
        }
    };

    const handleRestoreSnapshot = async (filename: string) => {
        if (!window.confirm(`⚠️ ¿Deseas RESTAURAR la instantánea "${filename}"? Tu base actual se respaldará automáticamente como copia de seguridad previa.`)) return;
        setIsRestoringSafety(true);
        try {
            const res = await fetch(`/api/backup/restore-snapshot/${encodeURIComponent(filename)}`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showNotification?.("✓ " + data.message, "success");
                setTimeout(() => window.location.reload(), 1500);
            } else {
                throw new Error(data.error || "Error al restaurar");
            }
        } catch (err: any) {
            showNotification?.("Error: " + err.message, "error");
        } finally {
            setIsRestoringSafety(false);
        }
    };

    const handleDownloadRawDb = async () => {
        try {
            showNotification?.("Iniciando descarga de base de datos nativa gtr_pos.db...", "info");
            const res = await fetch('/api/backup/download-db', {
                headers: getAuthHeaders()
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "No se pudo descargar gtr_pos.db");
            }
            const blob = await res.blob();
            triggerBlobDownload(blob, "gtr_pos.db");
            const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
            showNotification?.(`✓ Base de datos SQLite gtr_pos.db descargada con éxito (${sizeMb} MB).`, "success");
        } catch (err: any) {
            console.error("Raw DB download error:", err);
            showNotification?.("Error al descargar base nativa: " + err.message, "error");
        }
    };

    const handleDownloadSnapshotFile = async (filename: string) => {
        try {
            showNotification?.(`Iniciando descarga de instantánea ${filename}...`, "info");
            const res = await fetch(`/api/backup/download-snapshot/${encodeURIComponent(filename)}`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "No se pudo descargar la instantánea");
            }
            const blob = await res.blob();
            triggerBlobDownload(blob, filename);
            const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
            showNotification?.(`✓ Instantánea ${filename} descargada con éxito (${sizeMb} MB).`, "success");
        } catch (err: any) {
            console.error("Snapshot download error:", err);
            showNotification?.("Error al descargar instantánea: " + err.message, "error");
        }
    };

    const handleOpenResetModal = () => {
        setResetConfirmInput("");
        setIsResetModalOpen(true);
    };

    const handleExecuteResetDatabase = async () => {
        if (resetConfirmInput.trim().toUpperCase() !== 'BORRAR') {
            showNotification?.("Debes escribir BORRAR para confirmar el reinicio.", "error");
            return;
        }

        setIsResettingDb(true);
        try {
            const res = await fetch('/api/admin/reset-database', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                try {
                    await clearAllOfflineStorage();
                } catch (e) {}

                setIsResetModalOpen(false);
                showNotification?.("✓ " + (data.message || "Base de datos reiniciada a cero correctamente."), "success");
                setTimeout(() => {
                    window.location.reload();
                }, 1200);
            } else {
                throw new Error(data.error || "No se pudo reiniciar la base de datos.");
            }
        } catch (err: any) {
            showNotification?.("Error al reiniciar base de datos: " + err.message, "error");
        } finally {
            setIsResettingDb(false);
        }
    };

    const [isCleaningCache, setIsCleaningCache] = useState<boolean>(false);
    const [cacheCleanStep, setCacheCleanStep] = useState<string>("");

    const handleClearCacheAndReindex = async () => {
        setIsCleaningCache(true);
        setCacheCleanStep("Iniciando purga de caché...");
        try {
            // 1. Clear LocalStorage cache keys
            await new Promise(resolve => setTimeout(resolve, 300));
            setCacheCleanStep("Eliminando productos y clientes en caché...");
            localStorage.removeItem('cached_products');
            localStorage.removeItem('cached_clients');
            localStorage.removeItem('cached_exchange_rate');
            localStorage.removeItem('cached_receipt_template');
            localStorage.removeItem('cached_departments');

            // 2. Clear SessionStorage
            await new Promise(resolve => setTimeout(resolve, 300));
            setCacheCleanStep("Limpiando almacenamiento de sesión...");
            sessionStorage.clear();

            // 3. Clear Cache Storage (Service Worker Caches)
            await new Promise(resolve => setTimeout(resolve, 400));
            setCacheCleanStep("Purgando Cache Storage (Capa Offline)...");
            if ('caches' in window) {
                try {
                    const keys = await caches.keys();
                    for (const key of keys) {
                        await caches.delete(key);
                    }
                } catch (cacheErr) {
                    console.error("Cache storage delete failed:", cacheErr);
                }
            }

            // 4. Force Service Workers to unregister
            await new Promise(resolve => setTimeout(resolve, 400));
            setCacheCleanStep("Reindexando conexiones y recargando terminal...");
            if ('serviceWorker' in navigator) {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                        await registration.unregister();
                    }
                } catch (swErr) {
                    console.error("Service worker unregister failed:", swErr);
                }
            }

            showNotification?.("✓ Caché purgada y reindexación completada. Recargando...", "success");
            await new Promise(resolve => setTimeout(resolve, 500));
            window.location.reload();
        } catch (err: any) {
            console.error("Cache clear failure:", err);
            showNotification?.("Error al limpiar caché: " + err.message, "error");
        } finally {
            setIsCleaningCache(false);
            setCacheCleanStep("");
        }
    };

    useEffect(() => {
        setRateInput(exchangeRate.toString());
        fetchAuditLogs();
    }, [exchangeRate]);

    const fetchAuditLogs = async () => {
        try {
            const res = await fetch('/api/settings/exchange-rate/audit');
            if (res.ok) {
                const data = await res.json();
                setAuditLogs(data);
            }
        } catch (err) {
            console.error("Failed to load audit logs:", err);
        }
    };

    const handleUpdateRate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) {
            showNotification?.("No tienes permisos de administrador para realizar esta acción.", "error");
            return;
        }

        const newRate = parseFloat(rateInput);
        if (isNaN(newRate) || newRate <= 0) {
            showNotification?.("Por favor ingresa un número de tipo de cambio válido mayor a 0.", "error");
            return;
        }

        setIsLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const res = await fetch('/api/settings/exchange-rate', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    ...(user ? { 'x-user-id': String(user.id), 'x-user-role': user.role, 'x-user-username': user.username } : {})
                },
                body: JSON.stringify({ rate: newRate, user })
            });
            if (res.ok) {
                const result = await res.json();
                setExchangeRate(result.new_rate);
                setRateInput(String(result.new_rate));
                localStorage.setItem('cached_exchange_rate', String(result.new_rate));
                cacheAppState('cached_exchange_rate', result.new_rate).catch(() => {});
                window.dispatchEvent(new CustomEvent('exchange_rate_updated', { detail: result.new_rate }));
                showNotification?.(`✓ Tipo de cambio actualizado con éxito de ${result.old_rate} a ${result.new_rate} Bs.`, "success");
                fetchAuditLogs();
            } else {
                const data = await res.json().catch(() => ({}));
                showNotification?.(`Error: ${data.error || 'No se pudo actualizar el tipo de cambio'}`, "error");
            }
        } catch (err) {
            console.error(err);
            showNotification?.("Fallo de conexión al guardar el tipo de cambio.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateClientPoints = async (clientId: number, points: number) => {
        setIsUpdatingPoints(true);
        try {
            if (!navigator.onLine) {
                await saveOfflineAction('adjust_points', `/api/clients/${clientId}/points`, 'POST', { points });
                showNotification?.("✓ Acción registrada offline. Los puntos se actualizarán al recuperar conexión a internet.", "success");
                setEditingClientPointsId(null);
                return;
            }

            const res = await fetch(`/api/clients/${clientId}/points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ points })
            });
            if (res.ok) {
                showNotification?.("✓ Puntos del cliente actualizados exitosamente.", "success");
                setEditingClientPointsId(null);
                fetchClients(); // reload CRM list
            } else {
                showNotification?.("No se pudieron actualizar los puntos.", "error");
            }
        } catch (err: any) {
            console.error(err);
            showNotification?.("Error de red al actualizar puntos: " + err.message, "error");
        } finally {
            setIsUpdatingPoints(false);
        }
    };

    const handleTriggerPushUpdate = async () => {
        setIsPushingUpdate(true);
        try {
            const res = await fetch('/api/settings/app-version', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version: pushVersion, release_notes: pushNotes })
            });
            if (res.ok) {
                showNotification?.(`✓ ¡Actualización v${pushVersion} empujada de forma exitosa en tiempo real a todos los dispositivos!`, "success");
            } else {
                const data = await res.json();
                showNotification?.(`Error al empujar actualización: ${data.error}`, "error");
            }
        } catch (e: any) {
             showNotification?.(`Error de conexión: ${e.message}`, "error");
        } finally {
             setIsPushingUpdate(false);
        }
    };

    return (
        <div id="settings-view" className="p-5 md:p-6 overflow-y-auto h-full flex flex-col gap-6 select-none bg-[#f8fafc]/40 dark:bg-[#070a10]">
            
            {/* Header portion */}
            <div className="flex justify-between items-center bg-white dark:bg-[#0c111e] p-5 rounded-3xl border border-slate-200/60 dark:border-slate-850/40">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                        <Settings size={18} />
                    </div>
                    <div>
                        <h1 className="text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Configuraciones Globales</h1>
                        <p className="text-[11px] text-slate-400 mt-1 font-semibold">Configura el tipo de cambio USD/BOB y visualiza las bitácoras de auditoría.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Exchange Rate Card Panel */}
                <div className="md:col-span-5 bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850/40 p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-850/50">
                        <TrendingUp className="text-indigo-500" size={16} />
                        <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-850 dark:text-white">Tipo de Cambio USD/BOB</h2>
                    </div>

                    <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl flex items-center justify-between">
                        <span className="text-[10.5px] font-bold text-slate-500 dark:text-indigo-300">Tipo de cambio vigente:</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-mono font-black text-indigo-600 dark:text-indigo-400">
                                {(exchangeRate || 6.96).toFixed(2)}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-400">Bs.</span>
                        </div>
                    </div>

                    {!isAdmin ? (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/40 rounded-2xl flex items-start gap-2.5">
                            <Lock className="text-amber-500 shrink-0 mt-0.5" size={13} />
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-normal">
                                Tu rol de {user?.role === 'trabajador' ? 'Trabajador' : 'Usuario'} no posee suficientes permisos para modificar el tipo de cambio oficial de la empresa.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleUpdateRate} className="flex flex-col gap-3.5">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400">Modificar Tipo de Cambio (Bs.)</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        min="0.01"
                                        className="w-full p-2.5 pl-4 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-mono font-black text-slate-705 dark:text-white focus:outline-none focus:border-indigo-500"
                                        placeholder="Ej: 6.96"
                                        value={rateInput}
                                        onChange={e => setRateInput(e.target.value)}
                                        disabled={isLoading}
                                    />
                                    <span className="absolute right-4 top-2.5 text-[10px] font-black text-slate-400">Bs = $1 USD</span>
                                </div>
                            </div>

                            <p className="text-[9.5px] leading-relaxed font-bold text-slate-400 bg-slate-50 dark:bg-black/20 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                                ⚠️ **Atención**: Al cambiar el tipo de cambio, todos los precios calculados en bolivianos de los productos registrados en dólares se actualizarán de forma inmediata. Las ventas ya cerradas no serán afectadas.
                            </p>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.01] active:scale-95 disabled:opacity-50 text-white text-xs font-extrabold rounded-2xl shadow-indigo-500/10 shadow-md border border-indigo-550 flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider transition"
                            >
                                <Save size={13} />
                                {isLoading ? 'Actualizando...' : 'Guardar Nuevo Tipo Cambio'}
                            </button>
                        </form>
                    )}
                </div>

                {/* Theme Selector Panel */}
                <div className="md:col-span-5 bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850/40 p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-850/50">
                        <Sliders className="text-indigo-500" size={16} />
                        <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-850 dark:text-white">Paleta de Colores & Apariencia</h2>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                        Personaliza la identidad visual de la terminal corporativa. Elige el color de marca que representa mejor a tu sucursal o negocio (Solo administradores).
                    </p>

                    {!isAdmin ? (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/40 rounded-2xl flex items-start gap-2.5">
                            <Lock className="text-amber-500 shrink-0 mt-0.5" size={13} />
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-normal">
                                Tu rol de {user?.role === 'trabajador' ? 'Trabajador' : 'Usuario'} no posee suficientes permisos para reconfigurar el color oficial de marca de la terminal.
                            </p>
                        </div>
                    ) : (
                        <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[9.5px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                Acceso de Administrador Concedido
                            </p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mt-1">
                        {[
                            { id: 'emerald', name: 'Esmeralda Real', color: 'bg-emerald-500', desc: 'Verde ideal para POS y cajas registradoras' },
                            { id: 'blue', name: 'Azul Océano', color: 'bg-blue-500', desc: 'Esquema corporativo, sobrio y claro' },
                            { id: 'charcoal', name: 'Negro Carbón', color: 'bg-slate-500', desc: 'Elegancia minimalista de alto contraste' },
                            { id: 'red', name: 'Rojo Rubí', color: 'bg-red-500', desc: 'Energético y ágil' },
                            { id: 'orange', name: 'Naranja Coral', color: 'bg-orange-500', desc: 'Fresco, interactivo y cálido' },
                            { id: 'purple', name: 'Amatista GTR', color: 'bg-purple-500', desc: 'Púrpura original clásico' },
                            { id: 'rgb', name: 'Modo RGB Gamer / Neón', color: 'gamer-rgb-glow', desc: '¡Efecto RGB dinámico en todos los botones!' }
                        ].map((item) => {
                            const isSelected = theme === item.id;
                            return (
                                <button
                                    key={item.id}
                                    disabled={!isAdmin}
                                    onClick={() => setTheme(item.id)}
                                    className={`flex flex-col text-left p-3 rounded-2xl border transition duration-150 cursor-pointer select-none relative group ${
                                        isSelected 
                                            ? 'border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-xs ring-1 ring-indigo-500' 
                                            : !isAdmin
                                                ? 'border-slate-100 dark:border-slate-850 bg-slate-50/30 dark:bg-slate-905/30 opacity-60 cursor-not-allowed'
                                                : 'border-slate-150 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900/40 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-1.5 font-bold">
                                            <span className={`w-2.5 h-2.5 rounded-full ${item.color} shadow-xs shrink-0`} />
                                            <span className="text-[10.5px] font-extrabold text-slate-800 dark:text-slate-100">{item.name}</span>
                                        </div>
                                        {!isAdmin && (
                                            <Lock size={10} className="text-slate-400 dark:text-slate-500 shrink-0" />
                                        )}
                                        {isAdmin && isSelected && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-550 animate-ping" />
                                        )}
                                    </div>
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold leading-tight mt-1">{item.desc}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* RGB Theme Customizer - Interactive Section */}
                    {theme === 'rgb' && (
                        <div className="mt-4 animate-in slide-in-from-top-3 duration-250">
                            <RgbCustomizerPanel />
                        </div>
                    )}
                </div>

                {/* Audit Logs Table Panel */}
                <div className="md:col-span-7 bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850/40 p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-850/50">
                        <History className="text-slate-500" size={16} />
                        <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-850 dark:text-white">Historial de Cambios / Auditoría</h2>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto border border-slate-100 dark:border-slate-850/60 rounded-2xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-150 dark:border-slate-850/60 text-[8.5px] font-bold text-slate-400 uppercase tracking-widest">
                                    <th className="p-3 pl-4">Usuario</th>
                                    <th className="p-3 text-center">Tasa Anterior</th>
                                    <th className="p-3 text-center">Tasa Nueva</th>
                                    <th className="p-3 text-right pr-4">Fecha y Hora</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-850/50 text-[10px] font-bold">
                                {auditLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-6">
                                            <EmptyState
                                                icon={History}
                                                title="Sin cambios históricos"
                                                description="No se registran cambios históricos registrados del tipo de cambio oficial."
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    auditLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                                            <td className="p-3 pl-4 text-slate-700 dark:text-slate-350 uppercase">{log.username}</td>
                                            <td className="p-3 text-center font-mono text-slate-500">{(log.old_rate || 0).toFixed(2)} Bs.</td>
                                            <td className="p-3 text-center font-mono text-indigo-500">{(log.new_rate || 0).toFixed(2)} Bs.</td>
                                            <td className="p-3 text-right pr-4 font-mono text-slate-400 text-[9px]">
                                                {new Date(log.changed_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* INTERACTIVE DIGITAL RECEIPT TEMPLATE EDITOR AND EMULATOR */}
            <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850/40 p-6 flex flex-col gap-6">
                <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-850/50 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                            <Receipt size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-extrabold text-slate-850 dark:text-white uppercase tracking-wider">Diseñador de Plantilla de Recibos Térmicos</h2>
                            <p className="text-[11px] text-slate-400 mt-1 font-semibold">Personaliza visualmente qué información se imprime, el tamaño del papel, de las fuentes y ve el resultado en tiempo real.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleResetToDefault}
                            className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-[#070b13] dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 text-[10.5px] font-bold rounded-2xl flex items-center gap-1.5 cursor-pointer transition uppercase"
                        >
                            <RotateCcw size={12} />
                            Reiniciar
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadMockPDF}
                            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-600 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 text-[10.5px] font-bold rounded-2xl flex items-center gap-1.5 cursor-pointer transition uppercase"
                        >
                            <Printer size={12} />
                            Prueba PDF
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* LEFT PANEL: CONFIGURATIONS AND CONTROLS */}
                    <div className="lg:col-span-7 flex flex-col gap-5">
                        
                        {/* 1. TEXT PROPERTIES */}
                        <div className="border border-slate-100 dark:border-slate-850 rounded-2xl p-4.5 bg-slate-50/40 dark:bg-black/10 flex flex-col gap-4">
                            <h3 className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Type size={13} className="text-slate-450" />
                                Textos del Encabezado & Pie de Página
                            </h3>

                            <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300">Nombre de la Tienda (Logo)</label>
                                    <label className="relative inline-flex items-center cursor-pointer scale-90">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer"
                                            checked={showLogo}
                                            onChange={e => setShowLogo(e.target.checked)}
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-650 peer-checked:bg-indigo-600"></div>
                                        <span className="ml-2 text-[9.5px] font-extrabold uppercase tracking-wider text-slate-450">Mostrar</span>
                                    </label>
                                </div>
                                <input 
                                    type="text"
                                    disabled={!showLogo}
                                    className="w-full p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-bold text-slate-705 dark:text-white focus:outline-none focus:border-indigo-500 disabled:opacity-55"
                                    value={logoText}
                                    onChange={e => setLogoText(e.target.value)}
                                    placeholder="Nombre oficial o logo comercial..."
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300">Información del Encabezado (Encabezado secundario)</label>
                                <textarea 
                                    rows={3}
                                    className="w-full p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-semibold text-slate-600 dark:text-slate-300 focus:outline-none focus:border-indigo-500 leading-normal"
                                    value={headerText}
                                    onChange={e => setHeaderText(e.target.value)}
                                    placeholder="Ej: Dirección, NIT de la empresa, teléfono de contacto..."
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300">Mensaje del Pie de Página (Footer)</label>
                                <textarea 
                                    rows={3}
                                    className="w-full p-2.5 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-semibold text-slate-650 dark:text-slate-300 focus:outline-none focus:border-blue-500 leading-normal"
                                    value={footerText}
                                    onChange={e => setFooterText(e.target.value)}
                                    placeholder="Ej: ¡Gracias por su preferencia! No se aceptan devoluciones sin su recibo..."
                                />
                            </div>

                            {/* Ticket logo upload field */}
                            <div className="flex flex-col gap-1.5 border-t border-slate-100 dark:border-slate-850/50 pt-4">
                                <label className="text-[10.5px] font-bold text-slate-705 dark:text-slate-300">Logotipo o Fotografía para el Ticket impreso</label>
                                <p className="text-[9.5px] text-slate-400 mb-1 leading-normal">Carga una foto o logotipo comercial. Se autoajustará para integrarse de manera estética y futurista en la cabecera de tus PDFs.</p>
                                
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    {logoImage ? (
                                        <div className="relative w-18 h-18 bg-white dark:bg-black rounded-xl border p-1 border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-center">
                                            <img src={logoImage} className="max-w-full max-h-full object-contain" alt="Logo Ticket" />
                                            <button 
                                                type="button"
                                                onClick={() => setLogoImage(null)}
                                                className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm cursor-pointer"
                                                title="Eliminar logo"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-18 h-18 rounded-xl border border-dashed border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-black/25 flex flex-col items-center justify-center text-slate-400 shrink-0 select-none text-[9px] font-bold">
                                            Sin Logo
                                        </div>
                                    )}

                                    <div className="flex-1 w-full">
                                        <input 
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onloadend = () => {
                                                        setLogoImage(reader.result as string);
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                            className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-[10.5px] file:font-extrabold file:bg-blue-600 file:text-white hover:file:bg-blue-700 bg-slate-50 dark:bg-black/10 p-1.5 rounded-xl border border-slate-205 dark:border-slate-850 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. INCLUSION PROPERTIES - WHAT INFORMATION RENDER */}
                        <div className="border border-slate-100 dark:border-slate-850 rounded-2xl p-4.5 bg-slate-50/40 dark:bg-black/10 flex flex-col gap-3.5">
                            <h3 className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-850/50 pb-2">
                                <Eye size={13} className="text-slate-450" />
                                Visibilidad & Metadatos del Recibo
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-[#0c111e] rounded-xl border border-slate-150/40 dark:border-slate-850/30">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Mostrar Fecha y Hora</span>
                                    <input 
                                        type="checkbox"
                                        checked={showDate}
                                        onChange={e => setShowDate(e.target.checked)}
                                        className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-[#0c111e] rounded-xl border border-slate-150/40 dark:border-slate-850/30">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Mostrar Cajero (Atendió)</span>
                                    <input 
                                        type="checkbox"
                                        checked={showCashier}
                                        onChange={e => setShowCashier(e.target.checked)}
                                        className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-[#0c111e] rounded-xl border border-slate-150/40 dark:border-slate-850/30">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Información del Cliente</span>
                                    <input 
                                        type="checkbox"
                                        checked={showClientInfo}
                                        onChange={e => setShowClientInfo(e.target.checked)}
                                        className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-[#0c111e] rounded-xl border border-slate-150/40 dark:border-slate-850/30">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Mostrar Código SKU</span>
                                    <input 
                                        type="checkbox"
                                        checked={showItemSKU}
                                        onChange={e => setShowItemSKU(e.target.checked)}
                                        className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-[#0c111e] rounded-xl border border-slate-150/40 dark:border-slate-850/30">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Mostrar Método de Pago</span>
                                    <input 
                                        type="checkbox"
                                        checked={showPaymentMethod}
                                        onChange={e => setShowPaymentMethod(e.target.checked)}
                                        className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-[#0c111e] rounded-xl border border-slate-150/40 dark:border-slate-850/30">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Líneas Divisoras (Header)</span>
                                    <input 
                                        type="checkbox"
                                        checked={showHeaderDivider}
                                        onChange={e => setShowHeaderDivider(e.target.checked)}
                                        className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-[#0c111e] rounded-xl border border-slate-150/40 dark:border-slate-850/30 sm:col-span-2">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Línea Divisora de Pie de Página</span>
                                    <input 
                                        type="checkbox"
                                        checked={showFooterDivider}
                                        onChange={e => setShowFooterDivider(e.target.checked)}
                                        className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. LAYOUT AND MEASUREMENTS */}
                        <div className="border border-slate-100 dark:border-slate-850 rounded-2xl p-4.5 bg-slate-50/40 dark:bg-black/10 flex flex-col gap-4">
                            <h3 className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Sliders size={13} className="text-slate-450" />
                                Estilo, Tipografía & Formato de Impresión
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold text-slate-500">Familia Tipográfica</label>
                                    <select 
                                        className="p-2 border border-slate-200 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-bold text-slate-705 dark:text-white focus:outline-none"
                                        value={fontFamily}
                                        onChange={e => setFontFamily(e.target.value as any)}
                                    >
                                        <option value="Helvetica">Sans-Serif (Helvetica)</option>
                                        <option value="Courier">Monospaced (Courier)</option>
                                        <option value="Times">Serif (Times Roman)</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold text-slate-500">Ancho del Recibo Térmico</label>
                                    <div className="flex gap-2 p-1 bg-white dark:bg-[#0c111e] border border-slate-200 dark:border-slate-850 rounded-xl">
                                        <button 
                                            type="button"
                                            onClick={() => setTicketWidth(80)}
                                            className={`flex-1 py-1 text-[10px] font-extrabold rounded-lg transition ${ticketWidth === 80 ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#070b13]'}`}
                                        >
                                            80 mm (Estándar)
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setTicketWidth(58)}
                                            className={`flex-1 py-1 text-[10px] font-extrabold rounded-lg transition ${ticketWidth === 58 ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#070b13]'}`}
                                        >
                                            58 mm (Mini)
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-semibold text-slate-500">Fuentes (Header / Body): <span className="font-mono text-indigo-500 font-bold">{fontSizeHeader}pt / {fontSizeBody}pt</span></span>
                                    <div className="flex gap-4">
                                        <div className="flex-1 flex flex-col gap-0.5">
                                            <span className="text-[8px] text-slate-400 font-bold uppercase">Header</span>
                                            <input 
                                                type="range"
                                                min="10"
                                                max="18"
                                                step="1"
                                                value={fontSizeHeader}
                                                onChange={e => setFontSizeHeader(parseInt(e.target.value))}
                                                className="w-full accent-indigo-600 cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex-1 flex flex-col gap-0.5">
                                            <span className="text-[8px] text-slate-400 font-bold uppercase">Cuerpo</span>
                                            <input 
                                                type="range"
                                                min="5"
                                                max="11"
                                                step="1"
                                                value={fontSizeBody}
                                                onChange={e => setFontSizeBody(parseInt(e.target.value))}
                                                className="w-full accent-indigo-600 cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SUBMIT BUTTON */}
                        <button
                            type="button"
                            disabled={isSavingTemplate}
                            onClick={handleSaveTemplate}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.005] active:scale-95 disabled:opacity-50 text-white text-xs font-extrabold rounded-2xl shadow-indigo-500/10 shadow-md border border-indigo-550 flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider transition"
                        >
                            <Save size={13} />
                            {isSavingTemplate ? 'Guardando Plantilla...' : 'Guardar y Aplicar Plantilla de Recibo'}
                        </button>
                    </div>

                    {/* RIGHT PANEL: LIVE MOCK RECEIPT EMULATOR */}
                    <div className="lg:col-span-5 flex flex-col gap-3 lg:sticky lg:top-5 self-start">
                        <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-widest leading-none pl-1 flex items-center gap-1">
                            <Eye size={12} className="text-slate-400" />
                            Vista Previa en Tiempo Real de Impresión
                        </span>

                        <div className="border border-slate-200/80 dark:border-slate-850 p-4 rounded-3xl bg-slate-100 dark:bg-[#070b13] flex items-center justify-center relative min-h-[450px]">
                            <div 
                                id="ticket-emulator-paper" 
                                style={{
                                    width: ticketWidth === 58 ? '260px' : '340px',
                                    fontFamily: fontFamily === 'Courier' ? 'monospace' : fontFamily === 'Times' ? 'serif' : 'sans-serif'
                                }}
                                className="bg-white text-slate-800 p-5 shadow-xl border-dashed border-t-4 border-b-4 border-slate-300 dark:border-slate-450 relative transition-all duration-300 transform rounded-lg"
                            >
                                {/* Ticket Header/Logo */}
                                {showLogo && (
                                    <div className="flex flex-col items-center mb-1.5">
                                        {logoImage && (
                                            <div className="w-14 h-14 mb-2 flex items-center justify-center p-0.5 border border-slate-200 rounded-lg bg-white overflow-hidden">
                                                <img src={logoImage} className="max-w-full max-h-full object-contain" alt="Logo Preview" />
                                            </div>
                                        )}
                                        {logoText && (
                                            <div 
                                                style={{ fontSize: `${fontSizeHeader}px` }} 
                                                className="text-center font-black tracking-tight text-slate-900 border-none leading-tight uppercase"
                                            >
                                                {logoText}
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* Custom Header Lines */}
                                {headerText && (
                                    <div 
                                        style={{ fontSize: `${fontSizeBody}px` }} 
                                        className="text-center text-slate-550 whitespace-pre-wrap mt-1 leading-normal font-semibold"
                                    >
                                        {headerText}
                                    </div>
                                )}
                                
                                {/* Header Divider */}
                                {showHeaderDivider && (
                                    <div className="text-center font-mono my-2 text-slate-400 select-none text-[10px]">
                                        {'-'.repeat(ticketWidth === 58 ? 28 : 40)}
                                    </div>
                                )}
                                
                                {/* Metadata lines */}
                                <div style={{ fontSize: `${fontSizeBody}px` }} className="text-slate-600 space-y-0.5 leading-snug font-semibold text-left">
                                    {showDate && (
                                        <div>
                                            <span className="font-extrabold text-slate-400">Fecha:</span> {new Date().toLocaleString()}
                                        </div>
                                    )}
                                    {showCashier && (
                                        <div>
                                            <span className="font-extrabold text-slate-400">Atendió:</span> {user?.username || 'admin'} [PRUEBA]
                                        </div>
                                    )}
                                    {showClientInfo && (
                                        <div>
                                            <span className="font-extrabold text-slate-400">Cliente:</span> Juan Pérez (77712345)
                                        </div>
                                    )}
                                </div>
                                
                                {/* Column dividers title */}
                                <div className="mt-3 flex justify-between font-extrabold text-[9px] text-slate-700 uppercase tracking-widest leading-none border-b border-slate-200 pb-1">
                                    <span>CANT &nbsp; PRODUCTO</span>
                                    <span>SUB (Bs.)</span>
                                </div>
                                
                                {/* Items Divider */}
                                <div className="text-center font-mono text-[9px] text-slate-300 my-1 select-none">
                                    {'-'.repeat(ticketWidth === 58 ? 28 : 40)}
                                </div>
                                
                                {/* Dynamic Mock Item Loop matching Image 2 */}
                                <div style={{ fontSize: `${fontSizeBody}px` }} className="space-y-1.5 mt-2 text-slate-800 leading-snug font-semibold text-left">
                                    <div className="flex flex-col">
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-1.5 truncate max-w-[170px]">
                                                <span className="font-extrabold text-slate-900">5x</span>
                                                <span className="font-normal text-slate-800 truncate">Samsung 16gb</span>
                                            </div>
                                            <span className="font-extrabold text-slate-900 font-mono shrink-0">Bs. 825.00</span>
                                        </div>
                                        {showItemSKU && (
                                            <span className="text-[9px] font-mono italic text-slate-400 leading-none ml-5">SKU: SAM-16GB-RAM</span>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-col">
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-1.5 truncate max-w-[170px]">
                                                <span className="font-extrabold text-slate-900">7x</span>
                                                <span className="font-normal text-slate-800 truncate">Micro sony 8</span>
                                            </div>
                                            <span className="font-extrabold text-slate-900 font-mono shrink-0">Bs. 616.00</span>
                                        </div>
                                        {showItemSKU && (
                                            <span className="text-[9px] font-mono italic text-slate-400 leading-none ml-5">SKU: SONY-MICRO-8</span>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Items Footer Divider */}
                                <div className="text-center font-mono text-[9px] text-slate-300 my-1 select-none">
                                    {'-'.repeat(ticketWidth === 58 ? 28 : 40)}
                                </div>
                                
                                {/* Subtotal & total values */}
                                <div style={{ fontSize: `${fontSizeBody}px` }} className="space-y-1 font-semibold text-left mt-1.5">
                                    <div className="flex justify-between text-slate-500">
                                        <span>Subtotal:</span>
                                        <span className="font-mono">Bs. 1441.00</span>
                                    </div>
                                    <div className="flex justify-between font-black text-slate-900 border-t border-slate-100 pt-1.5 text-[11px]">
                                        <span>TOTAL GENERAL:</span>
                                        <span className="font-mono">Bs. 1441.00</span>
                                    </div>
                                </div>
                                
                                {/* Payment Line */}
                                {showPaymentMethod && (
                                    <div style={{ fontSize: `${fontSizeBody}px` }} className="text-slate-500 mt-2 font-semibold text-left">
                                        <span className="font-extrabold text-slate-400">Pago:</span> Efectivo [BOB]
                                    </div>
                                )}
                                
                                {/* Footer Divider */}
                                {showFooterDivider && (
                                    <div className="text-center font-mono my-2 text-slate-300 select-none text-[10px]">
                                        {'-'.repeat(ticketWidth === 58 ? 28 : 40)}
                                    </div>
                                )}
                                
                                {/* Custom Footer */}
                                {footerText && (
                                    <div 
                                        style={{ fontSize: `${fontSizeBody}px` }} 
                                        className="text-center text-slate-500 font-semibold whitespace-pre-wrap leading-normal mt-1 italic"
                                    >
                                        {footerText}
                                    </div>
                                )}

                                {/* Audit scan barcode emulator */}
                                <div className="mt-3 text-center flex flex-col items-center gap-1 opacity-80 pt-1">
                                    <span className="text-[7px] font-mono font-semibold text-slate-400 tracking-wider">SCAN DE AUDITORIA DIGITAL GTR-POS</span>
                                    <div className="flex items-center justify-center gap-0.5 h-5 px-4 my-0.5">
                                        <div className="w-0.5 h-full bg-slate-800" />
                                        <div className="w-1 h-full bg-slate-800" />
                                        <div className="w-0.5 h-full bg-slate-800" />
                                        <div className="w-1.5 h-full bg-slate-800" />
                                        <div className="w-0.5 h-full bg-slate-800" />
                                        <div className="w-1 h-full bg-slate-800" />
                                        <div className="w-0.5 h-full bg-slate-800" />
                                        <div className="w-2 h-full bg-slate-800" />
                                        <div className="w-0.5 h-full bg-slate-800" />
                                        <div className="w-1.5 h-full bg-slate-800" />
                                        <div className="w-0.5 h-full bg-slate-800" />
                                    </div>
                                    <span className="text-[8px] font-mono font-bold text-slate-700">*GTR-62*</span>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* CRM & Loyalty Points management panel (Sugerencia 3) */}
            <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850/40 p-6 flex flex-col gap-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-extrabold text-slate-850 dark:text-white uppercase tracking-wider flex items-center gap-2">
                            <Users className="text-[#6366f1]" size={16} />
                            Programa de Fidelización de Clientes & CRM
                        </h2>
                        <p className="text-[11px] text-slate-400 mt-1 font-semibold">
                            Monitorea y ajusta el saldo de puntos acumulados de tus compradores frecuentes. 10 Puntos = 1.00 Bs de descuento.
                        </p>
                    </div>
                    
                    {/* CRM Search Input */}
                    <div className="relative w-full md:w-72 shrink-0">
                        <input
                            type="text"
                            placeholder="Buscar cliente por nombre..."
                            className="w-full p-2 pl-9 pr-8 bg-slate-50 dark:bg-[#070b13] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500 dark:text-white"
                            value={crmSearch}
                            onChange={e => setCrmSearch(e.target.value)}
                        />
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={13} />
                        {crmSearch && (
                            <button
                                type="button"
                                onClick={() => setCrmSearch('')}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* CRM Client list */}
                <div className="border border-slate-100 dark:border-slate-850 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-black/10 border-b border-slate-100 dark:border-slate-850 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                <th className="p-3">Cliente</th>
                                <th className="p-3">Contacto / Celular</th>
                                <th className="p-3 text-right">Puntos Acumulados</th>
                                <th className="p-3 text-right">Valor Canjeable</th>
                                <th className="p-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-850/50 text-xs text-slate-755 dark:text-slate-350">
                            {clients && clients.length > 0 ? (
                                clients
                                    .filter(c => {
                                        const query = crmSearch.toLowerCase().trim();
                                        if (!query) return true;
                                        const searchTerms = query.split(/\s+/);
                                        const searchableText = `${c.name} ${c.phone || ""}`.toLowerCase();
                                        return searchTerms.every(term => searchableText.includes(term));
                                    })
                                    .map(c => {
                                        const isEditing = editingClientPointsId === c.id;
                                        const cPoints = c.points || 0;
                                        return (
                                            <tr key={c.id} className="hover:bg-slate-50/25 dark:hover:bg-slate-850/10 transition">
                                                <td className="p-3 font-extrabold uppercase text-slate-805 dark:text-slate-100">{c.name}</td>
                                                <td className="p-3 font-mono text-[11px] font-bold text-slate-400">{c.phone || "Particular / Sin contacto"}</td>
                                                <td className="p-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">
                                                    {isEditing ? (
                                                        <input
                                                            type="number"
                                                            className="p-1 w-20 bg-white dark:bg-[#0c111e] border border-slate-250 dark:border-slate-800 rounded-lg text-xs font-bold text-right focus:outline-none focus:ring-1 focus:ring-indigo-505 dark:text-white"
                                                            value={editingPointsValue}
                                                            onChange={e => setEditingPointsValue(Math.max(0, Number(e.target.value)))}
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        `${cPoints} pts`
                                                    )}
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold text-slate-400">
                                                    Bs. {(cPoints / 10).toFixed(2)}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex justify-center gap-1.5">
                                                        {isEditing ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleUpdateClientPoints(c.id, editingPointsValue)}
                                                                    disabled={isUpdatingPoints}
                                                                    className="px-2 py-1 bg-emerald-650 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-emerald-500 transition select-none cursor-pointer"
                                                                >
                                                                    Guardar
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingClientPointsId(null)}
                                                                    className="px-2 py-1 bg-slate-105 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-200 transition select-none cursor-pointer"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    setEditingClientPointsId(c.id);
                                                                    setEditingPointsValue(cPoints);
                                                                }}
                                                                className="px-2.5 py-1 bg-white hover:bg-slate-50 dark:bg-[#0c111e] dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition select-none cursor-pointer"
                                                            >
                                                                Ajustar Puntos
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                                        Aún no hay clientes registrados en el sistema.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Database Sync Dashboard and Backup/Restore Controls */}
            <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850/40 p-6 flex flex-col gap-6">
                <div>
                    <h2 className="text-sm font-extrabold text-slate-850 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Database className="text-[#6366f1]" size={16} />
                        Gestión de Base de Datos, Respaldos & Google Cloud Sync
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-1 font-semibold">
                        Monitorea tu sincronización en tiempo real con Google Cloud y gestiona copias de seguridad de toda la caja fiscal.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    
                    {/* Google Cloud Info Panel */}
                    <div className="border border-slate-100 dark:border-slate-850 rounded-2xl p-5 bg-slate-50/50 dark:bg-[#0c111f]/30 flex flex-col gap-4">
                        <div className="flex justify-between items-center bg-white dark:bg-[#0c111e] p-3 rounded-xl border border-slate-100 dark:border-slate-850">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Estado de Cloud Database:</span>
                            <span className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 text-[10px] font-black uppercase px-3 py-1 rounded-xl border border-emerald-500/20 shadow-xs flex items-center gap-1.5 animate-pulse">
                                <Cloud size={12} />
                                Activo & Sincronizado
                            </span>
                        </div>

                        <div className="flex flex-col gap-3">
                            <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <ShieldCheck className="text-emerald-500" size={14} />
                                Seguridad & Permanencia Real
                            </h3>
                            <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                                Tu terminal de caja cuenta con un motor **híbrido local-primero**. Las operaciones se escriben inmediatamente en una base de datos local SQLite para velocidad instantánea en ventas (0ms latencia) y se replican asíncronamente en segundo plano a la base de datos **Google Cloud Firestore**. 
                            </p>
                            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed bg-white dark:bg-[#0c111e] p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                Tus registros están guardados de forma real y permanente en la infraestructura de Google, previniendo cualquier pérdida si tu terminal actual se deforma o pierde.
                            </p>
                        </div>

                        {/* Pricing and Stats Breakdown */}
                        <div className="flex flex-col gap-2.5">
                            <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">Estructura de costos estimados (Spark Plan de GCP)</span>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-2.5 bg-slate-100/50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-850 flex flex-col gap-0.5 text-center">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Lectura diaria</span>
                                    <span className="text-[11px] font-mono font-black text-slate-700 dark:text-slate-300">50,000 Gratis</span>
                                    <span className="text-[8px] text-slate-450 font-mono">Luego $0.06/100k</span>
                                </div>
                                <div className="p-2.5 bg-slate-100/50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-850 flex flex-col gap-0.5 text-center">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Escritura diaria</span>
                                    <span className="text-[11px] font-mono font-black text-slate-700 dark:text-slate-300">20,000 Gratis</span>
                                    <span className="text-[8px] text-slate-450 font-mono">Luego $0.18/100k</span>
                                </div>
                                <div className="p-2.5 bg-slate-100/50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-850 flex flex-col gap-0.5 text-center">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Almacenamiento</span>
                                    <span className="text-[11px] font-mono font-black text-slate-700 dark:text-slate-300">1 GB Gratis</span>
                                    <span className="text-[8px] text-slate-450 font-mono">Luego $0.18/GB</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Import/Export Backup Controls */}
                    <div className="border border-slate-100 dark:border-slate-850 rounded-2xl p-5 bg-slate-50/50 dark:bg-[#0c111f]/30 flex flex-col gap-5 h-full justify-between">
                        <div className="flex flex-col gap-3.5">
                            <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <FileJson className="text-indigo-500" size={14} />
                                Respaldos Manuales Fuera de Línea
                            </h3>
                            <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                                Descargue toda la base de datos de su negocio (incluyendo usuarios, productos, stock, clientes, ventas unitarias, cierres de caja y auditorías) en un único archivo plano JSON que podrá resguardar de forma offline e importar en cualquier momento.
                            </p>
                        </div>

                        {importError && (
                            <div className="p-3.5 bg-rose-500/10 text-rose-600 dark:bg-rose-500/5 dark:text-rose-400 border border-rose-500/15 rounded-xl text-[10px] font-bold leading-normal flex items-start gap-2 animate-in fade-in">
                                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-extrabold block uppercase tracking-wide">Error en restauración:</span>
                                    {importError}
                                </div>
                            </div>
                        )}

                        {importSuccess && (
                            <div className="p-3.5 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/5 dark:text-emerald-400 border border-emerald-500/15 rounded-xl text-[10px] font-bold leading-normal flex items-start gap-2 animate-in fade-in">
                                <ShieldCheck size={14} className="shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-extrabold block uppercase tracking-wide">¡Restauración exitosa!</span>
                                    La base de datos fue reemplazada con éxito. El sistema de caja fiscal se reiniciará automáticamente en unos segundos...
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Export Button (JSON) */}
                            <button
                                type="button"
                                disabled={isBackingUp || isImporting}
                                onClick={handleDownloadBackup}
                                className="p-4 bg-white hover:bg-slate-50/80 dark:bg-[#0c111e] dark:hover:bg-slate-900/60 border border-slate-205 dark:border-slate-850 rounded-2xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-xs transition group hover:border-[#6366f1]/40 animate-in fade-in"
                            >
                                <Download size={22} className="text-[#6366f1] transition group-hover:scale-110" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11.5px] font-extrabold text-slate-800 dark:text-slate-200">Exportar Base JSON</span>
                                    <span className="text-[9px] font-bold text-slate-400">Descargar copia completa (.json)</span>
                                </div>
                            </button>

                            {/* Raw SQLite DB Download */}
                            <button
                                type="button"
                                disabled={isBackingUp || isImporting}
                                onClick={handleDownloadRawDb}
                                className="p-4 bg-white hover:bg-slate-50/80 dark:bg-[#0c111e] dark:hover:bg-slate-900/60 border border-slate-205 dark:border-slate-850 rounded-2xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-xs transition group hover:border-[#6366f1]/40 animate-in fade-in"
                            >
                                <HardDrive size={22} className="text-cyan-600 dark:text-cyan-400 transition group-hover:scale-110" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11.5px] font-extrabold text-slate-800 dark:text-slate-200">Descargar SQLite Nativo</span>
                                    <span className="text-[9px] font-bold text-slate-400">Archivo binario real (gtr_pos.db)</span>
                                </div>
                            </button>

                            {/* Drive Backup Button */}
                            <button
                                type="button"
                                disabled={isBackingUp || isImporting}
                                onClick={handleDriveBackup}
                                className="p-4 bg-white hover:bg-slate-50/80 dark:bg-[#0c111e] dark:hover:bg-slate-900/60 border border-slate-205 dark:border-slate-850 rounded-2xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-xs transition group hover:border-[#6366f1]/40 animate-in fade-in sm:col-span-2"
                            >
                                <Database size={22} className="text-[#6366f1] transition group-hover:scale-110" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11.5px] font-extrabold text-slate-800 dark:text-slate-200">Respaldar en Google Drive</span>
                                    <span className="text-[9px] font-bold text-slate-400">Guardar base de datos en la nube de Google</span>
                                </div>
                            </button>

                            {/* Create Immediate Snapshot Button */}
                            <button
                                type="button"
                                disabled={isCreatingSnapshot || isRestoringSafety}
                                onClick={handleCreateSnapshot}
                                className="sm:col-span-2 p-4 bg-gradient-to-r from-cyan-50 to-blue-50/60 dark:from-[#0c111e] dark:hover:bg-slate-900/60 border border-cyan-200 dark:border-cyan-950/40 rounded-2xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-xs transition group hover:border-cyan-500/40 animate-in fade-in"
                            >
                                <Archive size={22} className={`text-cyan-600 dark:text-cyan-400 transition group-hover:scale-110 ${isCreatingSnapshot ? 'animate-spin' : ''}`} />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11.5px] font-extrabold text-slate-800 dark:text-slate-200">
                                        {isCreatingSnapshot ? 'Generando Instantánea...' : 'Crear Instantánea Local de Seguridad Ahora'}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400">Crea un punto de restauración exacto sin cerrar caja ni interrumpir</span>
                                </div>
                            </button>

                            {/* Import File Button wrapper */}
                            <label className={`p-4 bg-white hover:bg-slate-50/80 dark:bg-[#0c111e] dark:hover:bg-slate-900/60 border border-slate-205 dark:border-slate-850 rounded-2xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-xs transition group hover:border-[#6366f1]/40 relative sm:col-span-2 ${isImporting || isValidatingFile ? 'opacity-65 pointer-events-none' : ''} animate-in fade-in`}>
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleSelectBackupFile}
                                    className="hidden"
                                    disabled={isBackingUp || isImporting || isValidatingFile}
                                />
                                {isImporting || isValidatingFile ? (
                                    <RefreshCw size={22} className="text-[#6366f1] animate-spin" />
                                ) : (
                                    <Upload size={22} className="text-[#6366f1] transition group-hover:scale-110" />
                                )}
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11.5px] font-extrabold text-slate-800 dark:text-slate-200">
                                        {isImporting ? 'Restaurando...' : isValidatingFile ? 'Validando Archivo...' : 'Importar Copia JSON'}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400">Integrar datos de respaldo</span>
                                </div>
                            </label>

                            {/* Manual Cloud Push Button */}
                            <button
                                type="button"
                                disabled={isSyncingCloud}
                                onClick={handleCloudPush}
                                className="p-4 bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-[#0c111e] dark:hover:bg-slate-900 border border-emerald-200 dark:border-emerald-950/60 rounded-2xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-xs transition group hover:border-[#10b981]/40 animate-in fade-in"
                            >
                                <CloudUpload size={22} className="text-emerald-500 transition group-hover:scale-110" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11.5px] font-extrabold text-slate-800 dark:text-slate-200">Subir Local ➔ Nube</span>
                                    <span className="text-[9px] font-bold text-slate-400">Forzar reparación de web pública</span>
                                </div>
                            </button>

                            {/* Manual Cloud Pull Button */}
                            <button
                                type="button"
                                disabled={isSyncingCloud}
                                onClick={handleCloudPull}
                                className="p-4 bg-gradient-to-r from-indigo-50 to-indigo-100/35 dark:from-[#0c111e] dark:hover:bg-slate-900 border border-indigo-200 dark:border-indigo-950/60 rounded-2xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-xs transition group hover:border-[#6366f1]/40 animate-in fade-in"
                            >
                                <CloudDownload size={22} className="text-[#6366f1] transition group-hover:scale-110" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11.5px] font-extrabold text-slate-800 dark:text-slate-200">Nube ➔ SQLite Local</span>
                                    <span className="text-[9px] font-bold text-slate-400">Restaurar local desde la web</span>
                                </div>
                            </button>

                            {/* Restore SQLite Safety Backup Button */}
                            <button
                                type="button"
                                disabled={isRestoringSafety}
                                onClick={handleRestoreSafetyBackup}
                                className="sm:col-span-2 p-4 bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-[#0c111e] dark:hover:bg-slate-900/60 border border-amber-200 dark:border-amber-950/40 rounded-2xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-xs transition group hover:border-[#f59e0b]/40 animate-in fade-in"
                            >
                                <Activity size={22} className="text-amber-500 transition group-hover:scale-110 animate-pulse" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11.5px] font-extrabold text-slate-800 dark:text-slate-200">Restaurar Copia Local Auto-Guardada (.bak)</span>
                                    <span className="text-[9px] font-bold text-slate-400">Recuperación de emergencia de SQLite local previa a pérdidas</span>
                                </div>
                            </button>

                            {/* Limpiar caché y reindexar Button */}
                            <button
                                type="button"
                                disabled={isCleaningCache}
                                onClick={handleClearCacheAndReindex}
                                className="sm:col-span-2 p-4 bg-gradient-to-r from-rose-50 to-red-50/50 dark:from-[#0c111e] dark:hover:bg-slate-900/60 border border-rose-200 dark:border-rose-950/40 rounded-2xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-xs transition group hover:border-rose-500/40 animate-in fade-in"
                            >
                                <RefreshCw size={22} className={`text-rose-500 transition group-hover:scale-110 ${isCleaningCache ? 'animate-spin' : ''}`} />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11.5px] font-extrabold text-slate-800 dark:text-slate-200">Limpiar caché y reindexar</span>
                                    <span className="text-[9px] font-bold text-slate-400">
                                        {isCleaningCache ? cacheCleanStep : "Fuerza una recarga limpia purgando archivos locales y re-solicitando datos actualizados del servidor"}
                                    </span>
                                </div>
                            </button>

                            {/* Reiniciar Base de Datos a Cero Button */}
                            <button
                                type="button"
                                disabled={isLoading || isResettingDb}
                                onClick={handleOpenResetModal}
                                className="sm:col-span-2 p-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-2xl flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-md transition group animate-in fade-in"
                            >
                                <Trash2 size={22} className="text-white transition group-hover:scale-110" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11.5px] font-black uppercase tracking-wider">Reiniciar Base de Datos a Cero</span>
                                    <span className="text-[9.5px] font-medium text-rose-100">Pone a cero la base de datos (ventas, productos, clientes) tanto localmente como en Google Cloud</span>
                                </div>
                            </button>
                        </div>

                        {/* Local Snapshots History Panel */}
                        <div className="mt-2 border border-slate-200 dark:border-slate-850 bg-white dark:bg-[#070b13] rounded-2xl p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Archive size={15} className="text-cyan-600 dark:text-cyan-400" />
                                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                        Puntos de Restauración Automáticos en Servidor ({snapshots.length})
                                    </h4>
                                </div>
                                <button
                                    type="button"
                                    onClick={fetchSnapshots}
                                    disabled={isLoadingSnapshots}
                                    className="px-2.5 py-1 text-[9.5px] font-bold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1 cursor-pointer transition"
                                >
                                    <RefreshCw size={11} className={isLoadingSnapshots ? 'animate-spin' : ''} />
                                    Actualizar
                                </button>
                            </div>

                            {snapshots.length === 0 ? (
                                <p className="text-[10px] text-slate-400 italic py-2">
                                    No hay instantáneas locales registradas aún. El servidor genera una automáticamente cada 4 horas y al arrancar.
                                </p>
                            ) : (
                                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                                    {snapshots.map((snap) => (
                                        <div
                                            key={snap.filename}
                                            className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-850 flex items-center justify-between gap-2 text-[10.5px]"
                                        >
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-slate-700 dark:text-slate-300 truncate font-mono text-[10px]">
                                                    {snap.filename}
                                                </span>
                                                <span className="text-[9px] text-slate-400">
                                                    {snap.formattedDate} • {(snap.sizeBytes / 1024).toFixed(1)} KB
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleDownloadSnapshotFile(snap.filename)}
                                                    className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[9px] font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
                                                    title="Descargar este punto de restauración"
                                                >
                                                    <Download size={10} />
                                                    Descargar
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isRestoringSafety}
                                                    onClick={() => handleRestoreSnapshot(snap.filename)}
                                                    className="px-2 py-1 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 border border-rose-200 dark:border-rose-900/40 cursor-pointer transition shadow-2xs"
                                                    title="Restaurar a este momento exacto"
                                                >
                                                    <RotateCcw size={10} />
                                                    Restaurar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>

                        {/* Modo Quiosco / Terminal Seguro */}
            <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850/40 p-6 flex flex-col gap-6">
                <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-850/50 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                            <Lock size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-extrabold text-slate-850 dark:text-white uppercase tracking-wider">Modo Quiosco / Terminal Seguro</h2>
                            <p className="text-[11px] text-slate-400 mt-1 font-semibold">Bloquea la interfaz gráfica y oculta la barra de navegación para cajeros.</p>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-4">
                        <Info className="text-indigo-500 shrink-0 mt-0.5" size={18} />
                        <div className="flex-1">
                            <h3 className="text-xs font-bold text-slate-850 dark:text-white mb-1.5">Bloqueo de Navegación del Terminal</h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                Al activar esta opción, la aplicación forzará la vista completa de la terminal de <strong>Caja (POS)</strong> y deshabilitará la navegación para cualquier usuario que no sea administrador. Útil para terminales dedicadas exclusivamente a ventas.
                            </p>
                        </div>
                        <div className="pt-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={kioskMode} 
                                    onChange={(e) => {
                                        const val = e.target.checked;
                                        setKioskMode(val);
                                        if (val && document.documentElement.requestFullscreen) {
                                            document.documentElement.requestFullscreen().catch(() => {});
                                        } else if (!val && document.fullscreenElement) {
                                            document.exitFullscreen().catch(() => {});
                                        }
                                        showNotification(`Modo Quiosco ${val ? 'Activado' : 'Desactivado'}`, 'success');
                                    }}
                                    disabled={!isAdmin}
                                />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Version PUSH Controller for Admins */}
            <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850/40 p-6 flex flex-col gap-6">
                <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-850/50 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 text-orange-500 rounded-xl">
                            <RefreshCw size={18} className="animate-spin" style={{ animationDuration: '3s' }} />
                        </div>
                        <div>
                            <h2 className="text-sm font-extrabold text-slate-855 dark:text-white uppercase tracking-wider">Centro de Sincronización y Actualizaciones PUSH</h2>
                            <p className="text-[11px] text-slate-400 mt-1 font-semibold">Notifique y exija la actualización en tiempo real de todos los dispositivos activos en sucursales.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    <div className="md:col-span-6 flex flex-col gap-4">
                        <div className="p-4 rounded-2xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/10 flex items-start gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 animate-ping shrink-0" />
                            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-350 leading-relaxed">
                                <strong className="text-orange-500 font-extrabold block mb-1">¿Cómo funciona la actualización forzada?</strong>
                                Al cambiar la versión del servidor, todos los otros navegadores/móviles abiertos en sucursal recibirán una <strong className="text-orange-555">señal push vía WebSocket</strong> bloqueándolos de inmediato con un mensaje de reinicio de software obligatorio y limpiando la caché automáticamente para sincronizar tus últimos precios, stock y funciones de IA de Life.
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9.5px] font-extrabold uppercase tracking-widest text-[#64748b]">Versión del Software (Servidor)</label>
                                <input 
                                    type="text" 
                                    className="p-2.5 border border-slate-205 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-mono font-black text-slate-705 dark:text-white focus:outline-none focus:border-orange-500"
                                    value={pushVersion}
                                    onChange={e => setPushVersion(e.target.value)}
                                    placeholder="Ej: 2.4.0"
                                    disabled={!isAdmin || isPushingUpdate}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[9.5px] font-extrabold uppercase tracking-widest text-[#64748b]">Notas de Lanzamiento / Mensaje Push</label>
                                <textarea 
                                    rows={3}
                                    className="p-2.5 border border-slate-205 dark:border-slate-850 rounded-xl dark:bg-[#070b13] text-xs font-semibold text-slate-705 dark:text-white focus:outline-none focus:border-orange-500 resize-none"
                                    value={pushNotes}
                                    onChange={e => setPushNotes(e.target.value)}
                                    placeholder="Detalla las nuevas funciones agregadas para el cajero..."
                                    disabled={!isAdmin || isPushingUpdate}
                                />
                            </div>

                            <button
                                type="button"
                                disabled={!isAdmin || isPushingUpdate}
                                onClick={handleTriggerPushUpdate}
                                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-black rounded-2xl shadow-lg shadow-orange-500/15 border border-orange-550 flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider transition disabled:opacity-50"
                            >
                                <RefreshCw size={13} className={isPushingUpdate ? "animate-spin" : ""} />
                                {isPushingUpdate ? 'Empujando Actualización...' : 'Emitir Señal Push a Sucursales'}
                            </button>
                        </div>
                    </div>

                    <div className="md:col-span-6 border border-slate-205 dark:border-slate-850 rounded-2xl p-5 bg-slate-50/50 dark:bg-[#0c111f]/35 flex flex-col gap-4">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">Vista Previa de Notificación (Cajero)</span>
                        
                        <div className="border border-orange-500/20 bg-white dark:bg-[#070b13] rounded-2xl p-4 flex flex-col gap-3 shadow-md">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-3 w-3 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-orange-500 font-mono">Actualización Requerida</span>
                                    <span className="font-sans font-black text-slate-855 dark:text-white text-xs leading-none">GTR POS v{pushVersion || "2.4.0"}</span>
                                </div>
                            </div>

                            <p className="text-[10px] font-bold text-slate-500 leading-normal">
                                Se ha implementado una nueva versión en el servidor. Tus terminales se pausarán automáticamente mostrando esta advertencia:
                            </p>

                            <div className="p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/10 italic text-[9.5px] font-medium text-slate-505 dark:text-slate-400">
                                "{pushNotes || 'Se han optimizado los módulos de caja, corregido los cálculos e integrado IA avanzada.'}"
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* PWA Installation Module with Dynamic Detector */}
            {!isPwaInstalled ? (
                <div className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850/40 p-6 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-850/50 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                <Smartphone size={18} className="animate-bounce" />
                            </div>
                            <div>
                                <h2 className="text-sm font-extrabold text-slate-855 dark:text-white uppercase tracking-wider flex items-center gap-2">
                                    Instalar GTR POS en este dispositivo
                                </h2>
                                <p className="text-[11px] text-slate-400 mt-1 font-semibold">
                                    Disfruta de la aplicación como software nativo en pantalla completa, sin la barra de direcciones del navegador, con mayor velocidad de respuesta y soporte de hardware optimizado.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                        <div className="md:col-span-8">
                            <p className="text-xs font-bold text-slate-650 dark:text-slate-300 leading-relaxed mb-3">
                                Al instalar GTR POS, la aplicación se agregará al escritorio de tu computadora o a la pantalla de inicio de tu celular Android/iOS como una PWA (Progressive Web App). Esto te permite:
                            </p>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                                <li className="flex items-center gap-1.5">
                                    <span className="text-emerald-500 font-bold">✓</span> Ejecución nativa sin distracciones.
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <span className="text-emerald-500 font-bold">✓</span> Funcionamiento sin conexión a internet (Modo Offline).
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <span className="text-emerald-500 font-bold">✓</span> Rendimiento y velocidad de renderizado óptimos.
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <span className="text-emerald-500 font-bold">✓</span> Acceso directo instantáneo con un toque.
                                </li>
                            </ul>
                        </div>

                        <div className="md:col-span-4 flex justify-end">
                            <button
                                type="button"
                                onClick={handlePwaPrimaryAction}
                                disabled={isUpdatingPwa}
                                className={`w-full md:w-auto px-6 py-3.5 text-white text-xs font-black rounded-2xl shadow-lg border flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider transition group hover:scale-[1.02] active:scale-[0.98] ${
                                    hasPwaUpdate 
                                        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 border-amber-400/40 shadow-amber-500/20 animate-pulse'
                                        : 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 hover:from-indigo-700 hover:to-blue-800 border-indigo-505/20 shadow-indigo-505/15'
                                }`}
                            >
                                {isUpdatingPwa ? (
                                    <>
                                        <RefreshCw size={13} className="animate-spin shrink-0" />
                                        <span className="font-mono text-[11px]">{pwaUpdateStepMessage || 'Limpiando caché...'}</span>
                                    </>
                                ) : hasPwaUpdate ? (
                                    <>
                                        <Sparkles size={13} className="text-yellow-200 animate-bounce" />
                                        <span>Actualizar a v{pwaVersionInfo.latestVersion} Ahora</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={13} className="text-amber-300 animate-pulse" />
                                        <span>Instalar GTR POS (App Nativa)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-emerald-500/10 dark:bg-[#091b16] border border-emerald-550/20 dark:border-emerald-950 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-300">
                    <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                        <div className="p-2 bg-emerald-500/10 rounded-xl shrink-0">
                            <Smartphone size={18} />
                        </div>
                        <div>
                            <h2 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                                ¡GTR POS está instalado como PWA! <span className="text-[9px] font-black uppercase bg-emerald-555/15 text-emerald-600 px-1.5 py-0.5 rounded-lg">v{pwaVersionInfo.currentVersion}</span>
                            </h2>
                            <p className="text-[10.5px] font-semibold opacity-85 mt-0.5">La aplicación se está ejecutando de forma nativa e independiente en este dispositivo con soporte offline completo.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePwaPrimaryAction}
                            disabled={isUpdatingPwa}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer shadow-sm ${
                                hasPwaUpdate
                                    ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white border border-amber-400/40 animate-pulse'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            {isUpdatingPwa ? (
                                <>
                                    <RefreshCw size={13} className="animate-spin shrink-0" />
                                    <span className="font-mono text-[11px]">{pwaUpdateStepMessage || 'Limpiando caché...'}</span>
                                </>
                            ) : hasPwaUpdate ? (
                                <>
                                    <Sparkles size={13} className="text-yellow-200" />
                                    <span>{`Actualizar a v${pwaVersionInfo.latestVersion}`}</span>
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={13} className="text-emerald-500" />
                                    <span>Buscar Actualizaciones</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN Y AUDITORÍA DE RESTAURACIÓN DE BASE DE DATOS */}
            {isRestoreModalOpen && restoreValidationData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0c111e] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
                        
                        {/* Modal Header */}
                        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-850 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
                                    <FileJson size={24} />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                                        Validación e Integración de Base de Datos
                                    </h3>
                                    <p className="text-[11px] font-semibold text-slate-400">
                                        Se verificó la integridad del archivo de respaldo JSON seleccionado.
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => {
                                    setIsRestoreModalOpen(false);
                                    setRestoreValidationData(null);
                                }}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Integrity Checksum Badge */}
                        <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
                            restoreValidationData.validation.checksumValid 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                        }`}>
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={18} className="shrink-0" />
                                <span>{restoreValidationData.validation.checksumMessage || "✓ Archivo 100% verificado e íntegro"}</span>
                            </div>
                            <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-white/40 dark:bg-black/30">
                                GTR POS v2.0
                            </span>
                        </div>

                        {/* Metadata Summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 text-center">
                            <div>
                                <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Total Tablas</span>
                                <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                                    {restoreValidationData.validation.totalTables || 0}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Total Registros</span>
                                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                                    {restoreValidationData.validation.totalRecords?.toLocaleString() || 0}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Creado Por</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    {restoreValidationData.validation.metadata?.createdBy || 'admin'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Fecha Generación</span>
                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate block">
                                    {restoreValidationData.validation.metadata?.createdAt ? new Date(restoreValidationData.validation.metadata.createdAt).toLocaleString('es-ES') : 'Reciente'}
                                </span>
                            </div>
                        </div>

                        {/* Detailed Record Breakdown */}
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                Desglose de Registros a Reintegrar:
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-slate-850">
                                {Object.entries(restoreValidationData.validation.recordCounts || {}).map(([table, count]) => (
                                    <div key={table} className="flex items-center justify-between p-2 bg-white dark:bg-[#0c111e] rounded-lg border border-slate-100 dark:border-slate-800 text-[10.5px]">
                                        <span className="font-bold text-slate-600 dark:text-slate-400 truncate">{table}</span>
                                        <span className="font-black text-indigo-500 ml-1">{String(count)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Critical Warning Notice */}
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-start gap-3">
                            <ShieldAlert size={20} className="shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <span className="font-extrabold block uppercase tracking-wide">
                                    ⚠️ Reemplazo Total de la Base de Datos
                                </span>
                                <p className="text-[11px] font-medium leading-relaxed opacity-90">
                                    Al confirmar, el sistema reemplazará de forma atómica y completa la base de datos actual con todos los usuarios, productos, historial de caja, ventas e ítems del archivo importado. Se mantendrán intactos todos los IDs y relaciones originales.
                                </p>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                disabled={isImporting}
                                onClick={() => {
                                    setIsRestoreModalOpen(false);
                                    setRestoreValidationData(null);
                                }}
                                className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-extrabold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={isImporting}
                                onClick={handleExecuteRestore}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
                            >
                                {isImporting ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>Restaurando Base de Datos...</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={14} />
                                        <span>Confirmar e Importar Ahora</span>
                                    </>
                                )}
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* MODAL DE CONFIRMACIÓN PARA REINICIAR BASE DE DATOS A CERO */}
            {isResetModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#0c111e] border border-rose-200 dark:border-rose-900/60 rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
                        
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-850 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl shrink-0">
                                    <Trash2 size={24} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
                                        Reiniciar Base de Datos a Cero
                                    </h3>
                                    <p className="text-[11px] font-semibold text-rose-500">
                                        Acción destructiva e irreversible
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                disabled={isResettingDb}
                                onClick={() => setIsResetModalOpen(false)}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Warning Box */}
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-xs space-y-2">
                            <div className="flex items-center gap-2 font-black uppercase tracking-wide">
                                <ShieldAlert size={18} className="shrink-0" />
                                <span>¿Estás completamente seguro?</span>
                            </div>
                            <p className="text-[11px] font-medium leading-relaxed opacity-95">
                                Esta acción <strong>eliminará por completo</strong> todas las ventas, productos, clientes, cuentas por cobrar, arqueos de caja e historiales tanto en <strong>SQLite Local</strong> como en <strong>Google Cloud Firestore</strong> para dejar el sistema listo para una nueva carga o restauración.
                            </p>
                        </div>

                        {/* Confirmation Input */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                Para confirmar el borrado total, escribe <span className="font-black text-red-600 dark:text-red-400">BORRAR</span>:
                            </label>
                            <input
                                type="text"
                                value={resetConfirmInput}
                                onChange={(e) => setResetConfirmInput(e.target.value)}
                                placeholder="Escribe BORRAR"
                                autoFocus
                                disabled={isResettingDb}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono text-sm tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition"
                            />
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                disabled={isResettingDb}
                                onClick={() => setIsResetModalOpen(false)}
                                className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-extrabold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={resetConfirmInput.trim().toUpperCase() !== 'BORRAR' || isResettingDb}
                                onClick={handleExecuteResetDatabase}
                                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-500/20 flex items-center gap-2 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {isResettingDb ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>Reiniciando Base de Datos...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={14} />
                                        <span>Sí, Eliminar y Reiniciar</span>
                                    </>
                                )}
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
