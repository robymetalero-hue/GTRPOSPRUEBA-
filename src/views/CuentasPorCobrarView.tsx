import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { filterAndRankProducts } from '../lib/searchUtils';
import { TableSkeleton, CardGridSkeleton, EmptyState, StatusBadge } from '../components/UIStateFeedback';
import { 
    Search, Calendar, User, Phone, Receipt, CircleDollarSign, CheckCircle2, 
    AlertCircle, History, Wallet, X, ArrowLeftRight, Landmark, Tag, 
    Clock, Truck, Edit, Trash2, Plus, Minus, FileText, Check, Download, Printer,
    Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';

interface AccountReceivable {
    id: number;
    sale_id: number;
    client_id: number;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    status: 'pendiente' | 'pagado';
    created_at: string;
    due_date: string | null;
    client_name: string;
    client_phone: string | null;
    sale_date: string;
    sale_total: number;
}

interface PaymentHistory {
    id: number;
    account_receivable_id: number;
    amount: number;
    payment_method: string;
    user_id: number;
    registered_at: string;
    notes: string | null;
    user_name: string | null;
}

export default function CuentasPorCobrarView() {
    const { user, exchangeRate, clients, receiptTemplate } = useAppContext();
    
    // Module Tabs
    const [activeTab, setActiveTab] = useState<'pendientes' | 'creditos'>('pendientes');

    // State for Accounts Receivable / Credits
    const [debts, setDebts] = useState<AccountReceivable[]>([]);
    const [loadingDebts, setLoadingDebts] = useState(false);
    const [debtsSearchQuery, setDebtsSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'todos' | 'pendiente' | 'pagado'>('pendiente');
    
    // Accounts Receivable Modals
    const [selectedDebt, setSelectedDebt] = useState<AccountReceivable | null>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paying, setPaying] = useState(false);

    const [historyDebt, setHistoryDebt] = useState<AccountReceivable | null>(null);
    const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // State for Pending Sales / Envíos
    const [pendingSales, setPendingSales] = useState<any[]>([]);
    const [loadingPending, setLoadingPending] = useState(false);
    const [pendingSearchQuery, setPendingSearchQuery] = useState('');

    // Editing Pending Sale Modal State
    const [editingSale, setEditingSale] = useState<any | null>(null);
    const [editedClientName, setEditedClientName] = useState('');
    const [editedDestination, setEditedDestination] = useState('');
    const [editedClientPhone, setEditedClientPhone] = useState('');
    const [editedTransportCompany, setEditedTransportCompany] = useState('');
    const [editedItems, setEditedItems] = useState<any[]>([]); // items currently in the edited order
    const [productList, setProductList] = useState<any[]>([]); // full product list for adding items
    const [productSearchQuery, setProductSearchQuery] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    // Finalizing / Final-Checkout Pending Sale Modal State
    const [finalizingSale, setFinalizingSale] = useState<any | null>(null);
    const [finalizePaymentMethod, setFinalizePaymentMethod] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Crédito'>('Efectivo');
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [finalizeInitialAbono, setFinalizeInitialAbono] = useState('');
    const [finalizeDueDate, setFinalizeDueDate] = useState('');
    const [isFinalizing, setIsFinalizing] = useState(false);

    // States for Pending Sales Partial Payments
    const [payingPendingSale, setPayingPendingSale] = useState<any | null>(null);
    const [paymentPendingAmount, setPaymentPendingAmount] = useState('');
    const [paymentPendingMethod, setPaymentPendingMethod] = useState<'Efectivo' | 'Tarjeta' | 'Transferencia'>('Efectivo');
    const [paymentPendingNotes, setPaymentPendingNotes] = useState('');
    const [registeringPendingPayment, setRegisteringPendingPayment] = useState(false);

    const [historyPendingSale, setHistoryPendingSale] = useState<any | null>(null);
    const [pendingPaymentHistory, setPendingPaymentHistory] = useState<any[]>([]);
    const [loadingPendingHistory, setLoadingPendingHistory] = useState(false);

    // Toast Notifications
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    // --- Loading APIs ---
    const loadAccountsReceivable = async () => {
        setLoadingDebts(true);
        try {
            const res = await fetch('/api/accounts-receivable');
            if (res.ok) {
                const data = await res.json();
                setDebts(data);
            } else {
                showToast('Error al cargar cuentas por cobrar', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de conexión con el servidor', 'error');
        } finally {
            setLoadingDebts(false);
        }
    };

    const loadPendingSales = async () => {
        setLoadingPending(true);
        try {
            const res = await fetch('/api/pending-sales');
            if (res.ok) {
                const data = await res.json();
                setPendingSales(data);
            } else {
                showToast('Error al cargar ventas pendientes', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de conexión para ventas pendientes', 'error');
        } finally {
            setLoadingPending(false);
        }
    };

    const loadProducts = async (query?: string) => {
        try {
            const url = query ? `/api/products?search=${encodeURIComponent(query)}` : '/api/products';
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const items = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
                setProductList(items);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (!productSearchQuery.trim()) {
            loadProducts();
            return;
        }
        const timer = setTimeout(() => {
            loadProducts(productSearchQuery.trim());
        }, 200);
        return () => clearTimeout(timer);
    }, [productSearchQuery]);

    const loadPaymentHistory = async (debt: AccountReceivable) => {
        setLoadingHistory(true);
        setHistoryDebt(debt);
        try {
            const res = await fetch(`/api/accounts-receivable/${debt.id}/history`);
            if (res.ok) {
                const data = await res.json();
                setPaymentHistory(data);
            } else {
                showToast('Error al cargar el historial de abonos', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de conexión al cargar historial', 'error');
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        loadAccountsReceivable();
        loadPendingSales();
        loadProducts();
    }, []);

    // --- Actions for Accounts Receivable ---
    const handleApplyPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDebt) return;
        
        const amount = Number(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            showToast('Por favor ingrese un monto válido mayor a cero', 'error');
            return;
        }

        if (amount > selectedDebt.remaining_amount) {
            showToast(`El pago excede el saldo restante de Bs. ${selectedDebt.remaining_amount.toFixed(2)}`, 'error');
            return;
        }

        setPaying(true);
        try {
            const res = await fetch(`/api/accounts-receivable/${selectedDebt.id}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    payment_method: paymentMethod,
                    user_id: user?.id || 1,
                    notes: paymentNotes.trim() || 'Abono registrado en sistema'
                })
            });

            if (res.ok) {
                const data = await res.json();
                showToast(`✓ Abono de Bs. ${data.actualPayment.toFixed(2)} registrado correctamente.`);
                setSelectedDebt(null);
                setPaymentAmount('');
                setPaymentNotes('');
                loadAccountsReceivable();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al registrar el cobro', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error al procesar cobro en servidor', 'error');
        } finally {
            setPaying(false);
        }
    };

    // --- Actions for Pending Sales (Ventas Pendientes) ---
    const handleRegisterPendingPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!payingPendingSale) return;
        const amount = Number(paymentPendingAmount);
        if (isNaN(amount) || amount <= 0) {
            showToast('Por favor ingrese un monto válido mayor a cero', 'error');
            return;
        }
        
        const remaining = payingPendingSale.total - (payingPendingSale.paid_amount || 0);
        if (amount > remaining) {
            showToast(`El monto excede el saldo restante de Bs. ${remaining.toFixed(2)}`, 'error');
            return;
        }
        
        setRegisteringPendingPayment(true);
        try {
            const res = await fetch(`/api/pending-sales/${payingPendingSale.id}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    payment_method: paymentPendingMethod,
                    user_id: user?.id || 1,
                    notes: paymentPendingNotes.trim() || 'Abono parcial registrado'
                })
            });
            if (res.ok) {
                showToast(`✓ Abono de Bs. ${amount.toFixed(2)} registrado correctamente.`);
                setPayingPendingSale(null);
                setPaymentPendingAmount('');
                setPaymentPendingNotes('');
                loadPendingSales();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al registrar el abono', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error al conectar con el servidor', 'error');
        } finally {
            setRegisteringPendingPayment(false);
        }
    };

    const loadPendingPaymentHistory = async (sale: any) => {
        setHistoryPendingSale(sale);
        setLoadingPendingHistory(true);
        try {
            const res = await fetch(`/api/pending-sales/${sale.id}/history`);
            if (res.ok) {
                const data = await res.json();
                setPendingPaymentHistory(data);
            } else {
                showToast('Error al cargar historial de abonos', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de conexión', 'error');
        } finally {
            setLoadingPendingHistory(false);
        }
    };

    const generatePendingThermalTicket = (sale: any) => {
        try {
            const tpl = receiptTemplate || {
                logoText: "GTR POS TERMINAL",
                showLogo: true,
                headerText: "Cochabamba - Bolivia\nTelf: 444-XXXXX\nNIT: 382910023",
                footerText: "¡Gracias por su preferencia!\nConserve su recibo para cualquier reclamo.",
                showDate: true,
                showCashier: true,
                showClientInfo: true,
                showHeaderDivider: true,
                showFooterDivider: true,
                showItemSKU: false,
                showPaymentMethod: true,
                fontFamily: 'Helvetica',
                fontSizeHeader: 14,
                fontSizeBody: 8,
                ticketWidth: 80
            };

            const font = 'Courier';
            const width = tpl.ticketWidth || 80;
            
            fetch(`/api/pending-sales/${sale.id}/history`)
                .then(res => res.json())
                .then(payments => {
                    const items = sale.items || [];
                    
                    let totalLines = 15;
                    totalLines += items.length * 1.5;
                    totalLines += (payments || []).length * 1.5;
                    if (sale.destination) totalLines += 2;
                    if (sale.client_phone) totalLines += 1;
                    
                    const predictedHeight = Math.max(150, Math.round(totalLines * 5) + 40);
                    const doc = new jsPDF({
                        unit: 'mm',
                        format: [width, predictedHeight]
                    });

                    doc.setFillColor(37, 99, 235);
                    doc.rect(0, 0, width, 3, 'F');
                    
                    doc.setFont(font, "bold");
                    doc.setFontSize(12);
                    let y = 10;
                    
                    doc.text(tpl.logoText || "GTR STORE", width / 2, y, { align: "center" });
                    y += 5;
                    
                    doc.setFont(font, "normal");
                    doc.setFontSize(8);
                    const headerLines = (tpl.headerText || "").split('\n');
                    headerLines.forEach((line: string) => {
                        doc.text(line, width / 2, y, { align: "center" });
                        y += 4;
                    });
                    
                    y += 2;
                    doc.text("------------------------------------------", width / 2, y, { align: "center" });
                    y += 4;
                    
                    doc.setFont(font, "bold");
                    doc.text(`TICKET DE VENTA PENDIENTE #${sale.id}`, width / 2, y, { align: "center" });
                    y += 5;
                    
                    doc.setFont(font, "normal");
                    doc.text(`Fecha Creación: ${new Date(sale.created_at).toLocaleString('es-BO')}`, 5, y);
                    y += 4;
                    
                    if (sale.client_name) {
                        doc.text(`Cliente: ${sale.client_name.toUpperCase()}`, 5, y);
                        y += 4;
                    }
                    if (sale.client_phone) {
                        doc.text(`Telf: ${sale.client_phone}`, 5, y);
                        y += 4;
                    }
                    if (sale.destination) {
                        doc.text(`Destino: ${sale.destination}`, 5, y);
                        y += 4;
                    }
                    
                    doc.text("------------------------------------------", width / 2, y, { align: "center" });
                    y += 4;
                    
                    doc.setFont(font, "bold");
                    doc.text("Desc.", 5, y);
                    doc.text("Cant.", width - 35, y);
                    doc.text("Subtotal", width - 5, y, { align: "right" });
                    y += 4;
                    doc.setFont(font, "normal");
                    doc.text("------------------------------------------", width / 2, y, { align: "center" });
                    y += 4;
                    
                    items.forEach((it: any) => {
                        const nameTrunc = it.product_name.substring(0, 18);
                        doc.text(nameTrunc, 5, y);
                        doc.text(`${it.quantity}`, width - 32, y);
                        const itemSub = (it.price || 0) * it.quantity;
                        doc.text(`Bs. ${itemSub.toFixed(2)}`, width - 5, y, { align: "right" });
                        y += 4;
                    });
                    
                    doc.text("------------------------------------------", width / 2, y, { align: "center" });
                    y += 4;
                    
                    doc.setFont(font, "bold");
                    doc.text("Total Original:", 5, y);
                    doc.text(`Bs. ${sale.total.toFixed(2)}`, width - 5, y, { align: "right" });
                    y += 4;
                    
                    doc.text("Total Abonado:", 5, y);
                    doc.text(`Bs. ${(sale.paid_amount || 0).toFixed(2)}`, width - 5, y, { align: "right" });
                    y += 4;
                    
                    const remaining = sale.total - (sale.paid_amount || 0);
                    doc.setFont(font, "bold");
                    doc.text("SALDO RESTANTE:", 5, y);
                    doc.text(`Bs. ${remaining.toFixed(2)}`, width - 5, y, { align: "right" });
                    y += 5;
                    
                    if (payments && payments.length > 0) {
                        doc.text("=== DETALLE DE PAGOS ===", width / 2, y, { align: "center" });
                        y += 4.5;
                        doc.setFont(font, "normal");
                        doc.setFontSize(7.5);
                        payments.forEach((p: any) => {
                            const pDate = new Date(p.registered_at).toLocaleDateString('es-BO', {day:'2-digit', month:'2-digit'});
                            doc.text(`${pDate} - ${p.payment_method}:`, 5, y);
                            doc.text(`+Bs. ${p.amount.toFixed(2)}`, width - 5, y, { align: "right" });
                            y += 3.5;
                        });
                        y += 1.5;
                        doc.setFontSize(8);
                        doc.setFont(font, "normal");
                        doc.text("------------------------------------------", width / 2, y, { align: "center" });
                        y += 4;
                    }
                    
                    const footerLines = (tpl.footerText || "").split('\n');
                    footerLines.forEach((line: string) => {
                        doc.text(line, width / 2, y, { align: "center" });
                        y += 4;
                    });
                    
                    doc.autoPrint();
                    
                    const pdfBlob = doc.output('bloburl');
                    const printWindow = window.open(pdfBlob, '_blank');
                    if (printWindow) {
                        printWindow.focus();
                    } else {
                        doc.save(`Ticket_Pedido_Pendiente_${sale.id}.pdf`);
                        showToast('✓ Ticket PDF descargado.');
                    }
                })
                .catch(err => {
                    console.error("Error loading pending sale history for ticket", err);
                    showToast('Error cargando historial de pagos para el ticket', 'error');
                });
        } catch (e) {
            console.error(e);
            showToast('Error generando ticket térmico', 'error');
        }
    };

    const handleShareWhatsApp = (sale: any) => {
        const remaining = sale.total - (sale.paid_amount || 0);
        const itemsText = sale.items && sale.items.map((it: any) => `• ${it.product_name} x${it.quantity} (Bs. ${(it.price || 0).toFixed(2)})`).join('\n') || '';
        
        let message = `*DETALLE DE VENTA PENDIENTE #${sale.id}*\n`;
        message += `_Fecha de registro: ${new Date(sale.created_at).toLocaleString('es-BO')}_\n\n`;
        message += `*Cliente:* ${sale.client_name}\n`;
        if (sale.client_phone) message += `*Teléfono:* ${sale.client_phone}\n`;
        if (sale.destination) message += `*Destino:* ${sale.destination}\n`;
        message += `\n*Detalle de Productos:*\n${itemsText}\n\n`;
        message += `*Monto Total:* Bs. ${sale.total.toFixed(2)}\n`;
        message += `*Monto Abonado:* Bs. ${(sale.paid_amount || 0).toFixed(2)}\n`;
        message += `*Saldo Restante:* *Bs. ${remaining.toFixed(2)}*\n\n`;
        message += `¡Gracias por su preferencia!`;
        
        const encodedMessage = encodeURIComponent(message);
        const phone = sale.client_phone ? sale.client_phone.replace(/\D/g, '') : '';
        const url = `https://api.whatsapp.com/send?phone=${phone ? '591' + phone : ''}&text=${encodedMessage}`;
        
        const win = window.open(url, '_blank');
        if (!win) {
            navigator.clipboard.writeText(message);
            showToast('✓ Enlace bloqueado. Detalle copiado al portapapeles para pegar.');
        } else {
            showToast('✓ Abriendo WhatsApp para compartir.');
        }
    };

    const handleDeletePendingSale = async (id: number) => {
        if (!confirm('¿Está seguro de que desea cancelar y eliminar permanentemente esta venta pendiente?')) {
            return;
        }
        try {
            const res = await fetch(`/api/pending-sales/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                showToast('✓ Venta pendiente eliminada.');
                loadPendingSales();
            } else {
                const err = await res.json();
                showToast(err.error || 'No se pudo eliminar', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de red al eliminar', 'error');
        }
    };

    // Generate full format elegant A4/Letter invoice quote PDF
    const generateQuotePDF = (sale: any) => {
        try {
            const tpl = receiptTemplate || {
                logoText: "GTR POS TERMINAL",
                showLogo: true,
                headerText: "Cochabamba - Bolivia\nTelf: 444-XXXXX\nNIT: 382910023",
                footerText: "¡Gracias por su preferencia!\nConserve su recibo para cualquier reclamo.",
                showDate: true,
                showCashier: true,
                showClientInfo: true,
                showHeaderDivider: true,
                showFooterDivider: true,
                showItemSKU: false,
                showPaymentMethod: true,
                fontFamily: 'Helvetica',
                fontSizeHeader: 14,
                fontSizeBody: 8,
                ticketWidth: 80
            };

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'letter'
            });

            const margin = 20;
            const pageWidth = 215.9;
            const contentWidth = pageWidth - (margin * 2); // 175.9
            let y = 18;

            // Header accent bar - Modern Indigo / Slate Blue
            doc.setFillColor(37, 99, 235); // Indigo/Blue accent
            doc.rect(0, 0, pageWidth, 5, 'F');

            y += 12;

            // Draw Logo on the left if showLogo and logoImage exist
            let logoOffset = 0;
            if (tpl.showLogo && tpl.logoImage) {
                try {
                    const imgWidth = 24;
                    const imgHeight = 24;
                    doc.addImage(tpl.logoImage, 'PNG', margin, y, imgWidth, imgHeight);
                    logoOffset = imgWidth + 6; // Space after logo
                } catch (imageErr) {
                    console.error("Error drawing logo on pending sale quote PDF", imageErr);
                }
            }

            // Company Text Details (placed next to logo or at margin if no logo)
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42); // slate-900
            const companyName = tpl.logoText || "GTR POS TERMINAL";
            doc.text(companyName, margin + logoOffset, y + 4);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105); // slate-600
            
            // Draw headerText lines
            let headerY = y + 9;
            if (tpl.headerText) {
                const headerLines = tpl.headerText.split('\n');
                headerLines.forEach((line: string) => {
                    doc.text(line, margin + logoOffset, headerY);
                    headerY += 3.8;
                });
            }

            // Document Title & Metadata on the Right Hand Side
            const rightAlignX = pageWidth - margin;
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(37, 99, 235); // Blue primary
            doc.text("VENTA PENDIENTE", rightAlignX, y + 4, { align: 'right' });
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text(`Nº de Pedido: PED-${sale.id}`, rightAlignX, y + 10, { align: 'right' });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.text(`Fecha de Registro: ${new Date(sale.created_at || Date.now()).toLocaleString()}`, rightAlignX, y + 15, { align: 'right' });
            doc.text(`Moneda: ${sale.currency || 'BOB'}`, rightAlignX, y + 20, { align: 'right' });

            // Set Y coordinate to below the highest header element
            y = Math.max(headerY, y + 24) + 2;

            // Thin Slate divider line
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.line(margin, y, rightAlignX, y);

            y += 6;

            // Client & Delivery Information Box (Styled like a modern card)
            doc.setFillColor(248, 250, 252); // slate-50
            doc.setDrawColor(241, 245, 249); // slate-100
            doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'FD');

            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42); // slate-900
            doc.text("DATOS DEL CLIENTE Y DETALLES DE ENVÍO", margin + 6, y + 6.5);

            // Left info column
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139); // slate-500
            doc.text("CLIENTE:", margin + 6, y + 14);
            doc.text("CELULAR:", margin + 6, y + 21);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text(sale.client_name || "Cliente General / Particular", margin + 25, y + 14);
            doc.text(sale.client_phone || "No registrado", margin + 25, y + 21);

            // Right info column
            doc.setFont("helvetica", "bold");
            doc.setTextColor(100, 116, 139);
            doc.text("DESTINO / DIRECCIÓN:", margin + 95, y + 14);
            doc.text("ESTADO:", margin + 95, y + 21);

            doc.setFont("helvetica", "bold");
            doc.setTextColor(37, 99, 235); // Blue
            doc.text("PENDIENTE DE ENVÍO / COBRO", margin + 132, y + 21);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(15, 23, 42);
            // Wrap address in case it's too long
            const destText = sale.destination || "Entrega en Tienda / Por definir";
            const wrappedDest = doc.splitTextToSize(destText, contentWidth - 100);
            doc.text(wrappedDest, margin + 132, y + 14);

            y += 37;

            // Product Detail Table Header
            doc.setFillColor(30, 41, 59); // Dark slate header
            doc.rect(margin, y, contentWidth, 7.5, 'F');

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(255, 255, 255); // White text
            doc.text("SKU", margin + 4, y + 5);
            doc.text("DESCRIPCIÓN / PRODUCTO", margin + 25, y + 5);
            doc.text("CANTIDAD", margin + 105, y + 5, { align: 'right' });
            doc.text("P. UNIT (Bs.)", margin + 138, y + 5, { align: 'right' });
            doc.text("TOTAL (Bs.)", margin + 171, y + 5, { align: 'right' });

            y += 7.5;

            // Product Detail Table Rows
            let totalItemsSum = 0;
            let rowCount = 0;

            sale.items.forEach((item: any) => {
                const rowTotal = item.quantity * item.price;
                totalItemsSum += rowTotal;
                rowCount++;

                // Zebra striping - light blueish slate background for even rows
                if (rowCount % 2 === 0) {
                    doc.setFillColor(248, 250, 252); // slate-50
                    doc.rect(margin, y, contentWidth, 7, 'F');
                }

                doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(15, 23, 42);

                // Draw SKU
                const itemSku = item.product_sku || item.sku || 'N/A';
                doc.setFont("courier", "bold"); // monospace-like look for SKU
                doc.text(itemSku, margin + 4, y + 4.8);

                // Draw Name (truncated gracefully)
                doc.setFont("helvetica", "normal");
                let nameStr = item.product_name || item.name || "Producto";
                if (nameStr.length > 40) nameStr = nameStr.substring(0, 37) + "...";
                doc.text(nameStr, margin + 25, y + 4.8);

                // Draw Quantity
                doc.setFont("helvetica", "bold");
                doc.text(`${item.quantity} unids.`, margin + 105, y + 4.8, { align: 'right' });

                // Draw Price Unit
                doc.setFont("helvetica", "normal");
                doc.text(`${item.price.toFixed(2)}`, margin + 138, y + 4.8, { align: 'right' });

                // Draw Total
                doc.setFont("helvetica", "bold");
                doc.text(`${rowTotal.toFixed(2)}`, margin + 171, y + 4.8, { align: 'right' });

                // Draw bottom border line
                y += 7;
                doc.setDrawColor(241, 245, 249);
                doc.setLineWidth(0.2);
                doc.line(margin, y, rightAlignX, y);
            });

            y += 5;

            // Total Block (aligned to the right)
            const totalBoxWidth = 75;
            const totalBoxX = rightAlignX - totalBoxWidth;

            // Draw a subtle box for totals
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(totalBoxX, y, totalBoxWidth, 18, 2, 2, 'FD');

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text("SUBTOTAL:", totalBoxX + 4, y + 5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(`Bs. ${totalItemsSum.toFixed(2)}`, rightAlignX - 4, y + 5, { align: 'right' });

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(37, 99, 235); // Blue accent
            doc.text("TOTAL ESTIMADO:", totalBoxX + 4, y + 11);
            doc.text(`Bs. ${totalItemsSum.toFixed(2)}`, rightAlignX - 4, y + 11, { align: 'right' });

            // USD conversion underneath
            const activeExRate = sale.exchange_rate || exchangeRate || 6.96;
            const usdTotalAmount = totalItemsSum / activeExRate;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`Equivalente en Dólares:`, totalBoxX + 4, y + 15.5);
            doc.setFont("helvetica", "bold");
            doc.text(`$ ${usdTotalAmount.toFixed(2)} USD`, rightAlignX - 4, y + 15.5, { align: 'right' });

            // Terms / Footer text section at the bottom
            y = Math.max(y + 26, 230); // Push to bottom of the letter page

            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.line(margin, y, rightAlignX, y);

            y += 5;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text("TÉRMINOS Y CONDICIONES:", margin, y);

            y += 4;
            doc.setFont("helvetica", "italic");
            doc.setFontSize(7.5);
            doc.setTextColor(148, 163, 184);
            
            doc.text("• Los precios cotizados corresponden a una Venta Pendiente guardada para su posterior procesamiento y despacho.", margin, y);
            doc.text("• Esta cotización/proforma no es válida como factura de compra ni recibo oficial hasta que se liquide el saldo.", margin, y + 3.5);
            doc.text("• Los productos reservados están sujetos a los plazos de entrega pactados y la disponibilidad física en almacén.", margin, y + 7);

            if (tpl.footerText) {
                y += 12;
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(100, 116, 139);
                const footerLines = doc.splitTextToSize(tpl.footerText, contentWidth);
                footerLines.forEach((line: string) => {
                    doc.text(line, margin + (contentWidth/2), y, { align: 'center' });
                    y += 3.5;
                });
            }

            doc.save(`Cotizacion_Pedido_${sale.id}_${sale.client_name.replace(/\s+/g, '_')}.pdf`);
            showToast('✓ Cotización PDF descargada correctamente.');
        } catch (err: any) {
            console.error(err);
            showToast('Error generando PDF', 'error');
        }
    };

    const generateWarehouseOrderPDF = async (sale: any) => {
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'letter'
            });

            const margin = 15;
            const pageWidth = 215.9;
            const pageHeight = 279.4;
            const contentWidth = pageWidth - (margin * 2); // 185.9
            let y = 15;

            // 1. TOP ELEGANT ACCENT LINE (Two-tone design: Slate & Royal Indigo)
            doc.setFillColor(15, 23, 42); // slate-900 (Primary accent)
            doc.rect(margin, y, contentWidth, 1.5, 'F');
            doc.setFillColor(79, 70, 229); // indigo-600 (Secondary accent)
            doc.rect(margin, y + 1.5, 30, 1.5, 'F');

            y += 8;

            // 2. BRAND LOGO AND GRAPHIC ICON
            // Draw a high-end vector logomark representing "GTR" (Hexagonal/industrial icon)
            const logoX = margin;
            const logoY = y;
            
            doc.setDrawColor(15, 23, 42);
            doc.setLineWidth(0.6);
            
            // Outer hexagon
            const r = 4.5;
            const cx = logoX + 5;
            const cy = logoY + 5;
            doc.setFillColor(15, 23, 42);
            doc.ellipse(cx, cy, r, r, 'F');
            
            // Inner white core
            doc.setFillColor(255, 255, 255);
            doc.ellipse(cx, cy, 2, 2, 'F');
            
            // Stylized wings/brackets
            doc.setDrawColor(79, 70, 229);
            doc.setLineWidth(0.4);
            doc.line(cx - 6, cy, cx - 4, cy - 4);
            doc.line(cx - 6, cy, cx - 4, cy + 4);
            doc.line(cx + 6, cy, cx + 4, cy - 4);
            doc.line(cx + 6, cy, cx + 4, cy + 4);

            // Brand Text
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42);
            doc.text("GTR POS SYSTEM", margin + 14, y + 4);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(79, 70, 229); // Indigo Accent
            doc.text("SISTEMA DE CONTROL DE INVENTARIOS & LOGÍSTICA", margin + 14, y + 8);

            // 3. DOCUMENT METADATA (Right-aligned)
            const rightAlignX = pageWidth - margin;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(15);
            doc.setTextColor(15, 23, 42); // Deep Slate
            doc.text("ORDEN DE CARGA / ALMACÉN", rightAlignX, y + 3, { align: 'right' });

            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(79, 70, 229); // Indigo/Blue
            doc.text(`CÓDIGO: ALM-${sale.id}`, rightAlignX, y + 8, { align: 'right' });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(`Fecha Emisión: ${new Date().toLocaleString('es-BO')}`, rightAlignX, y + 12, { align: 'right' });

            y += 18;

            // Clean Divider Line
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.5);
            doc.line(margin, y, rightAlignX, y);

            y += 5;

            // 4. SHIPMENT DETAILS GRID (Beautiful split panel)
            // Left Panel: Destination & Client details
            const colWidthHalf = contentWidth / 2 - 2;

            // Draw a subtle border frame for Details Panel
            doc.setFillColor(248, 250, 252); // slate-50
            doc.setDrawColor(226, 232, 240); // slate-200
            doc.setLineWidth(0.3);
            doc.roundedRect(margin, y, contentWidth, 36, 4, 4, 'FD');

            // Header for details section
            doc.setFillColor(15, 23, 42);
            doc.roundedRect(margin + 5, y + 4, 3, 3, 0.5, 0.5, 'F');
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text("INFORMACIÓN DE DESPACHO & LOGÍSTICA", margin + 10, y + 6.5);

            // Details rows
            const textYStart = y + 13;
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text("CLIENTE RECEPTOR:", margin + 6, textYStart);
            doc.text("Nº DE CELULAR:", margin + 6, textYStart + 6);
            doc.text("DIRECCIÓN DE ENVÍO:", margin + 6, textYStart + 12);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text(sale.client_name ? sale.client_name.toUpperCase() : "CLIENTE GENERAL / PARTICULAR", margin + 38, textYStart);
            doc.text(sale.client_phone || "NO ESPECIFICADO", margin + 38, textYStart + 6);

            const destText = sale.destination ? sale.destination.toUpperCase() : "RETIRO EN TIENDA / CONFORME EN MOSTRADOR";
            const wrappedDest = doc.splitTextToSize(destText, colWidthHalf + 10);
            doc.text(wrappedDest, margin + 38, textYStart + 12);

            // Right column: Transport details
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text("EMPRESA TRANSPORTE:", margin + 105, textYStart);
            doc.text("MODALIDAD ENTREGA:", margin + 105, textYStart + 6);
            doc.text("ESTADO DE CARGA:", margin + 105, textYStart + 12);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(79, 70, 229); // Royal Indigo Highlight
            doc.text(sale.transport_company ? sale.transport_company.toUpperCase() : "NO ASIGNADA (PENDIENTE)", margin + 142, textYStart);
            
            doc.setTextColor(15, 23, 42);
            doc.text(sale.transport_company ? "ENVÍO DE CARGA" : "RETIRO DIRECTO", margin + 142, textYStart + 6);
            
            doc.setFillColor(254, 243, 199); // amber-100
            doc.roundedRect(margin + 142, textYStart + 10.5, 30, 4.5, 1, 1, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(180, 83, 9); // amber-700
            doc.text("PENDIENTE REVISIÓN", margin + 144, textYStart + 13.8);

            y += 42;

            // 5. TABLE HEADER
            doc.setFillColor(15, 23, 42); // Deep slate
            doc.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(255, 255, 255);
            doc.text("SKU / CÓDIGO", margin + 5, y + 5.2);
            doc.text("DETALLE / DESCRIPCIÓN DEL PRODUCTO", margin + 40, y + 5.2);
            doc.text("CANTIDAD", margin + 138, y + 5.2, { align: 'right' });
            doc.text("REVISIÓN FÍSICA", margin + 178, y + 5.2, { align: 'right' });

            y += 8;

            // 6. TABLE ITEMS ROWS (Spacious, elegant layout with no prices)
            let rowCount = 0;
            let totalQtySum = 0;

            sale.items.forEach((item: any) => {
                rowCount++;
                totalQtySum += item.quantity;

                // Alternate row striping
                if (rowCount % 2 === 0) {
                    doc.setFillColor(248, 250, 252);
                    doc.rect(margin, y, contentWidth, 9, 'F');
                }

                doc.setDrawColor(241, 245, 249);
                doc.setLineWidth(0.35);
                doc.line(margin, y + 9, rightAlignX, y + 9);

                // Draw SKU (Courier Mono)
                doc.setFont("courier", "bold");
                doc.setFontSize(8);
                doc.setTextColor(71, 85, 105);
                const itemSku = item.product_sku || item.sku || 'S-SKU';
                doc.text(itemSku, margin + 5, y + 5.8);

                // Draw Name (Truncated cleanly if too long)
                doc.setFont("helvetica", "bold");
                doc.setFontSize(8);
                doc.setTextColor(15, 23, 42);
                let nameStr = item.product_name || item.name || "PRODUCTO REGISTRADO";
                if (nameStr.length > 55) nameStr = nameStr.substring(0, 52) + "...";
                doc.text(nameStr.toUpperCase(), margin + 40, y + 5.8);

                // Draw Quantity with distinct visual weighting
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(15, 23, 42);
                doc.text(`${item.quantity} U.`, margin + 138, y + 5.8, { align: 'right' });

                // Checkbox for manual count verification
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text("[  ] CONFORME", margin + 178, y + 5.8, { align: 'right' });

                y += 9;
            });

            y += 6;

            // 7. TOTAL PHYSICAL PRODUCTS SUMMARY BOX
            const summaryWidth = 90;
            const summaryX = rightAlignX - summaryWidth;

            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(summaryX, y, summaryWidth, 10, 2, 2, 'FD');

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(71, 85, 105);
            doc.text("TOTAL UNIDADES A DESPACHAR:", summaryX + 4, y + 6.2);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10.5);
            doc.setTextColor(79, 70, 229); // Indigo Accent
            doc.text(`${totalQtySum} UNIDADES`, rightAlignX - 4, y + 6.4, { align: 'right' });

            // 8. LOGISTICS RULES & GUARANTEES (Perfect bottom alignment)
            y = Math.max(y + 22, 212);

            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.4);
            doc.line(margin, y, rightAlignX, y);

            y += 4;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(15, 23, 42);
            doc.text("NORMAS OPERATIVAS & CONTROL DE CALIDAD EN ALMACÉN:", margin, y);

            y += 3.5;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.8);
            doc.setTextColor(100, 116, 139);
            doc.text("• Prohibido adjuntar precios o valorizaciones económicas a este documento para resguardo de la confidencialidad de costos.", margin, y);
            doc.text("• Verifique físicamente cada uno de los SKUs enumerados y el estado general de embalaje antes de firmar el acuse de recibo de carga.", margin, y + 3);
            doc.text("• Una vez firmada la orden por el transportista, se asume responsabilidad solidaria del cargamento durante el trayecto.", margin, y + 6);

            // 9. PROFESSIONAL TRIPLE SIGNATURE BOX
            y += 22;
            const colWidth = contentWidth / 3;

            // Signature thin lines
            doc.setDrawColor(148, 163, 184); // slate-400
            doc.setLineWidth(0.35);
            doc.line(margin + 5, y, margin + colWidth - 5, y);
            doc.line(margin + colWidth + 5, y, margin + (colWidth * 2) - 5, y);
            doc.line(margin + (colWidth * 2) + 5, y, rightAlignX - 5, y);

            y += 3.5;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(15, 23, 42);
            doc.text("DESPACHADO POR (ALMACÉN)", margin + (colWidth / 2), y, { align: 'center' });
            doc.text("TRANSPORTISTA / CHOFER", margin + colWidth + (colWidth / 2), y, { align: 'center' });
            doc.text("RECIBIDO CONFORME (CLIENTE)", margin + (colWidth * 2) + (colWidth / 2), y, { align: 'center' });

            y += 3;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6);
            doc.setTextColor(148, 163, 184);
            doc.text("Firma y C.I. Operador", margin + (colWidth / 2), y, { align: 'center' });
            doc.text("Firma, Nombre y Placa", margin + colWidth + (colWidth / 2), y, { align: 'center' });
            doc.text("Firma, Nombre y Fecha", margin + (colWidth * 2) + (colWidth / 2), y, { align: 'center' });

            // Create PDF File for Sharing / Saving
            const pdfFileName = `Orden_Carga_Almacen_${sale.id}_${sale.client_name ? sale.client_name.replace(/\s+/g, '_') : 'General'}.pdf`;
            const pdfBlob = doc.output('blob');
            const pdfFile = new File([pdfBlob], pdfFileName, { type: 'application/pdf' });

            // Share PDF directly if supported
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                try {
                    await navigator.share({
                        files: [pdfFile],
                        title: `Orden_Carga_Almacen_${sale.id}.pdf`,
                        text: `Adjunto la Orden de Carga #${sale.id} para el despacho correspondiente.`
                    });
                    showToast('✓ Orden de Almacén compartida con éxito.');
                    return;
                } catch (shareErr) {
                    console.log('User cancelled or sharing was not completed:', shareErr);
                }
            }

            // Fallback for desktop: Download & Open WhatsApp message
            doc.save(pdfFileName);
            showToast('✓ Orden de Almacén PDF descargada con diseño profesional.');
            handleShareWarehouseWhatsApp(sale);

        } catch (err: any) {
            console.error(err);
            showToast('Error al generar la orden de almacén', 'error');
        }
    };

    const handleShareWarehouseWhatsApp = (sale: any) => {
        const itemsText = sale.items && sale.items.map((it: any) => `📦 *${it.quantity} unids.* de ${it.product_name}`).join('\n') || '';
        
        let message = `*GTR POS • ORDEN DE CARGA / ALMACÉN (ORDEN #${sale.id})*\n`;
        message += `_Emisión: ${new Date().toLocaleString('es-BO')}_\n\n`;
        message += `👤 *Cliente:* ${sale.client_name ? sale.client_name.toUpperCase() : "CLIENTE GENERAL"}\n`;
        if (sale.client_phone) message += `📞 *Celular:* ${sale.client_phone}\n`;
        if (sale.transport_company) message += `🚛 *Transporte:* ${sale.transport_company.toUpperCase()}\n`;
        if (sale.destination) message += `📍 *Dirección/Destino:* ${sale.destination.toUpperCase()}\n`;
        message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `*DETALLE DE CARGA (SOLO CANTIDADES)*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `${itemsText}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `💡 _Por favor, alistar, empaquetar y verificar físicamente las cantidades especificadas antes de despachar._\n`;
        message += `📑 _El PDF oficial firmado por almacén se ha descargado de forma local._`;
        
        const encodedMessage = encodeURIComponent(message);
        const url = `https://api.whatsapp.com/send?text=${encodedMessage}`;
        
        const win = window.open(url, '_blank');
        if (!win) {
            navigator.clipboard.writeText(message);
            showToast('✓ PDF descargado y texto de orden copiado. Pegue en WhatsApp.');
        } else {
            showToast('✓ Abriendo WhatsApp para coordinar despacho con almacenes.');
        }
    };

    // Opening Edit Modal and cloning existing sale values
    const handleStartEdit = (sale: any) => {
        setEditingSale(sale);
        setEditedClientName(sale.client_name || '');
        setEditedDestination(sale.destination || '');
        setEditedClientPhone(sale.client_phone || '');
        setEditedTransportCompany(sale.transport_company || '');
        setEditedItems(sale.items.map((i: any) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            product_sku: i.product_sku,
            quantity: i.quantity,
            price: i.price,
            current_stock: i.current_stock
        })));
        setProductSearchQuery('');
    };

    // Increment/Decrement items inside edited list
    const updateEditedQty = (productId: number, delta: number) => {
        setEditedItems(prev => prev.map(item => {
            if (item.product_id === productId) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    // Remove item from edited list
    const removeEditedItem = (productId: number) => {
        setEditedItems(prev => prev.filter(item => item.product_id !== productId));
    };

    // Add item from catalog list
    const addProductToEdit = (prod: any) => {
        setEditedItems(prev => {
            const exists = prev.find(item => item.product_id === prod.id);
            if (exists) {
                return prev.map(item => item.product_id === prod.id 
                    ? { ...item, quantity: item.quantity + 1 } 
                    : item
                );
            } else {
                return [...prev, {
                    product_id: prod.id,
                    product_name: prod.name,
                    product_sku: prod.sku,
                    quantity: 1,
                    price: prod.price_unit,
                    current_stock: prod.stock
                }];
            }
        });
        showToast(`✓ Agregado: "${prod.name}"`);
    };

    // Submit Edited Pending Sale details to backend
    const handleSaveEditPending = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSale) return;
        if (!editedClientName.trim() || !editedDestination.trim()) {
            showToast('⚠️ Nombre del cliente y destino son requeridos', 'error');
            return;
        }
        if (editedItems.length === 0) {
            showToast('⚠️ Debe haber al menos un artículo en el pedido', 'error');
            return;
        }

        setSavingEdit(true);
        // Calculate new total
        const newTotal = editedItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);

        try {
            const res = await fetch(`/api/pending-sales/${editingSale.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_name: editedClientName.trim(),
                    destination: editedDestination.trim(),
                    client_phone: editedClientPhone.trim() || null,
                    transport_company: editedTransportCompany.trim() || null,
                    total: newTotal,
                    discount: 0,
                    items: editedItems.map(i => ({
                        product_id: i.product_id,
                        quantity: i.quantity,
                        price: i.price
                    }))
                })
            });

            if (res.ok) {
                showToast('✓ Pedido editado y actualizado con éxito.');
                setEditingSale(null);
                loadPendingSales();
            } else {
                const err = await res.json();
                showToast(err.error || 'No se pudo actualizar el pedido', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error al conectar con el servidor', 'error');
        } finally {
            setSavingEdit(false);
        }
    };

    // Handle Finalize & Collect Pending Sale
    const handleFinalizePending = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!finalizingSale) return;

        setIsFinalizing(true);
        try {
            const payload = {
                payment_method: finalizePaymentMethod,
                user_id: user?.id || 1,
                client_id: selectedClientId ? Number(selectedClientId) : null,
                initial_abono: finalizePaymentMethod === 'Crédito' ? Number(finalizeInitialAbono || 0) : 0,
                due_date: finalizePaymentMethod === 'Crédito' ? finalizeDueDate || null : null,
                redeemed_points: 0
            };

            const res = await fetch(`/api/pending-sales/${finalizingSale.id}/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                showToast('✓ Venta finalizada, entregada y registrada correctamente.');
                setFinalizingSale(null);
                setFinalizeInitialAbono('');
                setFinalizeDueDate('');
                setSelectedClientId('');
                setFinalizePaymentMethod('Efectivo');
                loadPendingSales();
                loadAccountsReceivable();
            } else {
                const err = await res.json();
                showToast(err.error || 'Error al finalizar la venta', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de conexión', 'error');
        } finally {
            setIsFinalizing(false);
        }
    };

    // Filter pending sales list based on search query
    const filteredPendingSales = pendingSales.filter(s => {
        const query = pendingSearchQuery.toLowerCase().trim();
        if (!query) return true;
        const searchTerms = query.split(/\s+/);
        const searchableText = `${s.client_name} ${s.destination} ${s.client_phone || ""} ${s.id}`.toLowerCase();
        return searchTerms.every(term => searchableText.includes(term));
    });

    const totalPendingValueSum = pendingSales.reduce((acc, curr) => acc + curr.total, 0);

    // Filter credit debts based on search query and status tab
    const filteredDebts = debts.filter(d => {
        const matchesStatus = statusFilter === 'todos' || d.status === statusFilter;
        const matchesQuery = 
            d.client_name.toLowerCase().includes(debtsSearchQuery.toLowerCase()) ||
            (d.client_phone && d.client_phone.includes(debtsSearchQuery)) ||
            String(d.sale_id).includes(debtsSearchQuery);
        return matchesStatus && matchesQuery;
    });

    const totalDeudaPendiente = debts
        .filter(d => d.status === 'pendiente')
        .reduce((acc, current) => acc + current.remaining_amount, 0);

    const totalCobrado = debts
        .reduce((acc, current) => acc + current.paid_amount, 0);

    return (
        <div className="p-3 sm:p-5 md:p-6 flex flex-col gap-4 md:gap-5 h-full overflow-y-auto select-none bg-slate-50/20 dark:bg-[#070a10]">
            
            {/* Header section with Unified Navigation Tab System */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-200 dark:border-slate-850 pb-4">
                <div>
                    <h1 className="text-lg md:text-xl font-sans font-black tracking-tight text-slate-850 dark:text-white uppercase flex items-center gap-2">
                        <Clock className="text-indigo-600 animate-pulse" size={18} />
                        Módulo de Ventas Pendientes y CxC
                    </h1>
                    <p className="text-[10.5px] font-bold text-slate-400 mt-1 uppercase tracking-wider font-mono">
                        Gestión unificada de envíos retenidos, pedidos de clientes y créditos pendientes por cobrar.
                    </p>
                </div>

                {/* Submodule Tab selector */}
                <div className="flex bg-slate-100 dark:bg-[#0c111e] p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-850 w-full lg:w-auto shrink-0">
                    <button
                        onClick={() => setActiveTab('pendientes')}
                        className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-[10.5px] font-extrabold uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeTab === 'pendientes'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                        }`}
                    >
                        <Truck size={13} />
                        Pedidos / Ventas Pendientes ({pendingSales.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('creditos')}
                        className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-[10.5px] font-extrabold uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeTab === 'creditos'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                        }`}
                    >
                        <ArrowLeftRight size={13} />
                        Cuentas por Cobrar ({debts.filter(d => d.status === 'pendiente').length})
                    </button>
                </div>
            </div>

            {/* Render Tab Contents */}
            {activeTab === 'pendientes' ? (
                <>
                    {/* Ventas Pendientes KPIs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="bg-white dark:bg-[#0c111e] border border-slate-200/60 dark:border-slate-850 p-3.5 rounded-2xl flex items-center gap-3.5 shadow-xs">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                                <Clock size={18} />
                            </div>
                            <div>
                                <span className="text-[8.5px] font-black uppercase text-slate-400 block tracking-wider">Pedidos Retenidos / Pendientes</span>
                                <span className="text-base font-black font-mono text-slate-800 dark:text-slate-200 block mt-0.5">
                                    {pendingSales.length} Envío(s)
                                </span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#0c111e] border border-slate-200/60 dark:border-slate-850 p-3.5 rounded-2xl flex items-center gap-3.5 shadow-xs">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                                <CircleDollarSign size={18} />
                            </div>
                            <div>
                                <span className="text-[8.5px] font-black uppercase text-slate-400 block tracking-wider">Monto Total Estimado</span>
                                <span className="text-base font-black font-mono text-indigo-600 dark:text-indigo-400 block mt-0.5">
                                    Bs. {totalPendingValueSum.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Filter controls */}
                    <div className="bg-white dark:bg-[#0c111e] p-3 rounded-2xl border border-slate-200/60 dark:border-slate-850 flex items-center">
                        <div className="relative w-full">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                                <Search size={14} />
                            </span>
                            <input 
                                type="text" 
                                placeholder="Buscar por cliente, destino de envío o ID de cotización..." 
                                className="pl-10 pr-4 py-2 bg-slate-50/50 dark:bg-black/10 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 dark:text-white text-xs transition placeholder-slate-400 font-semibold w-full"
                                value={pendingSearchQuery}
                                onChange={(e) => setPendingSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Pending Sales Grid List */}
                    <div className="flex-grow bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850 overflow-hidden shadow-xs flex flex-col min-h-[350px]">
                        {loadingPending ? (
                            <div className="p-6">
                                <CardGridSkeleton count={6} />
                            </div>
                        ) : filteredPendingSales.length === 0 ? (
                            <div className="p-8 my-auto">
                                <EmptyState
                                    icon={Truck}
                                    title="No hay pedidos o ventas pendientes"
                                    description="No se encontraron registros de pedidos en espera o retenidos que coincidan con la búsqueda activa."
                                    actionLabel={pendingSearchQuery ? "Limpiar Búsqueda" : undefined}
                                    onAction={pendingSearchQuery ? () => setPendingSearchQuery('') : undefined}
                                />
                            </div>
                        ) : (
                            <div className="overflow-y-auto flex-grow max-h-[62vh] p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {filteredPendingSales.map(sale => {
                                        const paid = Number(sale.paid_amount || 0);
                                        const total = Number(sale.total || 0);
                                        const remaining = Math.max(0, total - paid);
                                        const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                                        
                                        return (
                                            <div 
                                                key={sale.id} 
                                                className="bg-white dark:bg-[#0c111e]/80 border border-slate-200/70 dark:border-slate-850/70 rounded-3xl p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all duration-200 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700/60 relative group"
                                            >
                                                {/* Header info */}
                                                <div className="flex flex-col gap-2.5">
                                                    <div className="flex justify-between items-center">
                                                        <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border border-indigo-100/50 dark:border-indigo-900/30">
                                                            Pedido #{sale.id}
                                                        </div>
                                                        <span className="text-[9px] text-slate-400 font-mono font-bold flex items-center gap-1">
                                                            <Clock size={11} className="text-slate-400" />
                                                            {new Date(sale.created_at).toLocaleString('es-BO', {
                                                                day: '2-digit',
                                                                month: '2-digit',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>

                                                    {/* Client and destination details */}
                                                    <div className="bg-slate-50/50 dark:bg-black/15 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-900/40 flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-800 dark:text-slate-200 font-extrabold uppercase">
                                                            <User size={13} className="text-slate-400" />
                                                            <span className="truncate">{sale.client_name}</span>
                                                        </div>
                                                        {sale.client_phone && (
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold font-mono">
                                                                <Phone size={11} className="text-slate-400" />
                                                                <span>{sale.client_phone}</span>
                                                            </div>
                                                        )}
                                                        {sale.transport_company && (
                                                            <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-extrabold uppercase font-mono">
                                                                <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-md border border-amber-500/20">TRSP:</span>
                                                                <span className="truncate">{sale.transport_company}</span>
                                                            </div>
                                                        )}
                                                        {sale.destination && (
                                                            <div className="flex items-start gap-1.5 text-[10px] text-slate-400 font-bold border-t border-slate-100/60 dark:border-slate-800/40 pt-1.5 mt-0.5">
                                                                <Truck size={12} className="text-slate-400 shrink-0 mt-0.5" />
                                                                <span className="leading-normal break-all">{sale.destination}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Product descriptions/items */}
                                                    <div>
                                                        <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider block mb-1.5">Artículos del Pedido</span>
                                                        <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto pr-0.5">
                                                            {sale.items && sale.items.map((it: any, idx: number) => (
                                                                <div key={idx} className="flex justify-between items-center text-[10.5px] bg-slate-50/40 dark:bg-black/10 px-2.5 py-1.5 rounded-xl border border-slate-150/40 dark:border-slate-850/40 transition hover:bg-slate-50 dark:hover:bg-black/20">
                                                                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                                                        <span className="font-extrabold text-slate-700 dark:text-slate-200 truncate pr-2">{it.product_name}</span>
                                                                        <span className="text-[9px] text-slate-400 font-mono">P.U: Bs. {(it.price || 0).toFixed(2)}</span>
                                                                    </div>
                                                                    <span className="font-black text-indigo-600 dark:text-indigo-400 shrink-0 text-xs bg-indigo-50/50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-lg border border-indigo-100/30 dark:border-indigo-900/20">
                                                                        x{it.quantity}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Financial summary blocks */}
                                                <div className="flex flex-col gap-2.5 border-t border-slate-100 dark:border-slate-850/50 pt-3.5 mt-1">
                                                    <div className="grid grid-cols-3 gap-1 bg-slate-50/50 dark:bg-black/20 p-2 rounded-2xl border border-slate-100 dark:border-slate-900/30 text-center">
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-black uppercase text-slate-400">Total</span>
                                                            <span className="text-[11px] font-extrabold font-mono text-slate-800 dark:text-slate-200 mt-0.5">Bs. {total.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex flex-col border-x border-slate-155 dark:border-slate-850">
                                                            <span className="text-[8px] font-black uppercase text-emerald-500">Abonado</span>
                                                            <span className="text-[11px] font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">Bs. {paid.toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-black uppercase text-amber-500">Saldo</span>
                                                            <span className="text-[11px] font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">Bs. {remaining.toFixed(2)}</span>
                                                        </div>
                                                    </div>

                                                    {/* Visual payment progress bar */}
                                                    {total > 0 && (
                                                        <div className="flex flex-col gap-1 px-0.5">
                                                            <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">
                                                                <span>Progreso de Pago</span>
                                                                <span className={pct === 100 ? 'text-emerald-500' : 'text-slate-500'}>{pct}%</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden">
                                                                <div 
                                                                    className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Card action buttons */}
                                                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                                                        {/* Ticket / Printing options */}
                                                        <button
                                                            onClick={() => generatePendingThermalTicket(sale)}
                                                            className="p-2 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/60 rounded-xl transition cursor-pointer flex flex-col items-center gap-1 justify-center animate-none"
                                                            title="Imprimir Ticket Térmico (80mm)"
                                                        >
                                                            <Printer size={13} />
                                                            <span className="text-[8px] font-extrabold uppercase">Ticket</span>
                                                        </button>

                                                        <button
                                                            onClick={() => generateQuotePDF(sale)}
                                                            className="p-2 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/60 rounded-xl transition cursor-pointer flex flex-col items-center gap-1 justify-center"
                                                            title="Imprimir Cotización/Proforma PDF"
                                                        >
                                                            <FileText size={13} />
                                                            <span className="text-[8px] font-extrabold uppercase">Proforma</span>
                                                        </button>

                                                        {/* WhatsApp Sharing */}
                                                        <button
                                                            onClick={() => handleShareWhatsApp(sale)}
                                                            className="p-2 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100/55 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100/40 dark:border-emerald-900/30 rounded-xl transition cursor-pointer flex flex-col items-center gap-1 justify-center animate-none"
                                                            title="Compartir por WhatsApp"
                                                        >
                                                            <Phone size={13} className="text-emerald-500" />
                                                            <span className="text-[8px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">WhatsApp</span>
                                                        </button>

                                                        {/* Abono / Partial Payment */}
                                                        <button
                                                            onClick={() => {
                                                                setPayingPendingSale(sale);
                                                                setPaymentPendingAmount('');
                                                                setPaymentPendingNotes('');
                                                            }}
                                                            className="p-2 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100/55 dark:hover:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100/40 dark:border-indigo-900/30 rounded-xl transition cursor-pointer flex flex-col items-center gap-1 justify-center animate-none"
                                                            title="Registrar Abono parcial"
                                                        >
                                                            <CircleDollarSign size={13} className="text-indigo-500" />
                                                            <span className="text-[8px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">Abonar</span>
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-1.5">
                                                        {/* Historial */}
                                                        <button
                                                            onClick={() => loadPendingPaymentHistory(sale)}
                                                            className="p-2.5 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/60 rounded-xl transition cursor-pointer flex items-center gap-1.5 justify-center"
                                                            title="Ver historial de abonos"
                                                        >
                                                            <History size={12} />
                                                            <span className="text-[9px] font-black uppercase">Historial</span>
                                                        </button>

                                                        {/* Editar */}
                                                        <button
                                                            onClick={() => handleStartEdit(sale)}
                                                            className="p-2.5 bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-100/40 dark:hover:bg-amber-900/20 text-amber-600 hover:text-amber-500 border border-amber-200/30 dark:border-amber-800/30 rounded-xl transition cursor-pointer flex items-center gap-1.5 justify-center"
                                                            title="Editar pedido"
                                                        >
                                                            <Edit size={12} />
                                                            <span className="text-[9px] font-black uppercase font-bold">Editar</span>
                                                        </button>

                                                        {/* Cobrar y entregar / Finalizar */}
                                                        <button
                                                            onClick={() => setFinalizingSale(sale)}
                                                            className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition cursor-pointer flex items-center gap-1.5 justify-center font-sans shadow-sm shadow-emerald-500/10"
                                                            title="Finalizar Venta / Despachar"
                                                        >
                                                            <CheckCircle2 size={12} />
                                                            <span className="text-[9px] font-black uppercase">Cobrar</span>
                                                        </button>
                                                    </div>

                                                    <div className="mt-1.5">
                                                        {/* Unificado: Orden Almacén (PDF + WhatsApp) */}
                                                        <button
                                                            onClick={() => generateWarehouseOrderPDF(sale)}
                                                            className="w-full p-2.5 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-250 dark:border-slate-700 rounded-xl transition cursor-pointer flex items-center gap-2 justify-center font-extrabold"
                                                            title="Descarga la orden de carga en PDF (sin precios) y abre WhatsApp para coordinar despacho con almacenes"
                                                        >
                                                            <Package size={13} className="text-blue-500 dark:text-blue-400" />
                                                            <span className="text-[9.5px] font-black uppercase tracking-wider">Orden Almacén (PDF + WhatsApp)</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <>
                    {/* Cuentas por Cobrar original layout */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="bg-white dark:bg-[#0c111e] border border-slate-200/60 dark:border-slate-850 p-3.5 rounded-2xl flex items-center gap-3.5 shadow-xs">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                                <Wallet size={18} />
                            </div>
                            <div>
                                <span className="text-[8.5px] font-black uppercase text-slate-400 block tracking-wider">Deuda Pendiente General</span>
                                <span className="text-base font-black font-mono text-rose-600 dark:text-rose-400 block mt-0.5">
                                    Bs. {totalDeudaPendiente.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#0c111e] border border-slate-200/60 dark:border-slate-850 p-3.5 rounded-2xl flex items-center gap-3.5 shadow-xs">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                                <CircleDollarSign size={18} />
                            </div>
                            <div>
                                <span className="text-[8.5px] font-black uppercase text-slate-400 block tracking-wider">Abonos Cobrados</span>
                                <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5">
                                    Bs. {totalCobrado.toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Filter controls */}
                    <div className="bg-white dark:bg-[#0c111e] p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-850 flex flex-col md:flex-row gap-3.5 items-center justify-between">
                        <div className="relative w-full md:w-96">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                                <Search size={14} />
                            </span>
                            <input 
                                type="text" 
                                placeholder="Buscar por cliente o nº ticket..." 
                                className="pl-10 pr-4 py-2 bg-slate-50/50 dark:bg-black/10 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 dark:text-white text-xs transition placeholder-slate-400 font-semibold w-full"
                                value={debtsSearchQuery}
                                onChange={(e) => setDebtsSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-1.5 w-full md:w-auto">
                            <button
                                onClick={() => setStatusFilter('pendiente')}
                                className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-[10px] font-extrabold uppercase transition tracking-wider cursor-pointer ${
                                    statusFilter === 'pendiente' 
                                        ? 'bg-rose-600 text-white font-black' 
                                        : 'bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                                Deudas Activas
                            </button>
                            <button
                                onClick={() => setStatusFilter('pagado')}
                                className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-[10px] font-extrabold uppercase transition tracking-wider cursor-pointer ${
                                    statusFilter === 'pagado' 
                                        ? 'bg-emerald-600 text-white font-black' 
                                        : 'bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                                Pagadas
                            </button>
                            <button
                                onClick={() => setStatusFilter('todos')}
                                className={`flex-1 md:flex-initial px-4 py-2 rounded-xl text-[10px] font-extrabold uppercase transition tracking-wider cursor-pointer ${
                                    statusFilter === 'todos' 
                                        ? 'bg-slate-800 text-white font-black' 
                                        : 'bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                                Todas
                            </button>
                        </div>
                    </div>

                    {/* Debts list table */}
                    <div className="flex-grow bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200/60 dark:border-slate-850 overflow-hidden shadow-xs flex flex-col min-h-[350px]">
                        {loadingDebts ? (
                            <div className="p-6">
                                <TableSkeleton rows={6} cols={8} />
                            </div>
                        ) : filteredDebts.length === 0 ? (
                            <div className="p-8 my-auto">
                                <EmptyState
                                    icon={Landmark}
                                    title="No se encontraron créditos registrados"
                                    description="No hay registros de cuentas por cobrar o créditos activos que coincidan con los filtros seleccionados."
                                    actionLabel={debtsSearchQuery ? "Limpiar Búsqueda" : undefined}
                                    onAction={debtsSearchQuery ? () => setDebtsSearchQuery('') : undefined}
                                />
                            </div>
                        ) : (
                            <div className="overflow-x-auto flex-grow max-h-[58vh]">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-150 dark:border-slate-850 bg-slate-50/70 dark:bg-black/10 text-[9.5px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                            <th className="py-4 px-4">Ticket / Fecha</th>
                                            <th className="py-4 px-4">Cliente</th>
                                            <th className="py-4 px-4 text-right">Monto Total</th>
                                            <th className="py-4 px-4 text-right">Abonado</th>
                                            <th className="py-4 px-4 text-right">Saldo Restante</th>
                                            <th className="py-4 px-4 text-center">Vencimiento</th>
                                            <th className="py-4 px-4 text-center">Estado</th>
                                            <th className="py-4 px-4 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-150 dark:divide-slate-850 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                        {filteredDebts.map(debt => {
                                            const isPendiente = debt.status === 'pendiente';
                                            const isVencido = isPendiente && debt.due_date && new Date(debt.due_date) < new Date();
                                            
                                            return (
                                                <tr key={debt.id} className="hover:bg-slate-50/50 dark:hover:bg-black/5 transition duration-150">
                                                    <td className="py-4 px-4">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-extrabold text-slate-800 dark:text-slate-100">Ticket #{debt.sale_id}</span>
                                                            <span className="text-[9px] text-slate-400 font-mono">{new Date(debt.created_at).toLocaleString('es-BO')}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-1.5 font-bold">
                                                                <User size={12} className="text-slate-400 shrink-0" />
                                                                <span>{debt.client_name}</span>
                                                            </div>
                                                            {debt.client_phone && (
                                                                <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 font-mono">
                                                                    <Phone size={10} className="shrink-0" />
                                                                    <span>{debt.client_phone}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                                                        Bs. {debt.total_amount.toFixed(2)}
                                                    </td>
                                                    <td className="py-4 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                                        Bs. {debt.paid_amount.toFixed(2)}
                                                    </td>
                                                    <td className="py-4 px-4 text-right font-mono font-extrabold text-rose-500 dark:text-rose-400 bg-rose-500/5">
                                                        Bs. {debt.remaining_amount.toFixed(2)}
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        {debt.due_date ? (
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold border uppercase tracking-wider ${
                                                                isVencido 
                                                                    ? 'bg-rose-550/10 text-rose-600 border-rose-500/10' 
                                                                    : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/10'
                                                            }`}>
                                                                <Calendar size={9} />
                                                                {debt.due_date}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase select-none">&mdash;</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        {isPendiente ? (
                                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                                                                isVencido 
                                                                    ? 'bg-rose-600 text-white border-rose-500' 
                                                                    : 'bg-amber-500/10 text-amber-500 border-amber-500/10'
                                                            }`}>
                                                                {isVencido ? 'Vencido' : 'Pendiente'}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/10">
                                                                <CheckCircle2 size={9.5} />
                                                                Pagado
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4 text-right">
                                                        <div className="flex gap-1.5 justify-end">
                                                            <button
                                                                onClick={() => loadPaymentHistory(debt)}
                                                                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-black/20 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-extrabold uppercase hover:text-indigo-500 dark:text-slate-350 flex items-center gap-1 transition cursor-pointer"
                                                                title="Ver historial de abonos"
                                                            >
                                                                <History size={11} />
                                                                Historial
                                                            </button>
                                                            {isPendiente && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedDebt(debt);
                                                                        setPaymentAmount(debt.remaining_amount.toFixed(2));
                                                                    }}
                                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1 shadow-md shadow-emerald-500/10 transition cursor-pointer"
                                                                >
                                                                    <CircleDollarSign size={11} />
                                                                    Cobrar
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* --- Modales del Tab Ventas Pendientes --- */}

            {/* Modal de Edición de Pedido Pendiente */}
            <AnimatePresence>
                {editingSale && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" 
                            onClick={() => setEditingSale(null)}
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                            className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200 dark:border-slate-850 p-4 sm:p-6 max-w-4xl w-full relative z-10 flex flex-col gap-4 shadow-2xl max-h-[95vh] overflow-hidden text-slate-800 dark:text-white"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-850/60 shrink-0">
                                <div className="flex items-center gap-2 text-amber-500">
                                    <Edit size={18} />
                                    <h3 className="text-sm font-extrabold uppercase tracking-wider">Editar Pedido Pendiente #{editingSale.id}</h3>
                                </div>
                                <button 
                                    onClick={() => setEditingSale(null)}
                                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 dark:text-slate-500 cursor-pointer transition"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            {/* Dual columns for content (Responsive) */}
                            <div className="flex-grow overflow-y-auto flex flex-col md:flex-row gap-4 pr-1">
                                
                                {/* Left Side: Client fields & Selected products */}
                                <div className="flex-1 flex flex-col gap-3">
                                    <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-widest border-b border-slate-100 dark:border-slate-850 pb-1">Datos del Envío</span>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre Cliente *</label>
                                            <input 
                                                type="text"
                                                required
                                                value={editedClientName}
                                                onChange={(e) => setEditedClientName(e.target.value)}
                                                className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs font-bold focus:outline-none focus:border-indigo-500 dark:text-slate-200"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Celular</label>
                                            <input 
                                                type="text"
                                                value={editedClientPhone}
                                                onChange={(e) => setEditedClientPhone(e.target.value)}
                                                className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs font-bold focus:outline-none focus:border-indigo-500 dark:text-slate-200"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dirección Destino *</label>
                                        <input 
                                            type="text"
                                            required
                                            value={editedDestination}
                                            onChange={(e) => setEditedDestination(e.target.value)}
                                            className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500 dark:text-slate-200"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Empresa de Transporte</label>
                                        <input 
                                            type="text"
                                            value={editedTransportCompany}
                                            onChange={(e) => setEditedTransportCompany(e.target.value)}
                                            placeholder="Ej. Trans Copacabana, Delivery Moto, etc."
                                            className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500 dark:text-slate-200"
                                        />
                                    </div>

                                    <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-widest border-b border-slate-100 dark:border-slate-850 pb-1 mt-1">Artículos en este pedido</span>
                                    <div className="flex flex-col gap-2 overflow-y-auto max-h-[220px] pr-1">
                                        {editedItems.length === 0 ? (
                                            <span className="text-[10px] text-slate-400 italic text-center py-6">No hay artículos agregados.</span>
                                        ) : (
                                            editedItems.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-black/20 border border-slate-150 dark:border-slate-850 rounded-xl gap-2">
                                                    <div className="flex-grow min-w-0">
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate">{item.product_name}</span>
                                                        <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 font-mono mt-1">
                                                            <span>Bs.</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={item.price}
                                                                onChange={(e) => {
                                                                    const val = Number(e.target.value);
                                                                    setEditedItems(prev => prev.map(it => 
                                                                        it.product_id === item.product_id ? { ...it, price: isNaN(val) ? 0 : val } : it
                                                                    ));
                                                                }}
                                                                className="w-16 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded font-bold text-[10px] text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-mono text-center shrink-0"
                                                            />
                                                            <span>• Stock: {item.current_stock || 0}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                                                        <button 
                                                            type="button" 
                                                            onClick={() => updateEditedQty(item.product_id, -1)}
                                                            className="w-6 h-6 rounded-lg bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-350 cursor-pointer text-xs"
                                                        >
                                                            <Minus size={10} />
                                                        </button>
                                                        <span className="font-mono text-xs font-black min-w-[20px] text-center">{item.quantity}</span>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => updateEditedQty(item.product_id, 1)}
                                                            className="w-6 h-6 rounded-lg bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-350 cursor-pointer text-xs"
                                                        >
                                                            <Plus size={10} />
                                                        </button>
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeEditedItem(item.product_id)}
                                                        className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Right Side: Search & Add new products from Catalog */}
                                <div className="w-full md:w-[320px] border-t md:border-t-0 md:border-l border-slate-150 dark:border-slate-850 pt-3 md:pt-0 md:pl-4 flex flex-col gap-2.5">
                                    <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-widest border-b border-slate-100 dark:border-slate-850 pb-1">Catálogo de Productos</span>
                                    
                                    <div className="relative">
                                        <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                        <input 
                                            type="text"
                                            placeholder="Buscar por artículo, SKU, #ID, marca o categoría..."
                                            value={productSearchQuery}
                                            onChange={(e) => setProductSearchQuery(e.target.value)}
                                            className="pl-8 pr-3 py-1.5 w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-850 rounded-xl text-[11px] font-bold focus:outline-none"
                                        />
                                    </div>

                                    <div className="flex-grow overflow-y-auto max-h-[300px] flex flex-col gap-1.5 pr-1">
                                        {filterAndRankProducts(productList, productSearchQuery)
                                            .slice(0, 25)
                                            .map((prod) => (
                                                <div 
                                                    key={prod.id} 
                                                    onClick={() => addProductToEdit(prod)}
                                                    className="p-2 bg-slate-50/50 hover:bg-slate-100 dark:bg-black/10 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-850 rounded-xl cursor-pointer flex items-center justify-between text-[10px] transition duration-150"
                                                >
                                                    <div className="min-w-0 pr-1">
                                                        <span className="font-bold text-slate-700 dark:text-slate-250 truncate block">{prod.name}</span>
                                                        <span className="text-slate-400 block mt-0.5">Stock: {prod.stock} • Bs. {prod.price_unit}</span>
                                                    </div>
                                                    <span className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white rounded-lg text-[9px] font-extrabold uppercase shrink-0">
                                                        + Agregar
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer with dynamically computed totals */}
                            <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between border-t border-slate-150 dark:border-slate-850 pt-4 gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nuevo Total Calculado:</span>
                                    <span className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400">
                                        Bs. {editedItems.reduce((acc, i) => acc + (i.quantity * i.price), 0).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex gap-2.5 w-full sm:w-auto">
                                    <button
                                        type="button"
                                        onClick={() => setEditingSale(null)}
                                        className="flex-1 sm:flex-initial px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider rounded-xl cursor-pointer transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveEditPending}
                                        disabled={savingEdit}
                                        className="flex-1 sm:flex-initial px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-450 hover:to-orange-450 text-white font-black uppercase text-[10px] tracking-wider rounded-xl cursor-pointer shadow-md shadow-amber-500/10 transition"
                                    >
                                        {savingEdit ? "Guardando..." : "Guardar Cambios"}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal de Cobro / Finalización de Venta Pendiente */}
            <AnimatePresence>
                {finalizingSale && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" 
                            onClick={() => setFinalizingSale(null)}
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                            className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-205 dark:border-slate-850 p-6 max-w-md w-full relative z-10 flex flex-col gap-4 shadow-2xl text-slate-800 dark:text-white"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-850/60 shrink-0">
                                <div className="flex items-center gap-2 text-emerald-500">
                                    <CircleDollarSign size={18} className="animate-pulse" />
                                    <h3 className="text-sm font-extrabold uppercase tracking-wider">Cobrar y Entregar Pedido</h3>
                                </div>
                                <button 
                                    onClick={() => setFinalizingSale(null)}
                                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 dark:text-slate-500 cursor-pointer transition"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            <div className="bg-slate-50 dark:bg-black/20 border border-slate-200/50 dark:border-slate-850/60 p-3 rounded-2xl flex flex-col gap-1.5 text-xs">
                                <div className="flex justify-between font-bold">
                                    <span className="text-slate-400 uppercase tracking-wider">Cliente:</span>
                                    <span>{finalizingSale.client_name}</span>
                                </div>
                                <div className="flex justify-between font-bold">
                                    <span className="text-slate-400 uppercase tracking-wider">Destino:</span>
                                    <span className="text-slate-500 dark:text-slate-400 max-w-[220px] truncate">{finalizingSale.destination}</span>
                                </div>
                                <div className="flex justify-between font-black text-indigo-600 dark:text-indigo-400 text-sm border-t border-slate-150 dark:border-slate-800/60 pt-2 mt-1">
                                    <span>Total a Pagar:</span>
                                    <span className="font-mono">Bs. {finalizingSale.total.toFixed(2)}</span>
                                </div>
                            </div>

                            <form onSubmit={handleFinalizePending} className="flex flex-col gap-4 text-xs">
                                
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Método de Pago</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Efectivo', 'Tarjeta', 'Transferencia', 'Crédito'].map((method) => {
                                            const isSelected = finalizePaymentMethod === method;
                                            return (
                                                <button
                                                    key={method}
                                                    type="button"
                                                    onClick={() => setFinalizePaymentMethod(method as any)}
                                                    className={`py-2 px-3 border rounded-xl font-bold uppercase text-[9.5px] transition ${
                                                        isSelected 
                                                            ? 'bg-emerald-600 border-emerald-500 text-white font-black shadow-md'
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-805 text-slate-500 hover:bg-slate-5'
                                                    }`}
                                                >
                                                    {method}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Link Client input for Accounts Receivable credits / customer points */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asignar Cliente en BD (Opcional)</label>
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                        className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold focus:outline-none"
                                    >
                                        <option value="">-- Cliente General / Al Paso --</option>
                                        {clients && clients.map((c: any) => (
                                            <option key={c.id} value={c.id}>{c.name} (Puntos: {c.points || 0})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Credit specific fields */}
                                {finalizePaymentMethod === 'Crédito' && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="flex flex-col gap-3 border-t border-slate-150 dark:border-slate-800/60 pt-3"
                                    >
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Abono Inicial (Bs.)</label>
                                            <input 
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max={finalizingSale.total}
                                                placeholder="Ej. 100 (Cero si es crédito total)"
                                                value={finalizeInitialAbono}
                                                onChange={(e) => setFinalizeInitialAbono(e.target.value)}
                                                className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-mono text-xs focus:outline-none"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha Límite de Pago</label>
                                            <input 
                                                type="date"
                                                required
                                                value={finalizeDueDate}
                                                onChange={(e) => setFinalizeDueDate(e.target.value)}
                                                className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold focus:outline-none"
                                            />
                                        </div>
                                    </motion.div>
                                )}

                                <div className="flex gap-2.5 mt-3">
                                    <button
                                        type="button"
                                        onClick={() => setFinalizingSale(null)}
                                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider rounded-xl cursor-pointer transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isFinalizing}
                                        className="flex-1 py-2.5 bg-emerald-605 hover:bg-emerald-500 text-white font-black uppercase text-[10px] tracking-wider rounded-xl shadow-md shadow-emerald-500/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
                                    >
                                        {isFinalizing ? "Finalizando..." : "Registrar Entrega"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* --- Modales del Tab Cuentas por Cobrar original --- */}

            {/* Dynamic payment apply Modal floating */}
            <AnimatePresence>
                {selectedDebt && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs" 
                            onClick={() => setSelectedDebt(null)}
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ type: "spring", stiffness: 350, damping: 28 }}
                            className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200 dark:border-slate-850 p-6 max-w-md w-full relative z-10 shadow-2xl flex flex-col gap-4 select-none"
                        >
                            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850/60 pb-3">
                                <div className="flex items-center gap-2 text-emerald-600">
                                    <CircleDollarSign size={16} />
                                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-850 dark:text-white">Aplicar Reintegro / Cobro</h3>
                                </div>
                                <button 
                                    onClick={() => setSelectedDebt(null)}
                                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-pointer"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            <form onSubmit={handleApplyPayment} className="flex flex-col gap-4 text-xs">
                                <div className="flex flex-col gap-1 p-3 bg-slate-50/50 dark:bg-black/20 border border-slate-150 dark:border-slate-850 rounded-2xl">
                                    <div className="flex justify-between text-[10.5px]">
                                        <span className="text-slate-400 font-bold uppercase tracking-wider">Cliente:</span>
                                        <span className="font-black text-slate-700 dark:text-slate-200 uppercase">{selectedDebt.client_name}</span>
                                    </div>
                                    <div className="flex justify-between text-[10.5px] mt-1 border-t border-slate-100 dark:border-slate-800/50 pt-1.5">
                                        <span className="text-slate-400 font-bold uppercase tracking-wider">Deuda Original:</span>
                                        <span className="font-mono text-slate-500 font-bold">Bs. {selectedDebt.total_amount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] mt-1 text-rose-500 dark:text-rose-400 font-black">
                                        <span>Saldo Pendiente:</span>
                                        <span className="font-mono">Bs. {selectedDebt.remaining_amount.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[9px] block">Monto del Reintegro (Bs.):</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            max={selectedDebt.remaining_amount}
                                            placeholder="Ingrese monto a cobrar" 
                                            className="px-4 py-2.5 w-full bg-slate-50/50 dark:bg-black/10 border border-slate-250 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 font-mono font-extrabold text-sm dark:text-white"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                            required
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setPaymentAmount(selectedDebt.remaining_amount.toFixed(2))}
                                            className="absolute right-3 top-2.5 px-2 py-0.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 font-black rounded-lg text-[9px] uppercase tracking-wider transition"
                                        >
                                            Total
                                        </button>
                                    </div>
                                    
                                    {Number(paymentAmount) > 0 && Number(paymentAmount) <= selectedDebt.remaining_amount && (
                                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono font-bold mt-1.5 bg-slate-50/40 dark:bg-black/10 px-2 py-1 rounded-lg">
                                            <span>NUEVO SALDO RESTANTE:</span>
                                            <span className="text-emerald-500 dark:text-emerald-400 font-black">
                                                Bs. {(selectedDebt.remaining_amount - Number(paymentAmount)).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[9px] block">Método de Reintegro de Pago:</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Efectivo', 'Tarjeta', 'Transferencia'].map((method) => {
                                            const isSelected = paymentMethod === method;
                                            return (
                                                <button
                                                    key={method}
                                                    type="button"
                                                    onClick={() => setPaymentMethod(method as any)}
                                                    className={`py-2 px-3 border rounded-xl font-bold uppercase text-[9.5px] transition ${
                                                        isSelected 
                                                            ? 'bg-emerald-600 border-emerald-500 text-white font-black shadow-md shadow-emerald-500/15'
                                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-805 text-slate-500 dark:text-slate-400 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {method}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="font-extrabold text-slate-400 uppercase tracking-widest text-[9px] block">Observaciones / Notas (Opcional):</label>
                                    <textarea 
                                        placeholder="Ingrese notas (ej. Pago transferido al banco, abono en efectivo)"
                                        className="p-3 w-full bg-slate-50/50 dark:bg-black/10 border border-slate-250 dark:border-slate-800 rounded-2xl focus:outline-none focus:border-indigo-500 flex-1 min-h-[60px] dark:text-white"
                                        value={paymentNotes}
                                        onChange={(e) => setPaymentNotes(e.target.value)}
                                        maxLength={250}
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedDebt(null)}
                                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold uppercase rounded-xl transition cursor-pointer text-[10px] text-center uppercase tracking-wide dark:bg-slate-900 dark:text-slate-350"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={paying}
                                        className="flex-1 py-2.5 bg-emerald-650 hover:bg-emerald-600 text-white font-black uppercase rounded-xl shadow-lg shadow-emerald-500/15 disabled:opacity-50 transition cursor-pointer text-[10px]"
                                    >
                                        {paying ? 'Procesando...' : 'Aplicar Abono'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Payment History View Drawer Modal */}
            <AnimatePresence>
                {historyDebt && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs" 
                            onClick={() => setHistoryDebt(null)}
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ type: "spring", stiffness: 350, damping: 28 }}
                            className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200 dark:border-slate-850 p-6 max-w-md w-full relative z-10 shadow-2xl flex flex-col gap-4 select-none max-h-[85vh] overflow-y-auto"
                        >
                            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850/60 pb-3">
                                <div className="flex items-center gap-2 text-indigo-500">
                                    <History size={16} />
                                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-850 dark:text-white">Historial de Pagos</h3>
                                </div>
                                <button 
                                    onClick={() => setHistoryDebt(null)}
                                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-pointer"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-1 p-3 bg-slate-50/50 dark:bg-black/20 border border-slate-150 dark:border-slate-850 rounded-2xl text-xs">
                                <div className="flex justify-between text-[11px] font-bold">
                                    <span className="text-slate-400">Cliente:</span>
                                    <span className="text-slate-800 dark:text-slate-200 uppercase">{historyDebt.client_name}</span>
                                </div>
                                <div className="flex justify-between mt-1 text-[11px] font-semibold border-t border-slate-105/55 dark:border-slate-800/50 pt-1.5">
                                    <span className="text-slate-400">Total Ticket Original:</span>
                                    <span className="font-mono text-slate-800 dark:text-slate-300">Bs. {historyDebt.total_amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between mt-1 text-[11px] font-bold text-emerald-600">
                                    <span>Total Abonado:</span>
                                    <span className="font-mono">Bs. {historyDebt.paid_amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between mt-1 text-[11px] font-black text-rose-500">
                                    <span>Deuda Restante:</span>
                                    <span className="font-mono">Bs. {historyDebt.remaining_amount.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 overflow-y-auto max-h-[280px]">
                                <h4 className="font-extrabold text-[9px] uppercase tracking-widest text-slate-400 font-mono mt-1 mb-1">Abonos Históricos Registrados</h4>
                                
                                {loadingHistory ? (
                                    <div className="flex justify-center py-8">
                                        <div className="w-6 h-6 border-2 border-indigo-650 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : paymentHistory.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 text-xs font-semibold">
                                        Ninguno abono ha sido registrado para esta cuenta todavía.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2.5">
                                        {paymentHistory.map((item) => (
                                            <div key={item.id} className="p-3 bg-slate-50/60 dark:bg-[#070b13] border border-slate-155 dark:border-slate-850/80 rounded-2xl flex flex-col gap-1.5 text-xs">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm leading-none">
                                                        +Bs. {item.amount.toFixed(2)}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-slate-400 font-bold">
                                                        {new Date(item.registered_at).toLocaleString('es-BO')}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold border-t border-slate-100 dark:border-slate-800/40 pt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Tag size={10} className="shrink-0" />
                                                        Método: {item.payment_method}
                                                    </span>
                                                    {item.user_name && (
                                                        <span>Por: @{item.user_name}</span>
                                                    )}
                                                </div>
                                                {item.notes && (
                                                    <p className="text-[10.5px] font-semibold text-slate-500 italic mt-0.5 leading-relaxed">
                                                        &ldquo;{item.notes}&rdquo;
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => setHistoryDebt(null)}
                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl uppercase tracking-wider transition cursor-pointer mt-2 dark:bg-slate-900 dark:text-slate-350"
                            >
                                Cerrar Ventana
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal para Registrar Abonos a Ventas Pendientes */}
            <AnimatePresence>
                {payingPendingSale && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" 
                            onClick={() => setPayingPendingSale(null)}
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                            className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200 dark:border-slate-850 p-6 max-w-md w-full relative z-10 flex flex-col gap-4 shadow-2xl text-slate-800 dark:text-white"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-850/60 shrink-0">
                                <div className="flex items-center gap-2 text-indigo-500">
                                    <CircleDollarSign size={18} className="animate-pulse" />
                                    <h3 className="text-sm font-extrabold uppercase tracking-wider">Registrar Abono a Venta #{payingPendingSale.id}</h3>
                                </div>
                                <button 
                                    onClick={() => setPayingPendingSale(null)}
                                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 dark:text-slate-500 cursor-pointer transition"
                                >
                                    <X size={15} />
                                </button>
                            </div>

                            <div className="bg-slate-50 dark:bg-black/20 border border-slate-200/50 dark:border-slate-850/60 p-3.5 rounded-2xl flex flex-col gap-1.5 text-xs">
                                <div className="flex justify-between font-bold">
                                    <span className="text-slate-400 uppercase tracking-wider">Cliente:</span>
                                    <span>{payingPendingSale.client_name}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-100 dark:border-slate-850/40 pt-1.5 mt-0.5 font-bold">
                                    <span className="text-slate-400">Total Original:</span>
                                    <span className="font-mono font-bold">Bs. {payingPendingSale.total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-emerald-600">
                                    <span>Total Abonado:</span>
                                    <span className="font-mono">Bs. {(payingPendingSale.paid_amount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-black border-t border-indigo-100 dark:border-indigo-950/50 pt-2 text-indigo-600 dark:text-indigo-400">
                                    <span>Saldo Restante:</span>
                                    <span className="font-mono text-sm">Bs. {(payingPendingSale.total - (payingPendingSale.paid_amount || 0)).toFixed(2)}</span>
                                </div>
                            </div>

                            <form onSubmit={handleRegisterPendingPayment} className="flex flex-col gap-3.5">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9.5px] font-black uppercase text-slate-400 tracking-wider">Monto a Abonar (Bs.)</label>
                                    <input 
                                        type="number" 
                                        step="any"
                                        placeholder="Ej. 150.00" 
                                        required
                                        className="px-4 py-2.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 dark:text-white text-xs font-mono font-bold"
                                        value={paymentPendingAmount}
                                        onChange={(e) => setPaymentPendingAmount(e.target.value)}
                                        max={payingPendingSale.total - (payingPendingSale.paid_amount || 0)}
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9.5px] font-black uppercase text-slate-400 tracking-wider">Método de Pago</label>
                                    <select
                                        className="px-4 py-2.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 dark:text-white text-xs font-bold"
                                        value={paymentPendingMethod}
                                        onChange={(e) => setPaymentPendingMethod(e.target.value as any)}
                                    >
                                        <option value="Efectivo" className="dark:bg-[#0c111e]">Efectivo</option>
                                        <option value="Tarjeta" className="dark:bg-[#0c111e]">Tarjeta de Débito/Crédito</option>
                                        <option value="Transferencia" className="dark:bg-[#0c111e]">Transferencia Bancaria / QR</option>
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9.5px] font-black uppercase text-slate-400 tracking-wider">Notas / Concepto de Abono</label>
                                    <textarea 
                                        placeholder="Escribe alguna observación o descripción de la entrega..." 
                                        className="px-4 py-2.5 bg-slate-50/50 dark:bg-black/20 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:border-indigo-500 dark:text-white text-xs font-semibold min-h-[60px]"
                                        value={paymentPendingNotes}
                                        onChange={(e) => setPaymentPendingNotes(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <button 
                                        type="button"
                                        onClick={() => setPayingPendingSale(null)}
                                        className="py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl uppercase tracking-wider transition cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={registeringPendingPayment}
                                        className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-xl uppercase tracking-wider transition cursor-pointer shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5"
                                    >
                                        {registeringPendingPayment ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Check size={14} />
                                                <span>Registrar</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal para Ver Historial de Abonos a Ventas Pendientes */}
            <AnimatePresence>
                {historyPendingSale && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" 
                            onClick={() => setHistoryPendingSale(null)}
                        />
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 15 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 15 }}
                            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                            className="bg-white dark:bg-[#0c111e] rounded-3xl border border-slate-200 dark:border-slate-850 p-6 max-w-md w-full relative z-10 flex flex-col gap-4 shadow-2xl text-slate-800 dark:text-white select-none"
                        >
                            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850/60 pb-3">
                                <div className="flex items-center gap-2 text-indigo-500">
                                    <History size={16} />
                                    <h3 className="font-extrabold text-xs uppercase tracking-wider">Historial de Abonos (Venta #{historyPendingSale.id})</h3>
                                </div>
                                <button 
                                    onClick={() => setHistoryPendingSale(null)}
                                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-pointer"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-1.5 p-3.5 bg-slate-50/50 dark:bg-black/20 border border-slate-150 dark:border-slate-850 rounded-2xl text-xs">
                                <div className="flex justify-between text-[11px] font-bold">
                                    <span className="text-slate-400">Cliente:</span>
                                    <span className="uppercase">{historyPendingSale.client_name}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-100/60 dark:border-slate-800/40 pt-1.5 mt-0.5 font-semibold text-[11px]">
                                    <span className="text-slate-400">Total Venta Original:</span>
                                    <span className="font-mono">Bs. {historyPendingSale.total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-[11px] font-bold text-emerald-600">
                                    <span>Total Recibido:</span>
                                    <span className="font-mono">Bs. {(historyPendingSale.paid_amount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-[11px] font-black text-rose-500 border-t border-slate-100/60 dark:border-slate-800/40 pt-1.5">
                                    <span>Saldo Restante a Cobrar:</span>
                                    <span className="font-mono">Bs. {(historyPendingSale.total - (historyPendingSale.paid_amount || 0)).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 overflow-y-auto max-h-[280px]">
                                <h4 className="font-extrabold text-[9px] uppercase tracking-widest text-slate-400 font-mono mt-1 mb-1">Abonos Históricos Registrados</h4>
                                
                                {loadingPendingHistory ? (
                                    <div className="flex justify-center py-8">
                                        <div className="w-6 h-6 border-2 border-indigo-650 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                ) : pendingPaymentHistory.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 text-xs font-semibold">
                                        Ningún abono ha sido registrado para esta venta pendiente todavía.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2.5">
                                        {pendingPaymentHistory.map((item) => (
                                            <div key={item.id} className="p-3 bg-slate-50/60 dark:bg-[#070b13] border border-slate-155 dark:border-slate-850/80 rounded-2xl flex flex-col gap-1.5 text-xs">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm leading-none">
                                                        +Bs. {item.amount.toFixed(2)}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-slate-400 font-bold">
                                                        {new Date(item.registered_at).toLocaleString('es-BO')}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold border-t border-slate-100 dark:border-slate-800/40 pt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Tag size={10} className="shrink-0" />
                                                        Método: {item.payment_method}
                                                    </span>
                                                    {item.user_name && (
                                                        <span>Por: @{item.user_name}</span>
                                                    )}
                                                </div>
                                                {item.notes && (
                                                    <p className="text-[10.5px] font-semibold text-slate-500 italic mt-0.5 leading-relaxed">
                                                        &ldquo;{item.notes}&rdquo;
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => setHistoryPendingSale(null)}
                                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl uppercase tracking-wider transition cursor-pointer mt-2 dark:bg-slate-900 dark:text-slate-350"
                            >
                                Cerrar Ventana
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Custom Sliding Toast notification matching POS styling */}
            <AnimatePresence>
                {notification && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        className="fixed bottom-6 right-6 z-[160] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border text-xs font-bold bg-slate-900 border-slate-800 text-white shadow-slate-900/10"
                    >
                        <span className="text-sm">{notification.type === 'success' ? '✓' : '⚠️'}</span>
                        <span>{notification.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
