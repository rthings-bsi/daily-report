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
  '601': {
    code: '601',
    description: 'GI Delivery',
    group: 'Keluar',
    color: '#ec4899', // pink-500
  },
};

export const getMovementInfo = (code: string): SapMovementType => {
  return MOVEMENT_TYPES[code] || {
    code,
    description: `Unknown (${code})`,
    group: 'Transfer',
    color: '#94a3b8', // slate-400
  };
};
