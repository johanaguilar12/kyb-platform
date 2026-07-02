-- AlterTable
ALTER TABLE "files" ADD COLUMN     "controlling_party_reason" TEXT,
ADD COLUMN     "controlling_party_required" BOOLEAN,
ADD COLUMN     "power_of_attorney_reason" TEXT,
ADD COLUMN     "power_of_attorney_required" BOOLEAN;
