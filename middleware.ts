import NextAuth from "next-auth";
import { authConfig } from "./lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Protect all routes except for static assets, images, and API/auth routes
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
