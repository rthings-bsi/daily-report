import { auth } from "@/lib/auth";

export { auth as proxy, auth as default };

export const config = {
  matcher: ["/((?!api/setup|api/auth|_next/static|_next/image|favicon.ico).*)"],
};

