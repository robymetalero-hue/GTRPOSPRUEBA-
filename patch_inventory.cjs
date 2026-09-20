const fs = require('fs');
let content = fs.readFileSync('src/views/Inventory.tsx', 'utf8');

content = content.replace(
    /import React, \{ useState, useEffect, useRef \} from 'react';/,
    `import React, { useState, useEffect, useRef } from 'react';\nimport { filterAndRankProducts } from '../lib/searchUtils';`
);

const oldFilterLogic1 = `        return products.filter(p => {
            let matchesCategory = false;
            if (categoryFilter === "Todos") {
                matchesCategory = true;
            } else if (categoryFilter === "⚠️ Bajo Stock") {
                matchesCategory = p.stock <= p.stock_alarm;
            } else {
                matchesCategory = (p.category || "General") === cat;
            }
            let matchesSearch = true;
            if (query) {
                const searchTerms = query.split(/\\s+/);
                const searchableText = \`\${p.name} \${p.sku} \${p.category || ""}\`.toLowerCase();
                matchesSearch = searchTerms.every(term => searchableText.includes(term));
            }
            return matchesCategory && matchesSearch;
        });`;

const newFilterLogic1 = `        const baseFiltered = products.filter(p => {
            let matchesCategory = false;
            if (categoryFilter === "Todos") {
                matchesCategory = true;
            } else if (categoryFilter === "⚠️ Bajo Stock") {
                matchesCategory = p.stock <= p.stock_alarm;
            } else {
                matchesCategory = (p.category || "General") === cat;
            }
            return matchesCategory;
        });
        return filterAndRankProducts(baseFiltered, query);`;

content = content.replace(oldFilterLogic1, newFilterLogic1);


const oldFilterLogic2 = `                                                {products
                                                    .filter(p => {
                                                        const query = stockInSearch.toLowerCase().trim();
                                                        if (!query) return true;
                                                        const searchTerms = query.split(/\\s+/);
                                                        const searchableText = \`\${p.name} \${p.sku} \${p.category || ""}\`.toLowerCase();
                                                        return searchTerms.every(term => searchableText.includes(term));
                                                    })`;

const newFilterLogic2 = `                                                {filterAndRankProducts(products, stockInSearch)`;

content = content.replace(oldFilterLogic2, newFilterLogic2);

const oldFilterLogic3 = `                                                {products.filter(p => {
                                                    const query = stockInSearch.toLowerCase().trim();
                                                    if (!query) return true;
                                                    const searchTerms = query.split(/\\s+/);
                                                    const searchableText = \`\${p.name} \${p.sku} \${p.category || ""}\`.toLowerCase();
                                                    return searchTerms.every(term => searchableText.includes(term));
                                                }).length === 0 && (`;

const newFilterLogic3 = `                                                {filterAndRankProducts(products, stockInSearch).length === 0 && (`;

content = content.replace(oldFilterLogic3, newFilterLogic3);

// add fetchProducts trigger to InventorySearchInput onEnter
content = content.replace(
    /onEnter=\{\(val\) => \{\n                        setSearchQuery\(val\);\n                        setDebouncedSearchQuery\(val\);\n                    \}\}/,
    `onEnter={(val) => {
                        setSearchQuery(val);
                        setDebouncedSearchQuery(val);
                        fetchProducts(val);
                    }}`
);


fs.writeFileSync('src/views/Inventory.tsx', content);
