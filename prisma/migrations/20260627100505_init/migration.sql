/*
  Warnings:

  - A unique constraint covering the columns `[orderId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Delivery_deliveryProviderId_idx";

-- DropIndex
DROP INDEX "Delivery_deliveryStatus_idx";

-- DropIndex
DROP INDEX "DeliveryProvider_status_idx";

-- DropIndex
DROP INDEX "Order_orderStatus_idx";

-- DropIndex
DROP INDEX "Order_paymentStatus_idx";

-- DropIndex
DROP INDEX "Order_userId_idx";

-- DropIndex
DROP INDEX "OrderItem_listingId_idx";

-- DropIndex
DROP INDEX "OrderItem_orderId_idx";

-- DropIndex
DROP INDEX "OrderItem_sellerId_idx";

-- DropIndex
DROP INDEX "Transaction_orderId_idx";

-- DropIndex
DROP INDEX "Transaction_status_idx";

-- AlterTable
ALTER TABLE "Delivery" ALTER COLUMN "trackingNumber" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_orderId_key" ON "Transaction"("orderId");
