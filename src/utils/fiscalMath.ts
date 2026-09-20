/**
 * Módulo de Diagnóstico y Pruebas Unitarias de Precisión Matemática del POS
 * Valida la exactitud en subtotales, descuentos, puntos y totales sin errores de coma flotante (IEEE-754).
 * Sin recargos ni impuestos adicionales.
 */

export interface CartItemMath {
  id?: number | string;
  name?: string;
  price: number; // Precio unitario en BOB o USD
  quantity: number;
}

export interface TransactionCalculationResult {
  grossSubtotal: number;         // Subtotal bruto de los productos
  discountAmount: number;        // Descuento exacto aplicado
  subtotalAfterDiscount: number; // Subtotal neto tras descuento
  pointsRedeemed: number;        // Descuento por puntos
  finalTotalBs: number;          // Total a cobrar en Bolivianos (BOB)
  finalTotalUSD: number;         // Total equivalente en Dólares (USD)
  currency: 'BOB' | 'USD';
  exchangeRate: number;
  hasFloatingResidue: boolean;   // Indica si hubo residuo de coma flotante
  lineDetails: Array<{
    name: string;
    unitPrice: number;
    quantity: number;
    lineSubtotal: number;
  }>;
}

export interface UnitTestResult {
  id: string;
  category: 'Coma Flotante IEEE-754' | 'Subtotales y Multi-Línea' | 'Descuentos y Promociones' | 'Pagos y Puntos' | 'Multi-Moneda BOB/USD' | 'Estrés de Transacciones';
  title: string;
  description: string;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  residualError: number;
  executionTimeMs: number;
  technicalFormula: string;
}

/**
 * Redondeo financiero exacto a 2 decimales con compensación epsilon.
 */
export function roundToDecimals(num: number, decimals: number = 2): number {
  if (isNaN(num) || !isFinite(num)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

/**
 * Convierte un monto a centavos enteros para aritmética segura.
 */
export function toCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}

/**
 * Convierte centavos enteros a importe monetario con 2 decimales.
 */
export function fromCents(cents: number): number {
  return roundToDecimals(cents / 100, 2);
}

/**
 * Suma una lista de importes monetarios en centavos enteros.
 */
export function sumExact(amounts: number[]): number {
  const totalCents = amounts.reduce((acc, curr) => acc + toCents(curr), 0);
  return fromCents(totalCents);
}

/**
 * Multiplicación monetaria segura: precio unitario * cantidad.
 */
export function multiplyExact(price: number, quantity: number): number {
  const raw = price * quantity;
  return roundToDecimals(raw, 2);
}

/**
 * Calcula los subtotales, descuentos y total de una venta POS sin errores de coma flotante.
 */
export function calculatePosTransaction(
  items: CartItemMath[],
  discount: number = 0,
  discountType: 'monto' | 'porcentaje' = 'monto',
  exchangeRate: number = 6.96,
  usePoints: boolean = false,
  availablePoints: number = 0,
  currency: 'BOB' | 'USD' = 'BOB'
): TransactionCalculationResult {
  const rate = exchangeRate > 0 ? exchangeRate : 6.96;
  
  // 1. Detalle de líneas
  const lineDetails = items.map((item, idx) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const unitPrice = Math.max(0, Number(item.price) || 0);
    const lineSubtotal = multiplyExact(unitPrice, qty);
    return {
      name: item.name || `Producto ${idx + 1}`,
      unitPrice,
      quantity: qty,
      lineSubtotal
    };
  });

  // 2. Subtotal bruto exacto
  const grossSubtotal = lineDetails.reduce((acc, line) => sumExact([acc, line.lineSubtotal]), 0);

  // 3. Descuento
  let discountAmount = 0;
  if (discount > 0) {
    if (discountType === 'porcentaje') {
      const pct = Math.min(100, Math.max(0, discount));
      discountAmount = roundToDecimals((grossSubtotal * pct) / 100, 2);
    } else {
      discountAmount = roundToDecimals(Math.min(grossSubtotal, Math.max(0, discount)), 2);
    }
  }

  // 4. Subtotal tras descuento
  const subtotalAfterDiscount = Math.max(0, fromCents(toCents(grossSubtotal) - toCents(discountAmount)));

  // 5. Puntos de fidelización (1 punto = 1.00 BOB)
  let pointsRedeemed = 0;
  if (usePoints && availablePoints > 0) {
    const maxRedeemable = Math.floor(subtotalAfterDiscount);
    pointsRedeemed = Math.min(Math.floor(availablePoints), maxRedeemable);
  }

  // 6. Total neto a pagar en BOB
  const finalTotalBs = Math.max(0, fromCents(toCents(subtotalAfterDiscount) - toCents(pointsRedeemed)));

  // 7. Equivalente en USD
  const finalTotalUSD = roundToDecimals(finalTotalBs / rate, 2);

  // Detección de residuo binario de coma flotante
  const rawSum = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
  const hasFloatingResidue = Math.abs(rawSum - grossSubtotal) > 0.000000001;

  return {
    grossSubtotal,
    discountAmount,
    subtotalAfterDiscount,
    pointsRedeemed,
    finalTotalBs,
    finalTotalUSD,
    currency,
    exchangeRate: rate,
    hasFloatingResidue,
    lineDetails
  };
}

