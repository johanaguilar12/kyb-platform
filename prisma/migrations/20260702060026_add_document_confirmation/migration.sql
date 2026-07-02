-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "confirmation_status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "pdf_hash" TEXT;
