-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceCents" INTEGER,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "subcategoryId" TEXT,
ADD COLUMN     "usdCents" INTEGER;

-- AlterTable
ALTER TABLE "ComboItem" ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "duration" DOUBLE PRECISION,
ADD COLUMN     "path" TEXT,
ADD COLUMN     "thumbnail" TEXT;

-- CreateTable
CREATE TABLE "ContentMedia" (
    "contentId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ContentMedia_pkey" PRIMARY KEY ("contentId","mediaId")
);

-- CreateIndex
CREATE INDEX "ContentMedia_mediaId_idx" ON "ContentMedia"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "Content_slug_key" ON "Content"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Content_externalId_key" ON "Content"("externalId");

-- CreateIndex
CREATE INDEX "Content_subcategoryId_idx" ON "Content"("subcategoryId");

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Content"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentMedia" ADD CONSTRAINT "ContentMedia_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentMedia" ADD CONSTRAINT "ContentMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve prices and identifiers when upgrading existing catalogs.
UPDATE "Content" SET
  "priceCents" = ROUND(COALESCE(NULLIF(options->>'price', ''), '0')::numeric * 100)::integer,
  "usdCents" = ROUND(NULLIF(options->>'usd', '')::numeric * 100)::integer,
  "slug" = CASE WHEN kind = 'PRODUCT' THEN 'platillo-' || id ELSE NULL END,
  options = options - ARRAY['price', 'usd']
WHERE kind IN ('PRODUCT', 'COMBO');

UPDATE "Content" SET options = jsonb_set(options, '{days}', jsonb_build_array((options->>'day')::integer))
WHERE kind = 'HOURS' AND options ? 'day' AND NOT options ? 'days';
