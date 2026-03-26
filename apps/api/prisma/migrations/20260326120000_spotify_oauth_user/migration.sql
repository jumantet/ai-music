-- AlterTable: Spotify OAuth accounts may have no password
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "spotifyUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "spotifyRefreshToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_spotifyUserId_key" ON "User"("spotifyUserId");
