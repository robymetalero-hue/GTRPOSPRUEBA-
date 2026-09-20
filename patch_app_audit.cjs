const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Desktop sidebar
code = code.replace(
    /\{renderNavItem\('auditoria',\s*'Auditoría',\s*History,\s*'view_inventory'\)\}/,
    '' // Remove from Inventario
);

code = code.replace(
    /\{renderNavItem\('cajas',\s*'Cajas & Ingresos',\s*Landmark,\s*'manage_caja'\)\}/,
    `{renderNavItem('cajas', 'Cajas & Ingresos', Landmark, 'manage_caja')}
                        {renderNavItem('auditoria', 'Registro de Actividad', History, 'view_audit')}` // Add to Admin
);

// Mobile sidebar
code = code.replace(
    /\{renderNavItem\('auditoria',\s*'Auditoría',\s*History,\s*'view_inventory'\)\}/,
    '' // Remove from Inventario
);

code = code.replace(
    /\{renderNavItem\('cajas',\s*'Cajas & Ingresos',\s*Landmark,\s*'manage_caja'\)\}/,
    `{renderNavItem('cajas', 'Cajas & Ingresos', Landmark, 'manage_caja')}
                                    {renderNavItem('auditoria', 'Registro de Actividad', History, 'view_audit')}` // Add to Admin
);

// Main view route
code = code.replace(
    /\{view === 'auditoria' && hasPermission\(user, 'view_inventory'\) && <AuditoriaView \/>\}/,
    `{view === 'auditoria' && hasPermission(user, 'view_audit') && <AuditoriaView />}`
);

fs.writeFileSync('src/App.tsx', code);
