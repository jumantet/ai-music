-- Remove Spotify user OAuth (catalog still uses client credentials only)
DROP INDEX IF EXISTS "User_spotifyUserId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "spotifyRefreshToken";
ALTER TABLE "User" DROP COLUMN IF EXISTS "spotifyUserId";
