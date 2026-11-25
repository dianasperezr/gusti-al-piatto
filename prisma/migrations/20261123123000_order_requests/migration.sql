CREATE TYPE "OrderRequestStatus" AS ENUM ('LINK_GENERATED', 'CANCELLED');

CREATE TABLE "OrderRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "OrderRequestStatus" NOT NULL DEFAULT 'LINK_GENERATED',
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderRequest_reference_key" ON "OrderRequest"("reference");
CREATE INDEX "OrderRequest_createdAt_idx" ON "OrderRequest"("createdAt");
