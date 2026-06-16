const fs = require('fs');

let content = fs.readFileSync('app/api/reports/route.ts', 'utf-8');

// 1. Add import for filterByGudang and getGudangPrefix
content = content.replace(
  /import \{ aggregateSessionData \} from "@\/lib\/aggregation";/,
  `import { aggregateSessionData } from "@/lib/aggregation";\nimport { filterByGudang, getGudangPrefix } from "@/lib/gudang";`
);

// 2. Add filtering logic before aggregateSessionData
const newPost = `
  try {
    let filteredMovements = movements;
    let filteredStocks = stocks;

    // Securely filter incoming data so users only save their own gudang's data
    if (!ctx.isAdmin && ctx.gudangId) {
      filteredMovements = filterByGudang(movements, ctx.gudangId);
      const prefix = getGudangPrefix(ctx.gudangId);
      filteredStocks = stocks.filter((s: any) => (s.sloc || '').toUpperCase().startsWith(prefix));
    }

    const {
      movementSummaries,
      stockSummaries,
      rawMovements,
      rawStocks,
      stats,
      stockCardsJson,
    } = aggregateSessionData({ 
      movements: filteredMovements, 
      stocks: filteredStocks, 
      stockCards 
    });`;

content = content.replace(
  /try \{\s*const \{\s*movementSummaries,\s*stockSummaries,\s*rawMovements,\s*rawStocks,\s*stats,\s*stockCardsJson,\s*\} = aggregateSessionData\(\{ movements, stocks, stockCards \}\);/,
  newPost
);

fs.writeFileSync('app/api/reports/route.ts', content);
console.log("File updated!");
