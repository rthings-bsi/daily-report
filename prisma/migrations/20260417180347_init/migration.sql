-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReportSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "dateStr" TEXT NOT NULL,
    "fileName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "postingDate" DATETIME NOT NULL,
    "dateStr" TEXT NOT NULL,
    "moveType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "workCenter" TEXT,
    "batch" TEXT,
    "quantity" REAL NOT NULL,
    "unitQuantity" REAL NOT NULL,
    "group" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    CONSTRAINT "Movement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReportSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "batch" TEXT,
    "sloc" TEXT,
    "category" TEXT,
    "unitQty" REAL NOT NULL,
    "weight" REAL NOT NULL,
    CONSTRAINT "Stock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReportSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Movement_sessionId_idx" ON "Movement"("sessionId");

-- CreateIndex
CREATE INDEX "Stock_sessionId_idx" ON "Stock"("sessionId");
