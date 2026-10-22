-- Category: sub-category support + description / ordering / updatedAt
ALTER TABLE "Category"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "parentId"    INTEGER,
  ADD COLUMN "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Category"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Disputes
CREATE TABLE "Dispute" (
  "id"             SERIAL NOT NULL,
  "disputeNumber"  TEXT NOT NULL,
  "orderId"        INTEGER NOT NULL,
  "openedById"     INTEGER,
  "sellerId"       INTEGER,
  "reason"         TEXT NOT NULL,
  "description"    TEXT,
  "status"         TEXT NOT NULL DEFAULT 'open',
  "resolution"     TEXT,
  "refundAmount"   DOUBLE PRECISION,
  "resolutionNote" TEXT,
  "resolvedById"   INTEGER,
  "resolvedAt"     TIMESTAMP(3),
  "history"        JSONB NOT NULL DEFAULT '[]',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Dispute_disputeNumber_key" ON "Dispute"("disputeNumber");
CREATE INDEX "Dispute_orderId_idx" ON "Dispute"("orderId");
CREATE INDEX "Dispute_status_idx"  ON "Dispute"("status");

ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey"
  FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Admin audit trail for order overrides
CREATE TABLE "OrderAdminLog" (
  "id"        SERIAL NOT NULL,
  "orderId"   INTEGER NOT NULL,
  "adminId"   INTEGER,
  "action"    TEXT NOT NULL,
  "details"   JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderAdminLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderAdminLog_orderId_idx" ON "OrderAdminLog"("orderId");

ALTER TABLE "OrderAdminLog" ADD CONSTRAINT "OrderAdminLog_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderAdminLog" ADD CONSTRAINT "OrderAdminLog_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;