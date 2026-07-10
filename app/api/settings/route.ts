import { NextRequest, NextResponse } from "next/server";
import { requireUserContext, respondError } from "@/lib/api-helpers";
import {
  loadGudangSettings,
  saveGudangSettings,
  SETTING_KEYS,
  type GudangSettings,
} from "@/lib/settings";

// GET /api/settings — load all settings for the caller's gudang
// Admin can pass `?gudangId=N` to read any gudang's settings.
export async function GET(req: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const { searchParams } = new URL(req.url);
    const requestedGudangId = searchParams.get("gudangId");

    // Non-admin is locked to their own gudang (or 400 if they have none).
    const gudangId = ctx.isAdmin
      ? requestedGudangId
        ? Number(requestedGudangId)
        : ctx.gudangId
      : ctx.gudangId;

    if (gudangId === null || gudangId === undefined || Number.isNaN(gudangId)) {
      return NextResponse.json(
        { error: "No gudang context" },
        { status: 400 },
      );
    }

    const settings = await loadGudangSettings(gudangId);
    return NextResponse.json(settings);
  } catch (err) {
    return respondError(err);
  }
}

// PUT /api/settings — bulk upsert for the caller's gudang
// Admin can pass `gudangId` in the body to write any gudang's settings.
export async function PUT(req: NextRequest) {
  const ctx = await requireUserContext();
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const { gudangId: requestedGudangId, ...rest } = body as {
      gudangId?: number;
    } & Partial<GudangSettings>;

    const gudangId = ctx.isAdmin
      ? (requestedGudangId ?? ctx.gudangId)
      : ctx.gudangId;

    if (gudangId === null || gudangId === undefined || Number.isNaN(gudangId)) {
      return NextResponse.json(
        { error: "No gudang context" },
        { status: 400 },
      );
    }

    // Filter to only known keys
    const filtered: Partial<GudangSettings> = {};
    for (const key of SETTING_KEYS) {
      if (key in rest) (filtered as any)[key] = (rest as any)[key];
    }

    await saveGudangSettings(gudangId, filtered);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondError(err);
  }
}
