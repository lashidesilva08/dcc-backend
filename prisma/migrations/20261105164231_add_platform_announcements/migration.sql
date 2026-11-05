-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryCommission" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'announcement',
    "imageUrl" TEXT,
    "ctaLabel" TEXT,
    "ctaTo" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryCommission_categoryId_key" ON "CategoryCommission"("categoryId");

-- CreateIndex
CREATE INDEX "PlatformAnnouncement_enabled_startsAt_expiresAt_idx" ON "PlatformAnnouncement"("enabled", "startsAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "CategoryCommission" ADD CONSTRAINT "CategoryCommission_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
