-- CreateTable
CREATE TABLE "QueueItem" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'ACTIVE',
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QueueItem_appointmentId_key" ON "QueueItem"("appointmentId");

-- CreateIndex
CREATE INDEX "QueueItem_status_queuedAt_idx" ON "QueueItem"("status", "queuedAt");

-- AddForeignKey
ALTER TABLE "QueueItem" ADD CONSTRAINT "QueueItem_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
