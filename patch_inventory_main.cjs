const fs = require('fs');
let content = fs.readFileSync('src/views/Inventory.tsx', 'utf8');

const oldFilterLogic1 = `        return products.filter(p => {
            let matchesCategory = false;
            if (cat === "Todos") {
                matchesCategory = true;
            } else if (cat === "⚠️ Bajo Stock") {
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
            if (cat === "Todos") {
                matchesCategory = true;
            } else if (cat === "⚠️ Bajo Stock") {
                matchesCategory = p.stock <= p.stock_alarm;
            } else {
                matchesCategory = (p.category || "General") === cat;
            }
            return matchesCategory;
        });
        return filterAndRankProducts(baseFiltered, query);`;

content = content.replace(oldFilterLogic1, newFilterLogic1);

if (!content.includes("import { filterAndRankProducts } from '../lib/searchUtils';")) {
    content = content.replace(
        /import React, \{ useState, useEffect, useRef \} from 'react';/,
        `import React, { useState, useEffect, useRef } from 'react';\nimport { filterAndRankProducts } from '../lib/searchUtils';`
    );
}

fs.writeFileSync('src/views/Inventory.tsx', content);
