const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldAuth = `  // Audit User Context Extraction Middleware
  app.use((req, res, next) => {
    const userId = req.headers['x-user-id'] || req.query.user_id || req.body?.user_id || req.body?.userId;
    const userName = req.headers['x-user-username'] || req.headers['x-user-name'] || req.query.user_name || req.body?.userName || req.body?.username;
    const userRole = req.headers['x-user-role'] || req.query.user_role || req.body?.user_role || req.body?.role;
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    (req as any).auditUser = {
      userId: userId ? parseInt(String(userId)) : null,
      userName: userName ? String(userName) : null,
      userRole: userRole ? String(userRole) : null,
      userAgent: typeof userAgent === 'string' ? userAgent : '',
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : String(ipAddress || ''),
    };

    next();
  });`;

const newAuth = `  // Audit User Context Extraction Middleware
  app.use((req, res, next) => {
    // SECURITY FIX: Verify JWT Token
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    let verifiedUser: any = null;
    let authError = null;
    
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        verifiedUser = jwt.verify(token, JWT_SECRET);
      } catch (e) {
        authError = e.message;
      }
    }

    const isPublicRoute = req.url.includes('/auth/login') || req.url.includes('/auth/recover-password') || req.url.includes('/app-version') || req.url.includes('/sync/status');
    
    if (req.url.startsWith('/api') && !isPublicRoute) {
      if (!verifiedUser) {
        return res.status(401).json({ error: 'No autorizado. Token inválido o ausente: ' + (authError || '') });
      }
      
      // Override headers with secure values from JWT to prevent spoofing
      req.headers['x-user-id'] = String(verifiedUser.id);
      req.headers['x-user-role'] = String(verifiedUser.role);
      req.headers['x-user-username'] = String(verifiedUser.username);
      if (verifiedUser.permissions) {
        req.headers['x-user-permissions'] = typeof verifiedUser.permissions === 'string' 
          ? verifiedUser.permissions 
          : JSON.stringify(verifiedUser.permissions);
      }
    }

    const userId = req.headers['x-user-id'] || req.query.user_id || req.body?.user_id || req.body?.userId;
    const userName = req.headers['x-user-username'] || req.headers['x-user-name'] || req.query.user_name || req.body?.userName || req.body?.username;
    const userRole = req.headers['x-user-role'] || req.query.user_role || req.body?.user_role || req.body?.role;
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    (req as any).auditUser = {
      userId: userId ? parseInt(String(userId)) : null,
      userName: userName ? String(userName) : null,
      userRole: userRole ? String(userRole) : null,
      userAgent: typeof userAgent === 'string' ? userAgent : '',
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : String(ipAddress || ''),
    };

    next();
  });`;

if (code.includes(oldAuth)) {
  code = code.replace(oldAuth, newAuth);
  fs.writeFileSync('server.ts', code);
  console.log("Successfully replaced auth middleware.");
} else {
  console.log("Could not find the old auth middleware block.");
}
