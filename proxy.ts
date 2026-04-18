import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: handler } = NextAuth(authConfig);

export { handler as proxy, handler as default };

export const config = {
  // Protect all routes except static assets and setup/auth APIs
  matcher: ["/((?!api/setup|api/auth|_next/static|_next/image|favicon.ico).*)"],
};

