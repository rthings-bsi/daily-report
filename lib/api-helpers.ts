import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export interface UserContext {
  userId: string;
  username: string;
  role: "admin" | "user";
  gudangId: number | null;
  isAdmin: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Resolve the current request's user context.
 * Returns a 401 NextResponse if the caller is not authenticated.
 *
 * Usage:
 *   const ctx = await requireUserContext();
 *   if (ctx instanceof NextResponse) return ctx;
 */
export async function requireUserContext(): Promise<UserContext | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return {
    userId: session.user.id,
    username: session.user.name ?? "",
    role: session.user.role,
    gudangId: session.user.gudangId ?? null,
    isAdmin: session.user.role === "admin",
  };
}

/**
 * Build a Prisma `where` filter that scopes by the caller's gudang.
 * Admins get the unfiltered `extra`; non-admins get `gudangId` pinned
 * (or `gudangId: null` allowed for admin-only data — caller decides).
 */
export function buildGudangWhere(
  ctx: UserContext,
  extra?: Record<string, unknown>,
  options?: { includeNull?: boolean },
): Record<string, unknown> {
  if (ctx.isAdmin) return extra ?? {};
  const base: Record<string, unknown> = { ...(extra ?? {}) };
  if (options?.includeNull) {
    base.gudangId = ctx.gudangId === null ? null : { in: [ctx.gudangId] };
    // For non-admin: own gudangId OR null (legacy unscoped) — but only if ctx.gudangId is set
    if (ctx.gudangId !== null) {
      delete base.gudangId;
      base.OR = [
        { gudangId: ctx.gudangId },
        { gudangId: null }
      ];
    } else {
      base.gudangId = null;
    }
  } else {
    base.gudangId = ctx.gudangId;
  }
  return base;
}

/**
 * Confirm the calling user is allowed to read/write the given ReportSession.
 * Throws ApiError(404) — not 403, to avoid leaking resource existence.
 * No-op for admin.
 */
export async function assertOwnsSession(
  ctx: UserContext,
  reportSessionId: string,
): Promise<void> {
  if (ctx.isAdmin) return;
  const s = await prisma.reportSession.findUnique({
    where: { reportSessionId },
    select: { gudangId: true },
  });
  if (!s) throw new ApiError(404, "Not found");
  // Non-admin can ONLY access sessions explicitly tagged with their gudangId
  if (s.gudangId !== ctx.gudangId) {
    throw new ApiError(404, "Not found");
  }
}

/**
 * Resolve the gudang id the caller should use for filtering/creation.
 * Admin with no gudangId → returns null (caller decides fallback).
 * Non-admin → returns ctx.gudangId.
 */
export function effectiveGudangId(
  ctx: UserContext,
  fallback: number | null = null,
): number | null {
  if (ctx.gudangId !== null) return ctx.gudangId;
  return ctx.isAdmin ? fallback : null;
}

/**
 * Standard error responder for API routes. Maps ApiError to its status;
 * any other error becomes a 500.
 */
export function respondError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[api] unexpected error:", err);
  const msg = err instanceof Error ? err.message : "Internal server error";
  return NextResponse.json({ error: msg }, { status: 500 });
}
