import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserContext, respondError, ApiError } from "@/lib/api-helpers";

// DELETE /api/users/bulk — delete multiple users (admin only)
export async function DELETE(req: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userIds } = body as { userIds: string[] };

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new ApiError(400, "userIds array wajib disertakan dan tidak boleh kosong");
    }

    // Cegah admin menghapus dirinya sendiri dalam bulk delete
    if (userIds.includes(ctx.userId)) {
      throw new ApiError(400, "Tidak dapat menghapus akun Anda sendiri");
    }

    const result = await prisma.user.deleteMany({
      where: {
        userId: { in: userIds }
      }
    });

    return NextResponse.json({ message: "Berhasil menghapus pengguna", count: result.count });
  } catch (err) {
    return respondError(err);
  }
}