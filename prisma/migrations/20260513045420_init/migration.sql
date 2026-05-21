-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'de',
ADD COLUMN     "openaiModel" TEXT NOT NULL DEFAULT 'gpt-5.4-mini';
