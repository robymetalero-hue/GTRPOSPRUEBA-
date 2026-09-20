const fs = require('fs');
let content = fs.readFileSync('src/views/POS.tsx', 'utf8');

content = content.replace(
    /import React, \{ useState, useEffect, useRef \} from 'react';/,
    `import React, { useState, useEffect, useRef } from 'react';\nimport { filterAndRankProducts } from '../lib/searchUtils';`
);

const oldFilterLogic = `    const filtered = React.useMemo(() => {
        const query = debouncedSearch.toLowerCase().trim();
        const categoryFilter = selectedCategory;
        return products.filter(p => {
            let matchesCategory = false;
            if (categoryFilter === "Todos") {
                matchesCategory = true;
            } else if (categoryFilter === "⚠️ Bajo Stock") {
                matchesCategory = p.stock <= p.stock_alarm;
            } else {
                matchesCategory = p.category === categoryFilter;
            }
            let matchesSearch = true;
            if (query) {
                const searchTerms = query.split(/\\s+/);
                const searchableText = \`\${p.name} \${p.sku} \${p.category || ""}\`.toLowerCase();
                matchesSearch = searchTerms.every(term => searchableText.includes(term));
            }
            return matchesCategory && matchesSearch;
        });
    }, [products, debouncedSearch, selectedCategory]);`;

const newFilterLogic = `    const filtered = React.useMemo(() => {
        const query = debouncedSearch.toLowerCase().trim();
        const categoryFilter = selectedCategory;
        const categoryMatched = products.filter(p => {
            let matchesCategory = false;
            if (categoryFilter === "Todos") {
                matchesCategory = true;
            } else if (categoryFilter === "⚠️ Bajo Stock") {
                matchesCategory = p.stock <= p.stock_alarm;
            } else {
                matchesCategory = p.category === categoryFilter;
            }
            return matchesCategory;
        });
        
        return filterAndRankProducts(categoryMatched, query);
    }, [products, debouncedSearch, selectedCategory]);`;

content = content.replace(oldFilterLogic, newFilterLogic);

content = content.replace(
    /onEnter=\{\(val\) => \{\n                                    triggerVibrate\(10\);\n                                    setSearch\(val\);\n                                    setDebouncedSearch\(val\);\n                                \}\}/g,
    `onEnter={(val) => {
                                    triggerVibrate(10);
                                    setSearch(val);
                                    setDebouncedSearch(val);
                                    fetchProducts(val);
                                }}`
);

fs.writeFileSync('src/views/POS.tsx', content);
