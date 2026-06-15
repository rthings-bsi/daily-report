import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "user";
      gudangId: number | null;
    } & DefaultSession["user"];
  }
  interface User {
    role?: "admin" | "user";
    gudangId?: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "admin" | "user";
    gudangId?: number | null;
  }
}
