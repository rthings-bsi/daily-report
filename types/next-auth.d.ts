import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      gudangId: number | null;
      permissions: string[];
      roleScope?: 'global' | 'gudang' | 'merger';
      mergerGudangIds?: number[];
    } & DefaultSession["user"];
  }
  interface User {
    role?: string;
    gudangId?: number | null;
    permissions?: string[];
    roleScope?: 'global' | 'gudang' | 'merger';
    mergerGudangIds?: number[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    gudangId?: number | null;
    permissions?: string[];
    roleScope?: 'global' | 'gudang' | 'merger';
    mergerGudangIds?: number[];
  }
}
