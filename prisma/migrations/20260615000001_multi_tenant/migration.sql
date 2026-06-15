-- Multi-tenant refactor: add Gudang, GudangSetting, gudangId FK to User & ReportSession
-- Run this against production via DIRECT_URL before deploying the app code.

-- 1) Create Gudang table
CREATE TABLE "Gudang" (
  "gudangId"  INTEGER NOT NULL,
  "name"      TEXT    NOT NULL,
  "prefix"    TEXT    NOT NULL,
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("gudangId")
);

-- 2) Seed 14 gudangs
INSERT INTO "Gudang" ("gudangId", "name", "prefix") VALUES
  (1,  'Gudang 1',  '5A'),
  (2,  'Gudang 2',  '5B'),
  (3,  'Gudang 3',  '5C'),
  (4,  'Gudang 4',  '5D'),
  (5,  'Gudang 5',  '5E'),
  (6,  'Gudang 6',  '5F'),
  (7,  'Gudang 7',  '5G'),
  (8,  'Gudang 8',  '5H'),
  (9,  'Gudang 9',  '5I'),
  (10, 'Gudang 10', '5J'),
  (11, 'Gudang 11', '5K'),
  (12, 'Gudang 12', '5L'),
  (13, 'Gudang 13', '5M'),
  (14, 'Gudang 14', '5N');

-- 3) Add gudangId to User (nullable for admin)
ALTER TABLE "User" ADD COLUMN "gudangId" INTEGER REFERENCES "Gudang"("gudangId");
CREATE INDEX "User_gudangId_idx" ON "User"("gudangId");

-- 4) Add gudangId to ReportSession (nullable for legacy data)
ALTER TABLE "ReportSession" ADD COLUMN "gudangId" INTEGER REFERENCES "Gudang"("gudangId");
CREATE INDEX "ReportSession_gudangId_idx" ON "ReportSession"("gudangId");

-- 5) Backfill existing sessions: stamp with gudang 1 (default; admin can reassign later)
UPDATE "ReportSession" SET "gudangId" = 1 WHERE "gudangId" IS NULL;

-- 6) Create GudangSetting table
CREATE TABLE "GudangSetting" (
  "settingId" TEXT NOT NULL,
  "gudangId"  INTEGER NOT NULL REFERENCES "Gudang"("gudangId") ON DELETE CASCADE,
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("settingId")
);
CREATE UNIQUE INDEX "GudangSetting_gudangId_key_key" ON "GudangSetting"("gudangId", "key");
CREATE INDEX "GudangSetting_gudangId_idx" ON "GudangSetting"("gudangId");
