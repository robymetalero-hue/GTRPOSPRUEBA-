const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const originalSearchLogic = `      let countQuery = \`SELECT COUNT(*) as count FROM products\`;
      let queryStr = \`SELECT * FROM products\`;
      let conditions: string[] = [];
      let params: any[] = [];

      if (search) {
        conditions.push(\` (name LIKE ? OR sku LIKE ? OR category LIKE ?) \`);
        const wild = \`%\${search}%\`;
        params.push(wild, wild, wild);
      }

      if (conditions.length > 0) {
        const condStr = \` WHERE \` + conditions.join(' AND ');
        queryStr += condStr;
        countQuery += condStr;
      }

      queryStr += \` ORDER BY id DESC \`;`;

const newSearchLogic = `      let countQuery = \`SELECT COUNT(*) as count FROM products\`;
      let queryStr = \`SELECT * FROM products\`;
      let conditions: string[] = [];
      let whereParams: any[] = [];
      let orderByStr = \` ORDER BY id DESC \`;
      let orderParams: any[] = [];

      if (search) {
        const s = search.toLowerCase();
        const searchTerms = s.split(/\\s+/).filter(w => w.length > 0);
        
        if (searchTerms.length > 0) {
            const termConditions = searchTerms.map(() => \`(LOWER(name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(category) LIKE ?)\`);
            conditions.push(\`(\${termConditions.join(' AND ')})\`);
            
            for (const term of searchTerms) {
                whereParams.push(\`%\${term}%\`, \`%\${term}%\`, \`%\${term}%\`);
            }
            
            orderByStr = \` ORDER BY 
                CASE 
                    WHEN LOWER(sku) = ? THEN 1000
                    WHEN LOWER(name) = ? THEN 900
                    WHEN LOWER(name) LIKE ? THEN 700
                    WHEN LOWER(name) LIKE ? THEN 600
                    ELSE 100
                END DESC, id DESC \`;
            orderParams.push(s, s, \`\${s}%\`, \`% \${s}%\`);
        }
      }

      if (conditions.length > 0) {
        const condStr = \` WHERE \` + conditions.join(' AND ');
        queryStr += condStr;
        countQuery += condStr;
      }

      queryStr += orderByStr;
      let allParams = [...whereParams];
      if (search) {
          allParams = [...allParams, ...orderParams];
      }`;

content = content.replace(originalSearchLogic, newSearchLogic);

content = content.replace(
    /const countParams = \[\.\.\.params\];/g,
    "const countParams = [...whereParams];"
);
content = content.replace(
    /queryStr \+\= \` LIMIT \? OFFSET \? \`;\n        params\.push\(limit\, offset\);/g,
    `queryStr += \` LIMIT ? OFFSET ? \`;\n        allParams.push(limit, offset);`
);
content = content.replace(
    /let products = db\.prepare\(queryStr\)\.all\(\.\.\.params\) as any\[\];/g,
    "let products = db.prepare(queryStr).all(...allParams) as any[];"
);

fs.writeFileSync('server.ts', content);
