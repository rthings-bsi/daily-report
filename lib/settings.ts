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
