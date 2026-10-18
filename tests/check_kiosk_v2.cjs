/**
 * Test Suite: GTR POS Kiosco Seguridad V2 (Sin Regresiones)
 * 
 * Verifica que el Modo Kiosco cumpla con:
 * 1. Protección estricta de rutas sensibles en la interfaz.
 * 2. Bloqueo de navegación de cajero en terminal fiscal.
 * 3. Endpoint /api/auth/verify-supervisor funcional y protegido.
 * 4. Endpoint /api/settings/kiosk con control de roles.
 * 5. Auto-relock por inactividad tras desbloqueo de supervisor.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

function makeRequest(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (dataString) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(dataString);
    }

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: urlPath,
      method: method,
      headers: reqHeaders,
      timeout: 5000,
    }, (res) => {
      let rawData = '';
      res.on('data', chunk => { rawData += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(rawData);
        } catch (e) {
          json = rawData;
        }
        resolve({ statusCode: res.statusCode, data: json });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("   GTR POS - TEST SUITE KIOSCO SEGURIDAD V2       ");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // --- TEST 1: Source code invariant checks ---
  console.log("--- 1. Verificación de Código Fuente Frontend ---");
  const appTsx = fs.readFileSync(path.join(__dirname, '../src/App.tsx'), 'utf-8');
  const appContextTsx = fs.readFileSync(path.join(__dirname, '../src/context/AppContext.tsx'), 'utf-8');

  assert(
    "App.tsx restringe vistas de Kiosco a ['pos', 'cajas', 'historial_ventas', 'conteo_fisico']",
    appTsx.includes("const allowedKioskViews = ['pos', 'cajas', 'historial_ventas', 'conteo_fisico']")
  );

  assert(
    "App.tsx protege la vista 'inicio' bloqueándola en modo kiosco",
    appTsx.includes("view === 'inicio' && (!isKioskLocked ? <InicioView /> : <POS />)")
  );

  assert(
    "App.tsx protege la vista 'reportes' ante modo kiosco",
    appTsx.includes("view === 'reportes' && !isKioskLocked")
  );

  assert(
    "App.tsx protege la vista 'usuarios' ante modo kiosco",
    appTsx.includes("view === 'usuarios' && !isKioskLocked")
  );

  assert(
    "App.tsx protege la vista 'configuraciones' ante modo kiosco",
    appTsx.includes("view === 'configuraciones' && (!isKioskLocked || isSupervisorUnlocked)")
  );

  assert(
    "AppContext.tsx implementa auto-relock por inactividad de 5 minutos",
    appContextTsx.includes("Supervisor session expired due to inactivity. Relocking kiosk.") &&
    appContextTsx.includes("5 * 60 * 1000")
  );

  assert(
    "AppContext.tsx expone setSupervisorInfo en AppContextType",
    appContextTsx.includes("setSupervisorInfo: (info: { id: number; username: string; role: string } | null) => void;")
  );

  // --- TEST 2: API Endpoints ---
  console.log("\n--- 2. Verificación de Endpoints de Servidor ---");

  try {
    // 2.1 Verify /api/settings/kiosk GET
    const kioskGet = await makeRequest('GET', '/api/settings/kiosk');
    assert(
      "GET /api/settings/kiosk responde 200 con { kiosk_mode: boolean }",
      kioskGet.statusCode === 200 && typeof kioskGet.data.kiosk_mode === 'boolean'
    );

    // 2.2 Verify /api/settings/kiosk POST without admin authorization returns 401 or 403
    const kioskPostUnauthorized = await makeRequest('POST', '/api/settings/kiosk', {}, { kiosk_mode: true });
    assert(
      "POST /api/settings/kiosk rechaza solicitudes sin rol admin/propietario (401/403)",
      kioskPostUnauthorized.statusCode === 401 || kioskPostUnauthorized.statusCode === 403
    );

    // 2.3 Verify /api/auth/verify-supervisor without password returns 400
    const verifyEmpty = await makeRequest('POST', '/api/auth/verify-supervisor', {}, {});
    assert(
      "POST /api/auth/verify-supervisor rechaza intento sin contraseña (400)",
      verifyEmpty.statusCode === 400
    );

    // 2.4 Verify /api/auth/verify-supervisor with invalid PIN returns 401
    const verifyBad = await makeRequest('POST', '/api/auth/verify-supervisor', {}, { password: 'incorrect_pin_9999999' });
    assert(
      "POST /api/auth/verify-supervisor rechaza PIN incorrecto (401)",
      verifyBad.statusCode === 401
    );

  } catch (err) {
    console.error("Error durante pruebas HTTP:", err.message);
    failed++;
  }

  console.log("\n==================================================");
  console.log(`TOTAL: ${passed + failed} | APROBADOS: ${passed} | FALLIDOS: ${failed}`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
