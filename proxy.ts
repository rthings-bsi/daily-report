import { NextResponse } from "next/server";

export const proxy = async (req: any) => {
  return NextResponse.next();
};

export default proxy;

export const config = {
  // Protect all routes except static assets and setup/auth APIs
  matcher: ["/((?!api/setup|api/auth|_next/static|_next/image|favicon.ico).*)"],
};

