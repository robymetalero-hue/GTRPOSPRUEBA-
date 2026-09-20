const fs = require('fs');
let code = fs.readFileSync('src/views/AuditoriaView.tsx', 'utf8');

code = code.replace(
    'Auditoría Integral del Sistema POS GTR',
    'Registro de Actividad y Auditoría'
);

code = code.replace(
    'Trazabilidad inmutable criptográficamente protegida. Control total de acciones de usuarios, modificaciones, precios e inventario.',
    'Captura detallada de quién realizó cada cambio importante en el inventario, caja y acciones del sistema.'
);

fs.writeFileSync('src/views/AuditoriaView.tsx', code);
