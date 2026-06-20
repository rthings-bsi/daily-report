const XLSX = require('xlsx');

const path = "C:/Users/Admin/AppData/Local/hermes/cache/documents/doc_548074a42315_20.06.2026.xlsx";
const wb = XLSX.readFile(path);
const wsName = wb.SheetNames[0];
const ws = wb.Sheets[wsName];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

let headerRow = -1;
for (let i=0; i<Math.min(10, data.length); i++) {
   if (data[i] && Array.isArray(data[i]) && data[i].join('').toLowerCase().includes('material')) {
       console.log(`Found headers at row ${i}:`, data[i]);
       headerRow = i;
       break;
   }
}

if (headerRow >= 0 && data.length > headerRow + 1) {
   const dataObj = XLSX.utils.sheet_to_json(ws, { range: headerRow });
   console.log("Parsed first row:", dataObj[0]);
}

