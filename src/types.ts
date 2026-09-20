export interface User {
    id: number;
    username: string;
    role: 'admin' | 'trabajador';
    email?: string | null;
    permissions: {
        view_reports: boolean;
        edit_prices: boolean;
        view_inventory: boolean;
        apply_discounts?: boolean;
        manage_credits?: boolean;
        manage_caja?: boolean;
        delete_sales?: boolean;
        view_sales?: boolean;
        access_ai?: boolean;
    };
}

export interface Product {
    id: number;
    name: string;
    category: string;
    sku: string;
    stock: number;
    price_unit: number; // Precio detalle
    price_bulk: number; // Precio mayorista
    price_cost: number; // Precio costo
    stock_alarm: number;
    image?: string | null;
}

export interface Client {
    id: number;
    name: string;
    phone: string;
    points?: number;
}

export interface CartItem extends Product {
    cartQuantity: number;
    price_type?: 'unit' | 'bulk' | 'custom';
    custom_price?: number; // Custom price in USD
    custom_price_bs?: number; // Custom price in Bolivianos (exact entered value)
}

export interface ReceiptTemplate {
    logoText: string;
    showLogo: boolean;
    headerText: string;
    footerText: string;
    showDate: boolean;
    showCashier: boolean;
    showClientInfo: boolean;
    showHeaderDivider: boolean;
    showFooterDivider: boolean;
    showItemSKU: boolean;
    showPaymentMethod: boolean;
    fontFamily: 'Helvetica' | 'Courier' | 'Times';
    fontSizeHeader: number;
    fontSizeBody: number;
    ticketWidth: number; // e.g. 80 (80mm) or 58 (58mm)
    logoImage?: string | null;
}

export interface Department {
    id: number;
    name: string;
}

export interface StockArrival {
    id: number;
    product_id: number;
    product_name?: string;
    product_sku?: string;
    quantity: number;
    arrival_price: number;
    created_at: string;
}

export interface SaleTab {
    id: number;
    name: string;
    cart: CartItem[];
    clientName: string;
    clientPhone: string;
    discount: number;
    discountType: 'monto' | 'porcentaje';
    paymentMethod: 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Crédito';
}

export interface RgbThemeSettings {
    effectType: 'rainbow' | 'neon' | 'fireIce' | 'aurora' | 'cyberpunk' | 'pastel' | 'custom' | 'oceanic' | 'sunset';
    speed: number; // in seconds
    glowIntensity: 'none' | 'subtle' | 'normal' | 'intense';
    angle: number; // in degrees
    customColors: string[]; // List of hex values
    animationStyle: 'linear' | 'smooth' | 'cyclic'; // lineal, suave, cíclica
}


