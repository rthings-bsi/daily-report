export const GUDANG_PREFIX: Record<string, number> = {
  '5A': 1, '5B': 2, '5C': 3, '5D': 4,
  '5E': 5, '5F': 6, '5G': 7, '5H': 8,
  '5I': 9, '5J': 10, '5K': 11, '5L': 12,
  '5M': 13, '5N': 14,
};

/**
 * Static list of 14 gudangs. Used as a UI fallback (dropdowns, sidebars)
 * and to seed the Gudang DB table. The DB table is the source of truth at
 * runtime; this constant is the canonical static shape.
 */
export interface GudangInfo {
  gudangId: number;
  name: string;
  prefix: string;
}

export const GUDANG_LIST: GudangInfo[] = Array.from({ length: 14 }, (_, i) => ({
  gudangId: i + 1,
  name: `Gudang ${i + 1}`,
  prefix: '5' + String.fromCharCode(64 + (i + 1)),
}));

export const gudangFromSloc = (sloc: string | null): number | null => {
  if (!sloc) return null;
  const cached = gudangFromSlocCache.get(sloc);
  if (cached !== undefined) return cached;
  const prefix = sloc.toUpperCase().slice(0, 2);
  const result = GUDANG_PREFIX[prefix] || null;
  if (gudangFromSlocCache.size > MAX_CACHE_SIZE) gudangFromSlocCache.clear();
  gudangFromSlocCache.set(sloc, result);
  return result;
};
export const getGudangPrefix = (gudangNum: number): string => {
  if (gudangNum < 1 || gudangNum > 14) return '';
  return '5' + String.fromCharCode(64 + gudangNum);
};

// Cache: username → gudang. In a hot loop (filtering 10k+ rows) the same few
// usernames repeat constantly, so a Map lookup is ~100x cheaper than re-parsing.
const userGudangCache = new Map<string, number | null>();
const gudangFromSlocCache = new Map<string, number | null>();
const MAX_CACHE_SIZE = 10000;

const parseGudangDigits = (username: string): number | null => {
  // SAP user name format: GUDANG13C, GUDANG12A (digits + optional letter)
  // Session user name format: gudang13 (digits only)
  // Manual scan — no regex allocation on the hot path.
  const len = username.length;
  if (len < 6) return null;
  // Case-insensitive check that the string begins with "GUDANG"
  for (let i = 0; i < 6; i++) {
    const ch = username.charCodeAt(i);
    const upper = ch >= 97 && ch <= 122 ? ch - 32 : ch; // a-z → A-Z
    if (upper !== 'GUDANG'.charCodeAt(i)) return null;
  }
  // Collect digits after "GUDANG"
  let num = 0;
  let hasDigit = false;
  for (let i = 6; i < len; i++) {
    const ch = username.charCodeAt(i);
    if (ch >= 48 && ch <= 57) {
      num = num * 10 + (ch - 48);
      hasDigit = true;
    } else {
      break;
    }
  }
  if (!hasDigit) return null;
  return num >= 1 && num <= 14 ? num : null;
};

export const getUserGudang = (username: string | null | undefined): number | null => {
  if (!username) return null;
  const cached = userGudangCache.get(username);
  if (cached !== undefined) return cached;
  const result = parseGudangDigits(username);
  if (userGudangCache.size > MAX_CACHE_SIZE) userGudangCache.clear();
  userGudangCache.set(username, result);
  return result;
};

