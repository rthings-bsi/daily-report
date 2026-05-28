-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSession" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dateStr" TEXT NOT NULL,
    "fileName" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "postingDate" TIMESTAMP NOT NULL,
    "dateStr" TEXT NOT NULL,
    "moveType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "workCenter" TEXT,
    "batch" TEXT,
    "storageLocation" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitQuantity" DOUBLE PRECISION NOT NULL,
    "group" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "userName" TEXT,
    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Movement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "batch" TEXT,
    "sloc" TEXT,
    "category" TEXT,
    "unitQty" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Stock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Movement_sessionId_idx" ON "Movement"("sessionId");

-- CreateIndex
CREATE INDEX "Stock_sessionId_idx" ON "Stock"("sessionId");
