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
  const prefix = sloc.toUpperCase().slice(0, 2);
  return GUDANG_PREFIX[prefix] || null;
};

export const getGudangPrefix = (gudangNum: number): string => {
  if (gudangNum < 1 || gudangNum > 14) return '';
  return '5' + String.fromCharCode(64 + gudangNum);
};

export const getUserGudang = (username: string | null | undefined): number | null => {
  if (!username) return null;
  // SAP user name format: GUDANG13C, GUDANG12A (digits + optional letter)
  // Session user name format: gudang13 (digits only)
  const match = username.match(/^gudang(\d+)/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  return num >= 1 && num <= 14 ? num : null;
};

export const filterByGudang = <T extends { moveType?: string; storageLocation?: string; userName?: string }>(
  items: T[],
  gudangNum: number | null
): T[] => {
  if (!gudangNum) return items;
  const prefix = getGudangPrefix(gudangNum);
  if (!prefix) return items;
  return items.filter(item => {
    const userGudang = getUserGudang(item.userName);

    // 311 entries: show if related to this gudang (source or destination)
    if (item.moveType === '311') {
      const slocGudang = gudangFromSloc((item.storageLocation || '').toUpperCase());
      const isFromThis = userGudang === gudangNum;
      const isToThis = slocGudang === gudangNum;
      // Always show if either source or destination is this gudang
      if (isFromThis || isToThis) return true;
    }

    // For non-311:
    // Jika transaksi ini BUKTI nyata dilakukan oleh user gudang terkait, maka LOLOS.
    if (userGudang === gudangNum) return true;

    // Fallback: Jika username tidak terdeteksi, filter berdasarkan prefix SLOC
    const sloc = (item.storageLocation || '').toUpperCase();
    return sloc.startsWith(prefix);
  });
};

const getSlocPrefix = (sloc?: string): string => (sloc || '').toUpperCase().slice(0, 2);

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
  const map = loadSlocExitMap();
  if (Array.isArray(map)) return false;
  const upper = sloc.toUpperCase();
  return Object.values(map).some(codes => Array.isArray(codes) && codes.some(c => c.toUpperCase() === upper));
};

/** Return the gudang number that owns this exit SLOC, or null. */
export const getSlocExitGudang = (sloc: string | null | undefined): number | null => {
  if (!sloc) return null;
  const map = loadSlocExitMap();
  if (Array.isArray(map)) return null;
  const upper = sloc.toUpperCase();
  for (const [gudangStr, codes] of Object.entries(map)) {
    if (Array.isArray(codes) && codes.some(c => c.toUpperCase() === upper)) return Number(gudangStr);
  }
  return null;
};

/** Legacy flat list loader for backward compat */
export const loadSlocExitCodes = (): string[] => {
  const map = loadSlocExitMap();
  if (Array.isArray(map)) return map;
  return Object.values(map).flat();
};

/** Re-klasifikasi 311 entries berdasarkan gudang yang dipilih */
export const reclassify311 = <T extends { moveType: string; description: string; group: string; storageLocation?: string; userName?: string }>(
  items: T[],
  gudangNum: number | null
): T[] => {
  if (!gudangNum) return items;
  return items.map(m => {
    if (m.moveType !== '311') return m;
    const userGudang = getUserGudang(m.userName);
    const slocGudang = gudangFromSloc((m.storageLocation || '').toUpperCase());
    if (userGudang === gudangNum) {
      return { ...m, description: 'TF Sloc Out', group: 'Keluar' };
    }
    if (slocGudang === gudangNum) {
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

export const removeInternalTfSloc = <T extends { moveType: string; quantity: number; storageLocation?: string; userName?: string }>(
  allItems: T[]
): T[] => {
  const toRemove = new Set<T>();
  const cleanSloc = (sloc?: string): string => (sloc || '').trim().toUpperCase();

  // TF Sloc dalam gudang sendiri → jangan dihitung
  for (const m of allItems) {
    if (m.moveType !== '311') continue;
    const sloc = cleanSloc(m.storageLocation);
    if (!sloc) continue;
    const userGudang = getUserGudang(m.userName);
    const slocGudang = gudangFromSloc(sloc);
    if (userGudang !== null && slocGudang !== null && userGudang === slocGudang) {
      toRemove.add(m);
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
