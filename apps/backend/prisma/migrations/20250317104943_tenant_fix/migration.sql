/*
  Warnings:

  - You are about to drop the column `email` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `Tenant` table. All the data in the column will be lost.
  - Added the required column `userId` to the `Tenant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "email",
DROP COLUMN "plan",
ADD COLUMN     "userId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
