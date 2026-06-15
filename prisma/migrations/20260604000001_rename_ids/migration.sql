-- Migration: Rename all IDs to professional naming + add updatedAt timestamps
-- This should be run manually against the database before updating Prisma schema

-- Rename PK columns
ALTER TABLE "User" RENAME COLUMN "id" TO "userId";
ALTER TABLE "ReportSession" RENAME COLUMN "id" TO "reportSessionId";
ALTER TABLE "Movement" RENAME COLUMN "id" TO "movementId";
ALTER TABLE "MovementSummary" RENAME COLUMN "id" TO "movementSummaryId";
ALTER TABLE "Stock" RENAME COLUMN "id" TO "stockId";

-- Rename FK columns
ALTER TABLE "Movement" RENAME COLUMN "sessionId" TO "reportSessionId";
ALTER TABLE "MovementSummary" RENAME COLUMN "sessionId" TO "reportSessionId";
ALTER TABLE "Stock" RENAME COLUMN "sessionId" TO "reportSessionId";

-- Rename FK constraints
ALTER TABLE "Movement" RENAME CONSTRAINT "Movement_sessionId_fkey" TO "Movement_reportSessionId_fkey";
ALTER TABLE "MovementSummary" RENAME CONSTRAINT "MovementSummary_sessionId_fkey" TO "MovementSummary_reportSessionId_fkey";
ALTER TABLE "Stock" RENAME CONSTRAINT "Stock_sessionId_fkey" TO "Stock_reportSessionId_fkey";

-- Rename indexes
ALTER INDEX IF EXISTS "Movement_sessionId_idx" RENAME TO "Movement_reportSessionId_idx";
ALTER INDEX IF EXISTS "MovementSummary_sessionId_idx" RENAME TO "MovementSummary_reportSessionId_idx";
ALTER INDEX IF EXISTS "Stock_sessionId_idx" RENAME TO "Stock_reportSessionId_idx";

-- Add updatedAt columns (default to creation timestamp for existing rows)
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ReportSession" ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Movement" ADD COLUMN "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Movement" ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MovementSummary" ADD COLUMN "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MovementSummary" ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Stock" ADD COLUMN "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Stock" ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