export const filterByGudang = <T extends { moveType?: string; storageLocation?: string | null; userName?: string | null }>(
  items: T[],
  gudangNum: number | null
): T[] => {
  if (!gudangNum) return items;
  const prefix = getGudangPrefix(gudangNum);
  if (!prefix) return items;
  return items.filter(item => {
    const userGudang = getUserGudang(item.userName);

    // 311 entries: show only lines that are valid TF Sloc In or Out for this gudang
    if (item.moveType === '311') {
      const sloc = (item.storageLocation || '').toUpperCase();
      const slocGudang = gudangFromSloc(sloc);
      
      const isFromThis = userGudang === gudangNum;
      const isToThis = slocGudang === gudangNum;
      const isExit = getSlocExitGudang(sloc) === gudangNum;

      // TF Sloc INTERNAL (user gudang ini tf dari sloc-nya sendiri ke sloc lain
      // di gudang yang sama). Kedua baris (+/-) harus LOLOS di sini agar nanti
      // bisa dipasangkan & dibuang oleh removeInternalTfSloc(). Kalau baris (+)
      // dibuang di sini, baris (-) tidak punya pasangan dan akan salah tampil
      // sebagai "TF Sloc Out".
      if (isFromThis && isToThis) return true;

      // Barang Keluar (TF Sloc Out) -> sloc milik gudang ini & qty negatif
      if (slocGudang === gudangNum && (item as any).quantity < 0) return true;

      // Barang Masuk (TF Sloc In) -> masuk ke SLOC Exit yang terdaftar di pengaturan gudang ini
      if ((item as any).quantity > 0 && isExit) return true;
      
      // Fallback untuk TF Sloc In: jika SlocExit kosong, tetapi barang dikirim oleh gudang lain masuk ke sloc milik gudang ini
      if ((item as any).quantity > 0 && isToThis && !isFromThis) return true;
      
      // Barang dikirim OLEH user gudang ini ke SLOC gudang lain (qty < 0).
      // User gudang ini yang melakukan MVT 311, jadi pastinya dia kirim barang ke luar sloc dia.
      // Skenario: Gudang 14 tf ke 5M16 (Gudang 13) menggunakan Sloc 5N19.
      if (isFromThis && (item as any).quantity < 0) return true;

      return false;
    }

    // For non-311:
    // Jika transaksi ini BUKTI nyata dilakukan oleh user gudang terkait, maka LOLOS.
    if (userGudang === gudangNum) return true;

    // Fallback: Jika username tidak terdeteksi, filter berdasarkan prefix SLOC
    const sloc = (item.storageLocation || '').toUpperCase();
    return sloc.startsWith(prefix);
  });
};

// const getSlocPrefix = (sloc?: string): string => (sloc || '').toUpperCase().slice(0, 2);

// ─── SLOC Exit Settings (per-gudang) ───
// Storage format: { "1": ["5A10","5A11"], "13": ["5M16"], ... }
export const SLOC_EXIT_STORAGE_KEY = 'warehouse_sloc_exit';

export const loadSlocExitMap = (): Record<number, string[]> => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(SLOC_EXIT_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    // Migrate old flat array format → per-gudang object
    if (Array.isArray(parsed)) {
      const map: Record<number, string[]> = {};
      for (const code of parsed) {
        const prefix = (code || '').toUpperCase().slice(0, 2);
        const gudang = GUDANG_PREFIX[prefix];
        if (gudang !== undefined) {
          if (!map[gudang]) map[gudang] = [];
          if (!map[gudang].includes(code)) map[gudang].push(code);
        }
      }
      localStorage.setItem(SLOC_EXIT_STORAGE_KEY, JSON.stringify(map));
      return map;
    }
    return parsed;
  } catch {
    return {};
  }
};

export const saveSlocExitMap = (map: Record<number, string[]>): void => {
  localStorage.setItem(SLOC_EXIT_STORAGE_KEY, JSON.stringify(map));
};

/** Check if a SLOC matches ANY gudang's exit list. */
export const isSlocExit = (sloc: string | null | undefined): boolean => {
  if (!sloc) return false;
  const map = typeof window !== 'undefined' ? loadSlocExitMap() : {};
  if (Array.isArray(map)) return false;
  const upper = sloc.toUpperCase();
  return Object.values(map).some(codes => Array.isArray(codes) && codes.some(c => c.toUpperCase() === upper));
};

/** Return the gudang number that owns this exit SLOC, or null. */
export const getSlocExitGudang = (sloc: string | null | undefined): number | null => {
  if (!sloc) return null;
  const map = typeof window !== 'undefined' ? loadSlocExitMap() : {};
  if (Array.isArray(map)) return null;
  const upper = sloc.toUpperCase();
  for (const [gudangStr, codes] of Object.entries(map)) {
    if (Array.isArray(codes) && codes.some(c => c.toUpperCase() === upper)) return Number(gudangStr);
  }
  return null;
};

/** Legacy flat list loader for backward compat */
export const loadSlocExitCodes = (): string[] => {
  const map = typeof window !== 'undefined' ? loadSlocExitMap() : {};
  if (Array.isArray(map)) return map;
  return Object.values(map).flat();
};

