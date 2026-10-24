-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "billingMode" TEXT NOT NULL DEFAULT 'SESSION',
ADD COLUMN     "rate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "incomeId" TEXT,
ADD COLUMN     "price" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'TUTORING',
    "label" TEXT,
    "studentId" TEXT,
    "period" TEXT,
    "method" TEXT,
    "note" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Income_userId_date_idx" ON "Income"("userId", "date");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_incomeId_fkey" FOREIGN KEY ("incomeId") REFERENCES "Income"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

