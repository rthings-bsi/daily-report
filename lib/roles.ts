export interface AppPermissionModule {
  id: string;
  name: string;
  category: 'Operasional' | 'Audit' | 'Upload' | 'Sistem';
  description: string;
}

export interface RoleConfigItem {
  id: string;
  roleId: string;
  name: string;
  description: string;
  color: string;
  isSystem: boolean;
  scope: 'global' | 'gudang';
  permissions: string[];
  userCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const APP_MODULES: AppPermissionModule[] = [
  { id: 'dashboard', name: 'Dashboard Gudang', category: 'Operasional', description: 'Monitoring tonase, stok, dan transaksi gudang' },
  { id: 'pipa-nc', name: 'Data Pipa NC', category: 'Operasional', description: 'Monitoring pipa non-conformance' },
  { id: 'repair-packing', name: 'Repair & Packing', category: 'Operasional', description: 'Monitoring transaksi GI/GR work center MP* dan REP*' },
  { id: 'audit-sloc', name: 'Audit SLoc', category: 'Audit', description: 'Audit stok fisik vs SAP dan upload data audit' },
  { id: 'upload', name: 'Upload SAP', category: 'Upload', description: 'Upload file MB51 & MC.9 harian' },
  { id: 'admin-users', name: 'Manajemen User', category: 'Sistem', description: 'Kelola akun pengguna, gudang, dan password' },
  { id: 'admin-roles', name: 'Konfigurasi Role', category: 'Sistem', description: 'Kelola konfigurasi role dan izin hak akses' },
  { id: 'settings', name: 'Pengaturan Gudang', category: 'Sistem', description: 'Konfigurasi kapasitas dan threshold gudang' },
];

export const DEFAULT_ROLES: Omit<RoleConfigItem, 'id' | 'createdAt' | 'updatedAt' | 'userCount'>[] = [
  {
    roleId: 'admin',
    name: 'Administrator',
    description: 'Akses penuh ke seluruh sistem tanpa batasan gudang',
    color: 'bg-rose-500',
    isSystem: true,
    scope: 'global',
    permissions: APP_MODULES.map((m) => m.id),
  },
  {
    roleId: 'user',
    name: 'Operator Gudang',
    description: 'Akses terikat ke 1 gudang PIC (Gudang 1–14)',
    color: 'bg-sky-500',
    isSystem: true,
    scope: 'gudang',
    permissions: ['dashboard', 'pipa-nc', 'repair-packing', 'audit-sloc', 'settings'],
  },
  {
    roleId: 'repair',
    name: 'Repair & Packing',
    description: 'Akses khusus monitoring dan operasional lini Repair & Packing',
    color: 'bg-indigo-500',
    isSystem: false,
    scope: 'global',
    permissions: ['repair-packing', 'pipa-nc', 'audit-sloc'],
  },
];