/**
 * Batería de Pruebas Unitarias de Diagnóstico de Precisión Matemática para el POS.
 */
export function runFiscalPrecisionTests(): UnitTestResult[] {
  const tests: UnitTestResult[] = [];

  // TEST 1: Anomalía clásica IEEE-754 (0.1 + 0.2)
  (() => {
    const t0 = performance.now();
    const rawSum = 0.1 + 0.2;
    const cleanSum = sumExact([0.1, 0.2]);
    const expected = 0.3;
    const residual = Math.abs(cleanSum - expected);
    const t1 = performance.now();
    tests.push({
      id: 'MATH-001',
      category: 'Coma Flotante IEEE-754',
      title: 'Suma de Fracciones Decimales (0.1 + 0.2)',
      description: 'Verifica que la acumulación de centavos no genere el residuo binario estándar IEEE-754 (0.30000000000000004).',
      input: '0.10 BOB + 0.20 BOB',
      expected: '0.30 BOB',
      actual: `${cleanSum.toFixed(2)} BOB (Raw JS: ${rawSum})`,
      passed: cleanSum === expected && residual === 0,
      residualError: residual,
      executionTimeMs: Number((t1 - t0).toFixed(3)),
      technicalFormula: 'sumExact([0.1, 0.2]) === 0.30'
    });
  })();

  // TEST 2: Resta con Residuos Flotantes (100.05 - 100.00)
  (() => {
    const t0 = performance.now();
    const rawDiff = 100.05 - 100.00;
    const cleanDiff = fromCents(toCents(100.05) - toCents(100.00));
    const expected = 0.05;
    const residual = Math.abs(cleanDiff - expected);
    const t1 = performance.now();
    tests.push({
      id: 'MATH-002',
      category: 'Coma Flotante IEEE-754',
      title: 'Diferencia de Cambio / Descuento (100.05 - 100.00)',
      description: 'Evita que el cálculo de cambio o descuento devuelva 0.05000000000000426 en caja.',
      input: '100.05 BOB - 100.00 BOB',
      expected: '0.05 BOB',
      actual: `${cleanDiff.toFixed(2)} BOB (Raw JS: ${rawDiff})`,
      passed: cleanDiff === expected && residual === 0,
      residualError: residual,
      executionTimeMs: Number((t1 - t0).toFixed(3)),
      technicalFormula: 'fromCents(toCents(100.05) - toCents(100.00)) === 0.05'
    });
  })();

  // TEST 3: Multiplicación y Centavos Enteros (1.14 * 100)
  (() => {
    const t0 = performance.now();
    const rawMult = 1.14 * 100; // En JS crudo da 113.99999999999999
    const cleanMult = toCents(1.14);
    const expected = 114;
    const residual = Math.abs(cleanMult - expected);
    const t1 = performance.now();
    tests.push({
      id: 'MATH-003',
      category: 'Coma Flotante IEEE-754',
      title: 'Conversión Segura a Centavos (1.14 × 100)',
      description: 'Comprueba que no ocurra truncamiento indeseado a 113 centavos por representación binaria.',
      input: '1.14 BOB × 100 centavos',
      expected: '114 centavos',
      actual: `${cleanMult} centavos (Raw JS: ${rawMult})`,
      passed: cleanMult === expected && residual === 0,
      residualError: residual,
      executionTimeMs: Number((t1 - t0).toFixed(3)),
      technicalFormula: 'toCents(1.14) === 114'
    });
  })();

  // TEST 4: Carrito Multi-Línea con Precios Decimales Fraccionarios
  (() => {
    const t0 = performance.now();
    const items = [
      { price: 19.99, quantity: 3 }, // 59.97
      { price: 4.55, quantity: 7 },  // 31.85
      { price: 12.30, quantity: 2 }, // 24.60
      { price: 0.75, quantity: 4 }   // 3.00
    ];
    // Subtotal = 59.97 + 31.85 + 24.60 + 3.00 = 119.42
    const res = calculatePosTransaction(items, 0, 'monto');
    const expected = 119.42;
    const passed = res.grossSubtotal === expected && res.finalTotalBs === expected;
    const t1 = performance.now();
    tests.push({
      id: 'POS-001',
      category: 'Subtotales y Multi-Línea',
      title: 'Cálculo Exacto de Carrito Multi-Línea',
      description: 'Verifica la suma acumulativa de 4 líneas con decimales y cantidades variadas.',
      input: '3x19.99 + 7x4.55 + 2x12.30 + 4x0.75',
      expected: 'Subtotal: 119.42 BOB | Total: 119.42 BOB',
      actual: `Subtotal: ${res.grossSubtotal.toFixed(2)} BOB | Total: ${res.finalTotalBs.toFixed(2)} BOB`,
      passed,
      residualError: Math.abs(res.finalTotalBs - expected),
      executionTimeMs: Number((t1 - t0).toFixed(3)),
      technicalFormula: 'sumExact([59.97, 31.85, 24.60, 3.00]) === 119.42'
    });
  })();

  // TEST 5: Descuento Porcentual 15%
  (() => {
    const t0 = performance.now();
    const items = [
      { price: 19.99, quantity: 3 }, // 59.97
      { price: 4.55, quantity: 7 },  // 31.85
      { price: 12.30, quantity: 2 }  // 24.60 -> Total bruto: 116.42
    ];
    // Descuento 15% = 116.42 * 0.15 = 17.463 -> 17.46
    // Total = 116.42 - 17.46 = 98.96
    const res = calculatePosTransaction(items, 15, 'porcentaje');
    const passed = res.grossSubtotal === 116.42 && res.discountAmount === 17.46 && res.finalTotalBs === 98.96;
    const t1 = performance.now();
    tests.push({
      id: 'DISC-001',
      category: 'Descuentos y Promociones',
      title: 'Descuento Porcentual 15% sobre Carrito',
      description: 'Valida que el 15% sobre 116.42 BOB se redondee exactamente a 17.46 BOB dando un total de 98.96 BOB.',
      input: 'Subtotal: 116.42 BOB con 15% de descuento',
      expected: 'Desc: 17.46 BOB | Total: 98.96 BOB',
      actual: `Desc: ${res.discountAmount.toFixed(2)} BOB | Total: ${res.finalTotalBs.toFixed(2)} BOB`,
      passed,
      residualError: Math.abs(res.finalTotalBs - 98.96),
      executionTimeMs: Number((t1 - t0).toFixed(3)),
      technicalFormula: '116.42 - roundToDecimals(116.42 * 0.15, 2) === 98.96'
    });
  })();

  // TEST 6: Descuento en Monto Fijo y Protección de Saldo Negativo
  (() => {
    const t0 = performance.now();
    const items = [{ price: 50.00, quantity: 1 }];
    const res = calculatePosTransaction(items, 80.00, 'monto');
    const passed = res.finalTotalBs === 0 && res.discountAmount === 50.00;
    const t1 = performance.now();
    tests.push({
      id: 'DISC-002',
      category: 'Descuentos y Promociones',
      title: 'Protección Contra Totales Negativos en Descuento',
      description: 'Si se intenta aplicar 80 BOB de descuento a una compra de 50 BOB, se acota a 50 BOB y el total resulta 0.00 BOB.',
      input: 'Compra: 50.00 BOB | Descuento: 80.00 BOB',
      expected: 'Desc: 50.00 BOB | Total: 0.00 BOB',
      actual: `Desc: ${res.discountAmount.toFixed(2)} BOB | Total: ${res.finalTotalBs.toFixed(2)} BOB`,
      passed,
      residualError: res.finalTotalBs,
      executionTimeMs: Number((t1 - t0).toFixed(3)),
      technicalFormula: 'Math.max(0, Subtotal - Math.min(Subtotal, Descuento))'
    });
  })();

  // TEST 7: Desglose de Pagos Múltiples (Efectivo + Tarjeta + QR)
  (() => {
    const t0 = performance.now();
    const totalVenta = 125.80;
    const pagoEfectivo = 50.00;
    const pagoTarjeta = 50.80;
    const pagoQR = 25.00;
    const sumaPagos = sumExact([pagoEfectivo, pagoTarjeta, pagoQR]);
    const diferencia = fromCents(toCents(totalVenta) - toCents(sumaPagos));
    const passed = sumaPagos === totalVenta && diferencia === 0;
    const t1 = performance.now();
    tests.push({
      id: 'PAY-001',
      category: 'Pagos y Puntos',
      title: 'Desglose y División de Pagos Mixtos',
      description: 'Comprueba que pagos divididos (50.00 + 50.80 + 25.00) coincidan exactamente con 125.80 BOB sin descuadres de centavos.',
      input: 'Venta: 125.80 BOB | Pagos: 50.00 + 50.80 + 25.00',
      expected: 'Suma de Pagos: 125.80 BOB | Diferencia: 0.00 BOB',
      actual: `Suma: ${sumaPagos.toFixed(2)} BOB | Dif: ${diferencia.toFixed(2)} BOB`,
      passed,
      residualError: Math.abs(diferencia),
      executionTimeMs: Number((t1 - t0).toFixed(3)),
      technicalFormula: 'sumExact([50.00, 50.80, 25.00]) === 125.80'
    });
  })();

  // TEST 8: Canje de Puntos de Fidelización
  (() => {
    const t0 = performance.now();
    const items = [{ price: 25.50, quantity: 2 }]; // Subtotal: 51.00 BOB
    // Cliente tiene 100 puntos. Descuento previo 10.00 BOB. Subtotal restante: 41.00 BOB.
    const res = calculatePosTransaction(items, 10, 'monto', 6.96, true, 100);
    const passed = res.pointsRedeemed === 41 && res.finalTotalBs === 0.00;
    const t1 = performance.now();
    tests.push({
      id: 'POINTS-001',
      category: 'Pagos y Puntos',
      title: 'Canje de Puntos Acotado al Remanente',
      description: 'Verifica que el canje de puntos se limite al saldo pendiente (41 pts) tras aplicar el descuento.',
      input: '51.00 BOB - 10.00 BOB desc | 100 pts disponibles',
      expected: 'Puntos canjeados: 41 pts | Total: 0.00 BOB',
      actual: `Puntos canjeados: ${res.pointsRedeemed} pts | Total: ${res.finalTotalBs.toFixed(2)} BOB`,
      passed,
      residualError: res.finalTotalBs,
      executionTimeMs: Number((t1 - t0).toFixed(3)),
      technicalFormula: 'pointsRedeemed === Math.min(pts, floor(Subtotal - Descuento))'
    });
  })();

  // TEST 9: Conversión de Moneda BOB / USD (T/C 6.96)
  (() => {
    const t0 = performance.now();
    const totalBs = 69.60;
    const exchangeRate = 6.96;
    const totalUSD = roundToDecimals(totalBs / exchangeRate, 2); // 10.00
    const reconvertedBs = roundToDecimals(totalUSD * exchangeRate, 2); // 69.60
    const passed = totalUSD === 10.00 && reconvertedBs === 69.60;
    const t1 = performance.now();
    tests.push({
      id: 'FX-001',
      category: 'Multi-Moneda BOB/USD',
      title: 'Conversión Simétrica BOB / USD (T/C 6.96)',
      description: 'Valida la simetría de cambio entre Bolivianos y Dólares sin pérdidas por redondeo.',
      input: '69.60 BOB a Tasa 6.96',
      expected: '10.00 USD <-> 69.60 BOB',
      actual: `${totalUSD.toFixed(2)} USD <-> ${reconvertedBs.toFixed(2)} BOB`,
      passed,
      residualError: Math.abs(reconvertedBs - totalBs),
      executionTimeMs: Number((t1 - t0).toFixed(3)),
      technicalFormula: 'round(round(69.60 / 6.96) * 6.96) === 69.60'
    });
  })();

  // TEST 10: Prueba de Estrés de Transacciones (1,000 transacciones simuladas)
  (() => {
    const t0 = performance.now();
    let discrepancies = 0;
    for (let i = 1; i <= 1000; i++) {
      const price = roundToDecimals((i * 7.33) % 45 + 0.15, 2);
      const qty = (i % 5) + 1;
      const sub = multiplyExact(price, qty);
      const discPct = (i % 20); // 0% a 19%
      const discAmount = roundToDecimals((sub * discPct) / 100, 2);
      const netTotal = fromCents(toCents(sub) - toCents(discAmount));
      if (roundToDecimals(netTotal + discAmount, 2) !== sub) {
        discrepancies++;
      }
    }
    const t1 = performance.now();
    const passed = discrepancies === 0;
    tests.push({
      id: 'STRESS-001',
      category: 'Estrés de Transacciones',
      title: 'Prueba de Estrés: 1,000 Transacciones Consecutivas',
      description: 'Ejecuta 1,000 ventas simuladas con precios decimales y descuentos variados garantizando 0 discrepancias de centavos.',
      input: '1,000 transacciones con precios y descuentos aleatorios',
      expected: '0 discrepancias',
      actual: `${discrepancies} discrepancias detectadas`,
      passed,
      residualError: discrepancies,
      executionTimeMs: Number((t1 - t0).toFixed(2)),
      technicalFormula: 'Para toda venta: Total_Neto + Descuento === Subtotal_Bruto'
    });
  })();

  return tests;
}
