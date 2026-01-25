/*
  Warnings:

  - The values [USER,STAFF] on the enum `Role` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `appointmentId` on the `ActivityLog` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `ActivityLog` table. All the data in the column will be lost.
  - You are about to drop the column `staffId` on the `ActivityLog` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `Appointment` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `Service` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `Staff` table. All the data in the column will be lost.
  - You are about to drop the `QueueItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ADMIN';
COMMIT;

-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "ActivityLog" DROP CONSTRAINT "ActivityLog_staffId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "QueueItem" DROP CONSTRAINT "QueueItem_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "QueueItem" DROP CONSTRAINT "QueueItem_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Service" DROP CONSTRAINT "Service_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Staff" DROP CONSTRAINT "Staff_ownerId_fkey";

-- DropIndex
DROP INDEX "ActivityLog_ownerId_action_createdAt_idx";

-- DropIndex
DROP INDEX "ActivityLog_ownerId_createdAt_idx";

-- DropIndex
DROP INDEX "Appointment_ownerId_staffId_startAt_idx";

-- DropIndex
DROP INDEX "Appointment_ownerId_startAt_idx";

-- DropIndex
DROP INDEX "Appointment_ownerId_status_startAt_idx";

-- DropIndex
DROP INDEX "Appointment_staffId_startAt_key";

-- DropIndex
DROP INDEX "Service_ownerId_requiredStaffType_idx";

-- DropIndex
DROP INDEX "Staff_ownerId_availability_idx";

-- DropIndex
DROP INDEX "Staff_ownerId_type_idx";

-- AlterTable
ALTER TABLE "ActivityLog" DROP COLUMN "appointmentId",
DROP COLUMN "ownerId",
DROP COLUMN "staffId",
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "ownerId",
ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "customerPhone" TEXT;

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "ownerId";

-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "ownerId",
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ADMIN';

-- DropTable
DROP TABLE "QueueItem";

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "Appointment_startAt_idx" ON "Appointment"("startAt");

-- CreateIndex
CREATE INDEX "Appointment_staffId_idx" ON "Appointment"("staffId");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Service_requiredStaffType_idx" ON "Service"("requiredStaffType");

-- CreateIndex
CREATE INDEX "Staff_type_idx" ON "Staff"("type");

-- CreateIndex
CREATE INDEX "Staff_availability_idx" ON "Staff"("availability");
