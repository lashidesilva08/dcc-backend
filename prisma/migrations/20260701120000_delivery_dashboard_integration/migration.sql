-- AlterTable DeliveryProvider
ALTER TABLE "DeliveryProvider" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
ALTER TABLE "DeliveryProvider" ADD COLUMN IF NOT EXISTS "businessRegNo" TEXT;
ALTER TABLE "DeliveryProvider" ADD COLUMN IF NOT EXISTS "district" TEXT;
ALTER TABLE "DeliveryProvider" ADD COLUMN IF NOT EXISTS "settings" JSONB;
ALTER TABLE "DeliveryProvider" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- AlterTable Delivery
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "assignedDriverId" INTEGER;
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "trackingPoints" JSONB;
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "statusHistory" JSONB;
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
ALTER TABLE "Delivery" ALTER COLUMN "deliveryStatus" SET DEFAULT 'CONFIRMED';

-- CreateTable DeliveryDriver
CREATE TABLE IF NOT EXISTS "DeliveryDriver" (
    "id" SERIAL NOT NULL,
    "providerId" INTEGER NOT NULL,
    "userId" INTEGER,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenseNo" TEXT,
    "vehicleType" TEXT NOT NULL DEFAULT 'Motorcycle',
    "vehiclePlate" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable DeliveryNotification
CREATE TABLE IF NOT EXISTS "DeliveryNotification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryProvider_userId_key" ON "DeliveryProvider"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryDriver_userId_key" ON "DeliveryDriver"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "DeliveryProvider" ADD CONSTRAINT "DeliveryProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DeliveryDriver" ADD CONSTRAINT "DeliveryDriver_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "DeliveryProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DeliveryDriver" ADD CONSTRAINT "DeliveryDriver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "DeliveryDriver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DeliveryNotification" ADD CONSTRAINT "DeliveryNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
