export type MovementGroup = 'Masuk' | 'Keluar' | 'Transfer';

export interface SapMovementType {
  code: string;
  description: string;
  group: MovementGroup;
  color: string;
}

export const MOVEMENT_TYPES: Record<string, SapMovementType> = {
  '101': {
    code: '101',
    description: 'GR Produksi',
    group: 'Masuk',
    color: '#22c55e', // green-500
  },
  '102': {
    code: '102',
    description: 'Return GR/Cancel',
    group: 'Keluar',
    color: '#ef4444', // red-500
  },
  '261': {
    code: '261',
    description: 'GI Produksi',
    group: 'Keluar',
    color: '#f97316', // orange-500
  },
  '262': {
    code: '262',
    description: 'Return Produksi',
    group: 'Masuk',
    color: '#3b82f6', // blue-500
  },
  '311': {
    code: '311',
    description: 'TF Sloc',
    group: 'Keluar',
    color: '#8b5cf6', // purple-500
  },
  '321': {
    code: '321',
    description: 'TF Plant Out',
    group: 'Keluar',
    color: '#a855f7', // purple-500
  },
  '322': {
    code: '322',
    description: 'TF Plant In',
    group: 'Masuk',
    color: '#a855f7', // purple-500
  },
  '551': {
    code: '551',
    description: 'Scrap',
    group: 'Keluar',
    color: '#dc2626', // red-600
  },
  '561': {
    code: '561',
    description: 'Initial Stock In',
    group: 'Masuk',
    color: '#16a34a', // green-600
  },
  '562': {
    code: '562',
    description: 'Initial Stock Out',
    group: 'Keluar',
    color: '#dc2626', // red-600
  },
  '601': {
    code: '601',
    description: 'GI Delivery',
    group: 'Keluar',
    color: '#ec4899', // pink-500
  },
};

export const MVT_STORAGE_KEY = 'warehouse_mvt_custom';
export const MVT_DISABLED_KEY = 'warehouse_mvt_disabled';
export const WC_STORAGE_KEY = 'warehouse_wc_custom';
export const WC_DISABLED_KEY = 'warehouse_wc_disabled';

export const loadCustomMovementTypes = (): Record<string, SapMovementType> => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(MVT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

export const saveCustomMovementTypes = (types: Record<string, SapMovementType>): void => {
  localStorage.setItem(MVT_STORAGE_KEY, JSON.stringify(types));
};

export const loadDisabledMvtCodes = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(MVT_DISABLED_KEY);
    return new Set<string>(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
};

export const saveDisabledMvtCodes = (codes: Set<string>): void => {
  localStorage.setItem(MVT_DISABLED_KEY, JSON.stringify(Array.from(codes)));
};

export const isMvtEnabled = (code: string): boolean => {
  return !loadDisabledMvtCodes().has(code);
};

export const filterEnabledMovements = <T extends { moveType: string }>(movements: T[]): T[] => {
  const disabled = loadDisabledMvtCodes();
  if (disabled.size === 0) return movements;
  return movements.filter(m => !disabled.has(m.moveType));
};

export const loadCustomWcNames = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(WC_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

export const saveCustomWcNames = (names: Record<string, string>): void => {
  localStorage.setItem(WC_STORAGE_KEY, JSON.stringify(names));
};

export const loadDisabledWcCodes = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(WC_DISABLED_KEY);
    return new Set<string>(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
};

export const saveDisabledWcCodes = (codes: Set<string>): void => {
  localStorage.setItem(WC_DISABLED_KEY, JSON.stringify(Array.from(codes)));
};

export const getWcDisplayName = (code: string): string => {
  const custom = loadCustomWcNames();
  return custom[code] || code;
};

export const isWcEnabled = (code: string): boolean => {
  return !loadDisabledWcCodes().has(code);
};

export const filterEnabledWorkCenters = <T extends { workCenter: string | null }>(movements: T[]): T[] => {
  const disabled = loadDisabledWcCodes();
  if (disabled.size === 0) return movements;
  return movements.filter(m => !disabled.has(m.workCenter || 'UNASSIGNED'));
};

export const getAllMovementTypes = (): Record<string, SapMovementType> => {
  return { ...MOVEMENT_TYPES, ...loadCustomMovementTypes() };
};

export const getMovementInfo = (code: string): SapMovementType => {
  return getAllMovementTypes()[code] || {
    code,
    description: `Unknown (${code})`,
    group: 'Transfer',
    color: '#94a3b8', // slate-400
  };
};
