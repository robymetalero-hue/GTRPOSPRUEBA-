const fs = require('fs');
let content = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

content = content.replace(
    /fetchProducts: \(\) => Promise<void>;/,
    "fetchProducts: (searchQuery?: string) => Promise<void>;"
);

content = content.replace(
    /const fetchProducts = async \(\) => {/,
    "const fetchProducts = async (searchQuery?: string) => {"
);

content = content.replace(
    /const res = await fetchWithRetry\(\`\/api\/products\?lazy=true&limit=\$\{PRODUCTS_LIMIT\}&offset=0\`\);/,
    `const url = searchQuery ? \`/api/products?lazy=true&limit=\${PRODUCTS_LIMIT}&offset=0&search=\${encodeURIComponent(searchQuery)}\` : \`/api/products?lazy=true&limit=\${PRODUCTS_LIMIT}&offset=0\`;
            const res = await fetchWithRetry(url);`
);

content = content.replace(
    /loadMoreProducts: \(\) => Promise<void>;/,
    "loadMoreProducts: (searchQuery?: string) => Promise<void>;"
);

content = content.replace(
    /const loadMoreProducts = async \(\) => {/,
    "const loadMoreProducts = async (searchQuery?: string) => {"
);

content = content.replace(
    /const res = await fetchWithRetry\(\`\/api\/products\?lazy=true&limit=\$\{PRODUCTS_LIMIT\}&offset=\$\{nextOffset\}\`\);/,
    `const url = searchQuery ? \`/api/products?lazy=true&limit=\${PRODUCTS_LIMIT}&offset=\${nextOffset}&search=\${encodeURIComponent(searchQuery)}\` : \`/api/products?lazy=true&limit=\${PRODUCTS_LIMIT}&offset=\${nextOffset}\`;
            const res = await fetchWithRetry(url);`
);

fs.writeFileSync('src/context/AppContext.tsx', content);
