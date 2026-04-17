import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const proxy = NextAuth(authConfig).auth;

export const config = {
  // Protect all routes except static assets
  matcher: ["/((?!api/setup|_next/static|_next/image|favicon.ico).*)"],
};
