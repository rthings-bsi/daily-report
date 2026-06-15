import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUserContext, respondError, ApiError } from "@/lib/api-helpers";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

// PATCH /api/users/[userId] — update user (admin only)
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { userId } = await params;

    // Normal users can only edit themselves
    if (!ctx.isAdmin && ctx.userId !== userId) {
      throw new ApiError(403, "Forbidden");
    }

    const body = await req.json();
    const { username, password, role, gudangId } = body as {
      username?: string;
      password?: string;
      role?: "admin" | "user";
      gudangId?: number | null;
    };

    // Normal users can ONLY update their password
    if (!ctx.isAdmin) {
      if (username !== undefined || role !== undefined || gudangId !== undefined) {
        throw new ApiError(403, "Hanya admin yang dapat mengubah profil ini");
      }
    }

    const existing = await prisma.user.findUnique({ where: { userId } });
    if (!existing) {
      throw new ApiError(404, "User tidak ditemukan");
    }

    // Prevent admin from demoting themselves (would lock them out)
    if (userId === ctx.userId && role && role !== "admin") {
      throw new ApiError(400, "Tidak bisa mengubah role Anda sendiri dari admin");
    }
    if (userId === ctx.userId && gudangId !== undefined && gudangId !== null) {
      throw new ApiError(400, "Admin tidak boleh terikat ke gudang");
    }

    const data: Record<string, unknown> = {};

    if (username !== undefined) {
      if (username !== existing.username) {
        const dup = await prisma.user.findUnique({ where: { username } });
        if (dup) throw new ApiError(409, "Username sudah dipakai");
      }
      data.username = username;
    }

    if (password !== undefined) {
      if (password.length < 6) {
        throw new ApiError(400, "Password minimal 6 karakter");
      }
      data.password = await bcrypt.hash(password, 12);
    }

    if (role !== undefined) {
      if (role !== "admin" && role !== "user") {
        throw new ApiError(400, "role harus 'admin' atau 'user'");
      }
      data.role = role;
    }

    if (gudangId !== undefined) {
      const finalRole = (data.role as string) ?? existing.role;
      if (finalRole === "user") {
        if (typeof gudangId !== "number" || gudangId < 1 || gudangId > 14) {
          throw new ApiError(400, "User (non-admin) harus punya gudangId 1-14");
        }
      } else {
        if (gudangId !== null) {
          throw new ApiError(400, "Admin tidak boleh terikat ke gudang");
        }
      }
      data.gudangId = gudangId;
    }

    const user = await prisma.user.update({
      where: { userId },
      data,
      select: {
        userId: true,
        username: true,
        role: true,
        gudangId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (err) {
    return respondError(err);
  }
}

// DELETE /api/users/[userId] — delete user (admin only, cannot self-delete)
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { userId } = await params;
    if (userId === ctx.userId) {
      throw new ApiError(400, "Tidak bisa menghapus akun sendiri");
    }
    await prisma.user.delete({ where: { userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondError(err);
  }
}
