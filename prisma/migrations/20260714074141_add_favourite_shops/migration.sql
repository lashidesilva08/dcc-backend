/*
  Warnings:

  - You are about to drop the column `slug` on the `Category` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Category" DROP COLUMN "slug";

-- CreateTable
CREATE TABLE "FavouriteShop" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavouriteShop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FavouriteShop_userId_sellerId_key" ON "FavouriteShop"("userId", "sellerId");

-- AddForeignKey
ALTER TABLE "FavouriteShop" ADD CONSTRAINT "FavouriteShop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavouriteShop" ADD CONSTRAINT "FavouriteShop_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
