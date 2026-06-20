import { filterByGudang, removeInternalTfSloc, reclassify311 } from './lib/gudang';

// Simulasikan raw movements:
const raw = [
  { moveType: '101', description: 'GR Produksi', material: 'YABC', workCenter: 'WC1', batch: 'B1', quantity: 100, unitQuantity: 10, group: 'Masuk', color: 'green', userName: 'U1', storageLocation: '5A01', dateStr: '2026-06-20' }
];

const selectedGudang = null;
const filtered = raw; // selectedGudang is null

console.log("Filtered Length:", filtered.length);

const inboundMovements = filtered.filter(m => m.group === 'Masuk');
console.log("Inbound Length:", inboundMovements.length);
