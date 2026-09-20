const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

code = code.replace(
    'return originalFetch(input, init);',
    `return originalFetch(input, init).then(res => {
        if (res.status === 401 && !url.includes('/auth/login')) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.reload();
        }
        return res;
      });`
);
fs.writeFileSync('src/main.tsx', code);
