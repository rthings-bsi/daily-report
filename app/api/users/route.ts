import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUserContext, respondError, ApiError } from "@/lib/api-helpers";

// GET /api/users — list all users (admin only)
export async function GET() {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        userId: true,
        username: true,
        role: true,
        gudangId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(users);
  } catch (err) {
    return respondError(err);
  }
}

// POST /api/users — create a new user (admin only)
export async function POST(req: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { username, password, role, gudangId } = body as {
      username?: string;
      password?: string;
      role?: "admin" | "user";
      gudangId?: number | null;
    };

    if (!username || !password) {
      throw new ApiError(400, "username dan password wajib diisi");
    }
    if (password.length < 6) {
      throw new ApiError(400, "Password minimal 6 karakter");
    }
    if (role !== "admin" && role !== "user") {
      throw new ApiError(400, "role harus 'admin' atau 'user'");
    }

    // Non-admin users MUST have a gudangId; admin MUST NOT.
    let resolvedGudangId: number | null = null;
    if (role === "user") {
      if (typeof gudangId !== "number" || gudangId < 1 || gudangId > 14) {
        throw new ApiError(400, "User (non-admin) harus punya gudangId 1-14");
      }
      resolvedGudangId = gudangId;
    } else {
      if (gudangId !== null && gudangId !== undefined) {
        throw new ApiError(400, "Admin tidak boleh terikat ke gudang");
      }
      resolvedGudangId = null;
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new ApiError(409, "Username sudah dipakai");
    }

    if (resolvedGudangId !== null) {
      const g = await prisma.gudang.findUnique({ where: { gudangId: resolvedGudangId } });
      if (!g) {
        // Fallback: auto-create the Gudang row if it's missing but valid 1-14
        // (Helps if migration seed didn't run properly)
        const prefix = '5' + String.fromCharCode(64 + resolvedGudangId);
        await prisma.gudang.create({
          data: { gudangId: resolvedGudangId, name: `Gudang ${resolvedGudangId}`, prefix }
        });
      }
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashed,
        role,
        gudangId: resolvedGudangId,
      },
      select: {
        userId: true,
        username: true,
        role: true,
        gudangId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return respondError(err);
  }
}
