import { auth } from "@/lib/auth";
import { updateSession } from "./utils/supabase/middleware";

const handler = auth(async (req) => {
  // Only update Supabase session for non-auth and non-static routes
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");
  const isStaticRoute = req.nextUrl.pathname.startsWith("/_next") || req.nextUrl.pathname.includes(".");
  
  if (!isAuthRoute && !isStaticRoute) {
    await updateSession(req);
  }
});

export { handler as default, handler as proxy };

export const config = {
  // Protect all routes except static assets and setup/auth APIs
  matcher: ["/((?!api/setup|api/auth|_next/static|_next/image|favicon.ico).*)"],
};

