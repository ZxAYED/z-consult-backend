/*
  Warnings:

  - You are about to drop the column `isBlocked` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isDeleted` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `registrationOtp` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `registrationOtpAttempts` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `registrationOtpExpireIn` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `resetOtp` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `resetOtpAttempts` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `resetOtpExpireIn` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `RefreshSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "StaffType" AS ENUM ('DOCTOR', 'CONSULTANT', 'SUPPORT_AGENT', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffAvailability" AS ENUM ('AVAILABLE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('WAITING', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('ACTIVE', 'ASSIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogAction" AS ENUM ('APPOINTMENT_CREATED', 'APPOINTMENT_UPDATED', 'APPOINTMENT_CANCELLED', 'QUEUE_JOINED', 'QUEUE_ASSIGNED', 'STAFF_STATUS_CHANGED', 'SERVICE_CREATED', 'STAFF_CREATED');

-- DropForeignKey
ALTER TABLE "RefreshSession" DROP CONSTRAINT "RefreshSession_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isBlocked",
DROP COLUMN "isDeleted",
DROP COLUMN "isVerified",
DROP COLUMN "registrationOtp",
DROP COLUMN "registrationOtpAttempts",
DROP COLUMN "registrationOtpExpireIn",
DROP COLUMN "resetOtp",
DROP COLUMN "resetOtpAttempts",
DROP COLUMN "resetOtpExpireIn",
DROP COLUMN "role",
ADD COLUMN     "refreshTokenHash" TEXT;

-- DropTable
DROP TABLE "RefreshSession";

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StaffType" NOT NULL,
    "dailyCapacity" INTEGER NOT NULL DEFAULT 5,
    "availability" "StaffAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "requiredStaffType" "StaffType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueItem" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'ACTIVE',
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "action" "LogAction" NOT NULL,
    "message" TEXT NOT NULL,
    "appointmentId" TEXT,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Staff_ownerId_type_idx" ON "Staff"("ownerId", "type");

-- CreateIndex
CREATE INDEX "Staff_ownerId_availability_idx" ON "Staff"("ownerId", "availability");

-- CreateIndex
CREATE INDEX "Service_ownerId_requiredStaffType_idx" ON "Service"("ownerId", "requiredStaffType");

-- CreateIndex
CREATE INDEX "Appointment_ownerId_startAt_idx" ON "Appointment"("ownerId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_ownerId_staffId_startAt_idx" ON "Appointment"("ownerId", "staffId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_ownerId_status_startAt_idx" ON "Appointment"("ownerId", "status", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_staffId_startAt_key" ON "Appointment"("staffId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "QueueItem_appointmentId_key" ON "QueueItem"("appointmentId");

-- CreateIndex
CREATE INDEX "QueueItem_ownerId_status_queuedAt_idx" ON "QueueItem"("ownerId", "status", "queuedAt");

-- CreateIndex
CREATE INDEX "ActivityLog_ownerId_createdAt_idx" ON "ActivityLog"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_ownerId_action_createdAt_idx" ON "ActivityLog"("ownerId", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
