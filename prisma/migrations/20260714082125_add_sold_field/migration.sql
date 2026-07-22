-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "sold" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Seller" ADD COLUMN     "productCount" INTEGER NOT NULL DEFAULT 0;
