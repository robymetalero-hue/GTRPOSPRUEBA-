# Modo Kiosco y Seguridad V2 (Sin Regresiones)

Implementación y endurecimiento de la seguridad del Modo Kiosco (V2) en GTR POS, garantizando que el personal de caja opere en un entorno blindado sin acceso a configuraciones, inventarios ni reportes sensibles sin autorización de supervisor, al tiempo que se protege absolutamente el motor de ventas offline, los datos locales en SQLite e IndexedDB, y la estabilidad general de la aplicación.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones Confirmadas:**
> - **Suministro del parche:** Implementación directa de las mejoras de seguridad estandarizadas de Kiosco V2 en el código fuente.
> - **Prioridad Absoluta:** Cero regresiones en ventas, inventarios, transacciones pendientes y sincronización de datos locales/offline.
> - **Acceso Restringido:** Vendedores bajo modo Kiosco solo pueden acceder a Punto de Venta (`pos`), Gestión de Caja (`cajas`), Ventas del Día (`historial_ventas`) y Conteo Físico asignado (`conteo_fisico`). Cualquier navegación no autorizada es rechazada y redirigida inmediatamente al POS.
> - **Desbloqueo Seguro por Supervisor:** La elevación de privilegios requiere validación criptográfica en `/api/auth/verify-supervisor`, con re-bloqueo manual y temporizador de expiración de sesión de supervisión para evitar terminales desatendidas.

## 1. Overview & Core Concept

- **Qué hace:** Establece una barrera de seguridad de grado comercial en terminales de Punto de Venta. Cuando el Modo Kiosco está activo o un vendedor sin permisos administrativos inicia sesión, la interfaz bloquea el acceso a rutas administrativas, previene el cierre no autorizado del terminal, inhabilita atajos o URLs arbitrarias y exige autorización de supervisor (PIN/clave) para operaciones críticas.
- **Audiencia objetivo:** Cajeros y vendedores en tiendas físicas operando terminales táctiles o de mostrador, donde el propietario o administrador necesita delegar la atención al cliente sin arriesgar la alteración de precios, reportes ni configuraciones del sistema.
- **Valor clave:** Operación ágil y fluida para el cajero con blindaje total frente a manipulaciones accidentales o intencionadas, sin interrumpir jamás las ventas ni la disponibilidad offline.

## 2. User Experience & Visual Design

- **Vistas Permitidas en Modo Kiosco Bloqueado:**
  1. `pos` (Punto de Venta / Carrito / Cobro)
  2. `cajas` (Apertura de turno, movimientos de caja menor y arqueo ciego)
  3. `historial_ventas` (Consulta de recibos y reimpresión de tickets del turno)
  4. `conteo_fisico` (Toma de inventario físico asignado)

- **Experiencia de Desbloqueo y Supervisión:**
  - Botón táctil con icono de escudo en cabecera y barra inferior para solicitar autorización de supervisor.
  - Modal táctil flotante con teclado virtual / campo para PIN o contraseña de administrador.
  - Indicador flotante superior ámbar cuando la terminal está temporalmente desbloqueada, mostrando el nombre del supervisor activo y botón de "Bloquear de inmediato".
  - Temporizador de re-bloqueo automático tras 5 minutos de inactividad de supervisión para evitar descuidos en el mostrador.

- **Diseño Visual & Restricciones:**
  - Menú lateral y barra inferior adaptados para ocultar cualquier botón de configuración, inventario general, auditoría forense o gestión de usuarios.
  - Redirección silenciosa y segura si una acción intenta cargar una vista no autorizada.

## 3. Key Product Decisions & Trade-Offs

- **Decisión 1: Control de Rutas Client-Side Activo (Route Guard):**
  - *Enfoque:* Si `isKioskLocked` está activo y el estado `view` cambia a una vista restringida (`configuraciones`, `reportes`, `usuarios`, `inventario`, etc.), un efecto reactivo reasigna de inmediato `view = 'pos'` y emite una alerta no intrusiva.
  - *Por qué:* Evita que modificaciones de URL, atajos de teclado o botones contextuales permitan eludir el bloqueo de Kiosco.

- **Decisión 2: Protección de Datos y Cero Regresiones Offline:**
  - *Enfoque:* Ninguna tabla de base de datos ni clave de almacenamiento (`offline_sales_queue`, `products`, `clients`) es modificada o reseteada.
  - *Por qué:* Mantiene intactas las ventas en curso y la integridad transaccional local.

- **Decisión 3: Suite de Verificación Automatizada (`tests/check_kiosk_v2.cjs`):**
  - *Enfoque:* Creación de un script ejecutable que evalúe rigurosamente:
    - Permisos en `/api/settings/kiosk` (solo admin/propietario pueden modificarlo).
    - Endpoint `/api/auth/verify-supervisor` (autenticación estricta sin filtrar hashes).
    - Registro de auditoría en la tabla `system_audit_logs`.
  - *Por qué:* Permite validar el cumplimiento de la especificación V2 sin depender de clics manuales.

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   GTR POS Interface                    │
├──────────────────────────┬─────────────────────────────┤
│   Modo Normal (Admin)    │   Modo Kiosco V2 (Cajero)   │
│   • Acceso Total         │   • POS / Venta Rápida      │
│   • Configuraciones      │   • Mi Caja (Arqueo)        │
│   • Inventario & Costos  │   • Mis Ventas de Hoy       │
│   • Auditoría & Reportes │   • Conteo Físico           │
└────────────┬─────────────┴──────────────┬──────────────┘
             │                            │
             ▼                            ▼
┌────────────────────────────────────────────────────────┐
│             Kiosk Route Guard & Enforcer               │
│  (Intercepción reactiva de vistas no autorizadas)       │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌──────────────────────────┐┌────────────────────────────┐
│   Supervisor Auth API    ││   Storage & Cache Engine   │
│  /api/auth/verify-       ││  • IndexedDB / SQLite      │
│   supervisor (Argon2id)  ││  • offline_sales_queue     │
│  • Auto-relock 5 min     ││  • Cero regresiones        │
└──────────────────────────┘└────────────────────────────┘
```

- **Mapeo de Componentes & Manejadores:**
  - `src/App.tsx`: Actualización del Route Guard para `isKioskLocked`, corrección del botón salir en `kioskSidebarContent` para que ejecute logout seguro y temporizador de auto-bloqueo de supervisión. (Completado)
  - `src/context/AppContext.tsx`: Gestión centralizada de `isSupervisorUnlocked`, temporizador de inactividad de 5 minutos (`relockKiosk`) y exposición de `setSupervisorInfo`. (Completado)
  - `server.ts`: Verificación de seguridad en `/api/auth/verify-supervisor` y `/api/settings/kiosk`. (Completado)
  - `tests/check_kiosk_v2.cjs`: Suite de pruebas automatizadas ejecutada con éxito (11/11 tests aprobados). (Completado)

## Estado de Verificación
- **Pruebas Automatizadas:** 11/11 aprobadas (`tests/check_kiosk_v2.cjs`).
- **Compilación TypeScript:** Sin errores (`compile_applet` aprobado).
- **Linter:** Sin errores (`lint_applet` aprobado).
- **Cero Regresiones:** El flujo de ventas, carrito, offline, e impresión se mantienen completamente intactos.
