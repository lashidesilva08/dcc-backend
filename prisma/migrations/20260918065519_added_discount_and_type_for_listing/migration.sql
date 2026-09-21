/*
  Warnings:

  - You are about to drop the column `accountNumber` on the `Seller` table. All the data in the column will be lost.
  - You are about to drop the column `bankName` on the `Seller` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "discountEnd" TIMESTAMP(3),
ADD COLUMN     "discountPrice" DOUBLE PRECISION,
ADD COLUMN     "discountStart" TIMESTAMP(3),
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'PRODUCT';

-- AlterTable
ALTER TABLE "Seller" DROP COLUMN "accountNumber",
DROP COLUMN "bankName";