/** Re-klasifikasi 311 entries berdasarkan gudang yang dipilih */
export const reclassify311 = <T extends { moveType: string; description: string; group: string; storageLocation?: string; userName?: string; quantity?: number }>(
  items: T[],
  gudangNum: number | null
): T[] => {
  if (!gudangNum) return items;
  return items.map(m => {
    if (m.moveType !== '311') return m;
    const sloc = (m.storageLocation || '').toUpperCase();
    const slocGudang = gudangFromSloc(sloc);

    // TF Sloc Out: barang keluar dari sloc gudang ini (qty negatif),
    // ATAU user gudang ini tf ke luar tapi masuk ke SLOC Exit gudang lain (m.quantity < 0).
    // Tapi reclassify sudah jalan SETELAH filterByGudang, jadi yang masuk sini sudah terfilter untuk gudangNum.
    if ((slocGudang === gudangNum || getUserGudang(m.userName) === gudangNum) && m.quantity !== undefined && m.quantity < 0) {
      return { ...m, description: 'TF Sloc Out', group: 'Keluar' };
    }

    // TF Sloc In: barang MASUK ke SLOC Exit yang terdaftar di pengaturan gudang ini
    if (m.quantity !== undefined && m.quantity > 0 && getSlocExitGudang(sloc) === gudangNum) {
      return { ...m, description: 'TF Sloc In', group: 'Masuk' };
    }
    
    // Fallback: Jika barang MASUK ke sloc milik gudang ini (tapi BUKAN sloc exit) dan dikirim oleh user gudang lain, 
    // kita klasifikasikan sebagai 'TF Sloc In' biasa (non-exit) selama dia masuk (qty > 0) ke gudang ini.
    // Tapi sesuai rule saat ini (lihat baris 104 filterByGudang), TF In HANYA berlaku jika masuk ke Sloc Exit gudang ini.
    // Jadi baris yang tidak match rules di atas akan dihiraukan (hide/ignore).
    
    // Safety net: karena SlocExit map diload dari localStorage, ada kalanya dia kosong saat SSR.
    // Pastikan jika qty positif dan target sloc adalah milik gudang kita BUKAN dari user kita, kita hitung MASUK walau belum diset sloc exit.
    if (m.quantity !== undefined && m.quantity > 0 && slocGudang === gudangNum && getUserGudang(m.userName) !== gudangNum) {
      return { ...m, description: 'TF Sloc In', group: 'Masuk' };
    }
    
    return m;
  });
};

// ─── Sloc Penampungan ───
export const PENAMPUNGAN_STORAGE_KEY = 'warehouse_penampungan';

export const loadPenampunganSlocs = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(PENAMPUNGAN_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const savePenampunganSlocs = (slocs: string[]): void => {
  localStorage.setItem(PENAMPUNGAN_STORAGE_KEY, JSON.stringify(slocs));
};

export const isPenampunganSloc = (sloc: string | null | undefined): boolean => {
  if (!sloc) return false;
  const upper = sloc.trim().toUpperCase();
  const list = loadPenampunganSlocs();
  return list.some(s => s.toUpperCase() === upper);
};

export const removeInternalTfSloc = <T extends { moveType: string; quantity: number; storageLocation?: string; userName?: string; dateStr?: string; material?: string | null; batch?: string | null }>(
  allItems: T[]
): T[] => {
  const toRemove = new Set<T>();
  const cleanSloc = (sloc?: string): string => (sloc || '').trim().toUpperCase();

  const unpaired = new Map<string, T>();

  for (const m of allItems) {
    if (m.moveType !== '311') continue;
    const slocGudang = gudangFromSloc(cleanSloc(m.storageLocation));
    if (slocGudang === null) continue;

    const oppSign = Math.sign(m.quantity) === 1 ? '-' : '+';
    const absQty = Math.abs(m.quantity).toFixed(3);
    const date = m.dateStr || '';
    const mat = m.material || '';
    const batch = m.batch || '';

    const partnerKey = `${slocGudang}|${date}|${mat}|${batch}|${absQty}|${oppSign}`;

    if (unpaired.has(partnerKey)) {
      toRemove.add(unpaired.get(partnerKey)!);
      toRemove.add(m);
      unpaired.delete(partnerKey);
    } else {
      const mySign = Math.sign(m.quantity) === 1 ? '+' : '-';
      const myKey = `${slocGudang}|${date}|${mat}|${batch}|${absQty}|${mySign}`;
      unpaired.set(myKey, m);
    }
  }

  if (toRemove.size === 0) return allItems;
  return allItems.filter(m => !toRemove.has(m));
};

// ─── Batch Classification ───
export const classifyBatch = (batch: string): 'Fast' | 'Slow' | 'Unknown' => {
  if (!batch) return 'Unknown';
  const firstThree = batch.substring(0, 3);
  if (firstThree.length < 3) return 'Unknown';
  const yearYY = parseInt(firstThree.substring(1, 3), 10);
  if (isNaN(yearYY)) return 'Unknown';
  const currentYY = new Date().getFullYear() - 2000;
  return yearYY >= currentYY - 1 ? 'Fast' : 'Slow';
};
