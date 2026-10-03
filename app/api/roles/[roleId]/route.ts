import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUserContext, respondError, ApiError } from '@/lib/api-helpers';
import { APP_MODULES } from '@/lib/roles';

interface RouteContext {
  params: Promise<{ roleId: string }>;
}

// PATCH /api/roles/[roleId] — update role properties or permissions
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { roleId } = await params;
    const body = await req.json();
    const { name, description, color, scope, permissions } = body as {
      name?: string;
      description?: string;
      color?: string;
      scope?: 'global' | 'gudang';
      permissions?: string[];
    };

    const existing = await prisma.roleConfig.findUnique({
      where: { roleId },
    });
    if (!existing) {
      throw new ApiError(404, 'Role tidak ditemukan');
    }

    const data: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name.trim()) throw new ApiError(400, 'Nama role tidak boleh kosong');
      data.name = name.trim();
    }

    if (description !== undefined) {
      data.description = description.trim();
    }

    if (color !== undefined) {
      data.color = color;
    }

    if (scope !== undefined) {
      // Do not allow changing scope of built-in admin (always global)
      if (existing.roleId === 'admin' && scope !== 'global') {
        throw new ApiError(400, 'Role admin wajib memiliki scope global');
      }
      data.scope = scope;
    }

    if (permissions !== undefined) {
      const validModuleIds = new Set(APP_MODULES.map((m) => m.id));
      let safePerms = permissions.filter((p) => validModuleIds.has(p));
      // For built-in admin, ensure essential permissions are always preserved
      if (existing.roleId === 'admin') {
        const requiredAdminPerms = ['admin-roles', 'admin-users', 'dashboard'];
        for (const p of requiredAdminPerms) {
          if (!safePerms.includes(p)) safePerms.push(p);
        }
      }
      data.permissions = JSON.stringify(safePerms);
    }

    const updated = await prisma.roleConfig.update({
      where: { roleId },
      data,
    });

    let perms: string[] = [];
    try {
      perms = JSON.parse(updated.permissions);
    } catch {
      perms = [];
    }

    return NextResponse.json({
      ...updated,
      permissions: perms,
    });
  } catch (err) {
    return respondError(err);
  }
}

// DELETE /api/roles/[roleId] — delete custom role
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { roleId } = await params;

    const existing = await prisma.roleConfig.findUnique({
      where: { roleId },
    });
    if (!existing) {
      throw new ApiError(404, 'Role tidak ditemukan');
    }

    if (existing.isSystem || existing.roleId === 'admin' || existing.roleId === 'user') {
      throw new ApiError(400, 'Role sistem bawaan tidak dapat dihapus');
    }

    // Check if any users still have this role
    const assignedUserCount = await prisma.user.count({
      where: { role: roleId },
    });
    if (assignedUserCount > 0) {
      throw new ApiError(
        400,
        `Tidak dapat menghapus: terdapat ${assignedUserCount} user dengan role ini. Pindahkan user ke role lain terlebih dahulu.`
      );
    }

    await prisma.roleConfig.delete({
      where: { roleId },
    });

    return NextResponse.json({ ok: true, deletedRoleId: roleId });
  } catch (err) {
    return respondError(err);
  }
}
