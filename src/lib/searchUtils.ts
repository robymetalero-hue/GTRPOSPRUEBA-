export function normalizeSearchText(text: string): string {
    if (!text) return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function calculateSearchScore(product: any, query: string): number {
    let score = 0;
    const cleanQuery = query.replace(/^#/, '').trim();
    const q = normalizeSearchText(cleanQuery);
    if (!q) return 0;
    
    const idStr = String(product.id || "");
    const name = normalizeSearchText(product.name || "");
    const sku = normalizeSearchText(product.sku || "");
    const barcode = normalizeSearchText(product.barcode || "");
    
    const queryTerms = q.split(" ").filter(Boolean);
    const nameWords = name.split(" ");
    
    if (idStr === q) {
        score += 1100;
    } else if (sku === q || barcode === q) {
        score += 1000;
    } else if (sku.startsWith(q) || barcode.startsWith(q)) {
        score += 800;
    }
    
    if (name === q) {
        score += 900;
    } else if (name.startsWith(q)) {
        score += 700;
    }
    
    if (nameWords.some(word => word.startsWith(q))) {
        score += 600;
    }
    
    if (queryTerms.length > 1) {
        if (queryTerms.every(term => name.includes(term) || sku.includes(term) || idStr.includes(term))) {
            score += 500;
        }
    } else {
        if (nameWords.includes(q)) {
            score += 500;
        } else if (name.includes(q)) {
            score += 100;
        } else if (sku.includes(q) || idStr.includes(q)) {
            score += 100;
        }
    }
    
    return score;
}

export function filterAndRankProducts<T extends Record<string, any>>(products: T[], query: string): T[] {
    if (!query || !query.trim()) return products;
    
    const cleanQuery = query.replace(/^#/, '').trim();
    const q = normalizeSearchText(cleanQuery);
    const searchTerms = q.split(" ").filter(Boolean);
    if (searchTerms.length === 0) return products;
    
    const filtered = products.filter(p => {
        const idStr = String(p.id || "");
        const searchableText = `${idStr} ${normalizeSearchText(p.name)} ${normalizeSearchText(p.sku || "")} ${normalizeSearchText(p.barcode || "")} ${normalizeSearchText(p.category || "")}`;
        return searchTerms.every(term => searchableText.includes(term));
    });
    
    return filtered.sort((a, b) => {
        return calculateSearchScore(b, query) - calculateSearchScore(a, query);
    });
}
