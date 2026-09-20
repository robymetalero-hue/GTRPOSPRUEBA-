const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Add imports
if (!content.includes('import helmet')) {
    content = content.replace('import jwt from "jsonwebtoken";', 'import jwt from "jsonwebtoken";\nimport helmet from "helmet";\nimport rateLimit from "express-rate-limit";');
}

// Add helmet and rate limit
if (!content.includes('app.use(helmet')) {
    const expressInit = 'const app = express();';
    const securityMiddleware = `
  // SECURITY: Enable Helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // SECURITY: Rate Limiting for auth endpoints
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Demasiados intentos de inicio de sesión, inténtelo más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
`;
    content = content.replace(expressInit, expressInit + '\n' + securityMiddleware);
}

// Apply rate limit to login
if (!content.includes('app.post("/api/auth/login", loginLimiter')) {
    content = content.replace('app.post("/api/auth/login", (req, res) => {', 'app.post("/api/auth/login", loginLimiter, (req, res) => {');
}

// Add traceability middleware
if (!content.includes('// TRACEABILITY: Global API Modification Logger')) {
    const nextCall = '    next();\n  });';
    const traceability = `
  // TRACEABILITY: Global API Modification Logger
  app.use('/api', (req, res, next) => {
    const method = req.method;
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && !req.url.includes('/auth/login')) {
      const originalSend = res.send;
      let responseBody;
      res.send = function (body) {
        responseBody = body;
        return originalSend.call(this, body);
      };

      res.on('finish', () => {
        try {
          const auditUser = (req as any).auditUser;
          if (auditUser && auditUser.userId) {
            insertSystemAuditLog({
                event_type: 'SYSTEM_EVENT',
                category: 'SECURITY',
                module: 'API_ROUTER',
                action: \`\${method} \${req.url}\`,
                severity: res.statusCode >= 400 ? 'WARNING' : 'INFO',
                user_id: auditUser.userId,
                user_name: auditUser.userName,
                user_role: auditUser.userRole,
                reason: \`IP: \${auditUser.ipAddress}, Status: \${res.statusCode}\`,
                metadata: JSON.stringify({
                    url: req.originalUrl,
                    query: req.query,
                    statusCode: res.statusCode
                })
            });
          }
        } catch (e) {
          console.error('Error logging api traceability', e);
        }
      });
    }
    next();
  });
`;
    content = content.replace(nextCall, nextCall + '\n' + traceability);
}

fs.writeFileSync('server.ts', content);
