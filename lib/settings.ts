import { prisma } from "./db";
import type { SapMovementType } from "./sap-mapping";

/**
 * Per-gudang settings shape. All fields are optional / default-empty.
 * Stored as JSON-encoded strings in `GudangSetting.value` keyed by `key`.
 */
export interface GudangSettings {
  mvt_overrides: Record<string, SapMovementType>;
  mvt_disabled: string[];
  wc_custom: Record<string, string>;
  wc_disabled: string[];
  sloc_exit: Record<string, string[]>; // serialized as string keys (JSON-safe)
  penampungan: string[];
  capacity: Record<string, number>;
}

export const SETTING_KEYS = [
  "mvt_overrides",
  "mvt_disabled",
  "wc_custom",
  "wc_disabled",
  "sloc_exit",
  "penampungan",
  "capacity",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export const DEFAULT_SETTINGS: GudangSettings = {
  mvt_overrides: {},
  mvt_disabled: [],
  wc_custom: {},
  wc_disabled: [],
  sloc_exit: {},
  penampungan: [],
  capacity: {},
};

/**
 * Load all settings for a gudang. Returns defaults for missing keys.
 */
export async function loadGudangSettings(gudangId: number): Promise<GudangSettings> {
  const rows = await prisma.gudangSetting.findMany({
    where: { gudangId },
  });

  const merged: GudangSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!SETTING_KEYS.includes(row.key as SettingKey)) continue;
    try {
      const parsed = JSON.parse(row.value);
      (merged as any)[row.key] = parsed;
    } catch {
      // skip malformed JSON — keep the default
    }
  }
  return merged;
}

/**
 * Upsert a single setting.
 */
export async function saveGudangSetting(
  gudangId: number,
  key: SettingKey,
  value: unknown,
): Promise<void> {
  await prisma.gudangSetting.upsert({
    where: { gudangId_key: { gudangId, key } },
    create: { gudangId, key, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
}

/**
 * Bulk upsert. Caller may include only the keys it wants to change.
 */
export async function saveGudangSettings(
  gudangId: number,
  partial: Partial<GudangSettings>,
): Promise<void> {
  await Promise.all(
    Object.entries(partial).map(([key, value]) =>
      saveGudangSetting(gudangId, key as SettingKey, value),
    ),
  );
}
