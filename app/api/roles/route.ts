import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUserContext, respondError, ApiError } from '@/lib/api-helpers';
import { DEFAULT_ROLES, APP_MODULES } from '@/lib/roles';

export const dynamic = 'force-dynamic';

async function ensureDefaultRoles() {
  const count = await prisma.roleConfig.count();
  if (count === 0) {
    for (const r of DEFAULT_ROLES) {
      await prisma.roleConfig.upsert({
        where: { roleId: r.roleId },
        update: {},
        create: {
          roleId: r.roleId,
          name: r.name,
          description: r.description,
          color: r.color,
          isSystem: r.isSystem,
          scope: r.scope,
          permissions: JSON.stringify(r.permissions),
        },
      });
    }
  }
}

// GET /api/roles — list all roles with user count
export async function GET() {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensureDefaultRoles();

    const [roles, users] = await Promise.all([
      prisma.roleConfig.findMany({
        orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
      }),
      prisma.user.findMany({
        select: { role: true },
      }),
    ]);

    const userCountByRole = users.reduce((acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const result = roles.map((r) => {
      let perms: string[] = [];
      try {
        perms = JSON.parse(r.permissions);
      } catch {
        perms = [];
      }
      return {
        id: r.id,
        roleId: r.roleId,
        name: r.name,
        description: r.description || '',
        color: r.color || 'bg-slate-500',
        isSystem: r.isSystem,
        scope: r.scope as 'global' | 'gudang',
        permissions: perms,
        userCount: userCountByRole[r.roleId] || 0,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    return respondError(err);
  }
}

// POST /api/roles — create a new custom role
export async function POST(req: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { roleId, name, description, color, scope, permissions } = body as {
      roleId?: string;
      name?: string;
      description?: string;
      color?: string;
      scope?: 'global' | 'gudang';
      permissions?: string[];
    };

    if (!roleId || !name) {
      throw new ApiError(400, 'roleId dan name wajib diisi');
    }

    const cleanRoleId = roleId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    if (!cleanRoleId) {
      throw new ApiError(400, 'roleId tidak valid');
    }

    const existing = await prisma.roleConfig.findUnique({
      where: { roleId: cleanRoleId },
    });
    if (existing) {
      throw new ApiError(409, `Role ID "${cleanRoleId}" sudah digunakan`);
    }

    // Filter valid module permissions
    const validModuleIds = new Set(APP_MODULES.map((m) => m.id));
    const safePerms = Array.isArray(permissions)
      ? permissions.filter((p) => validModuleIds.has(p))
      : [];

    const newRole = await prisma.roleConfig.create({
      data: {
        roleId: cleanRoleId,
        name: name.trim(),
        description: description?.trim() || '',
        color: color || 'bg-indigo-500',
        isSystem: false,
        scope: scope === 'global' ? 'global' : 'gudang',
        permissions: JSON.stringify(safePerms),
      },
    });

    return NextResponse.json(
      {
        ...newRole,
        permissions: safePerms,
        userCount: 0,
      },
      { status: 201 }
    );
  } catch (err) {
    return respondError(err);
  }
}
