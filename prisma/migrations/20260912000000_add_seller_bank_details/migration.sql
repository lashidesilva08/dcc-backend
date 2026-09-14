-- AlterTable: add seller bank detail fields
ALTER TABLE "Seller" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Seller" ADD COLUMN "bankAccountName" TEXT;
ALTER TABLE "Seller" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "Seller" ADD COLUMN "bankBranch" TEXT;
