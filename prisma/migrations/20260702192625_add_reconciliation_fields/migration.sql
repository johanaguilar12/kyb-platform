-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "reconciliation_errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reconciliation_status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "reconciliation_warnings" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "files" ADD COLUMN     "last_sat_check" TIMESTAMP(3),
ADD COLUMN     "last_status_check" TIMESTAMP(3);
