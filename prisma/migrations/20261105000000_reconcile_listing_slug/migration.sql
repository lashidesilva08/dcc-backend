-- Reconcile the existing Listing.slug column and unique index.
-- These objects already exist in the development database.

ALTER TABLE "Listing"
ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "Listing_slug_key"
ON "Listing"("slug");