import { prisma } from './prisma';
import { getAppAccessToken, fetchTracksForArtist } from './spotify';

/** Remplace les lignes Track de l’utilisateur par le catalogue Spotify de son artiste lié. */
export async function syncUserCatalogTracks(userId: string, maxTracks = 200): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.spotifyArtistId) return 0;

  const token = await getAppAccessToken();
  const tracks = await fetchTracksForArtist(token, user.spotifyArtistId, maxTracks);

  await prisma.$transaction(async (tx) => {
    await tx.track.deleteMany({ where: { userId } });
    if (tracks.length === 0) return;
    await tx.track.createMany({
      data: tracks.map((t) => ({
        userId,
        spotifyTrackId: t.id,
        name: t.name,
        artistName: t.artistName,
        albumName: t.albumName,
        albumImageUrl: t.albumImageUrl,
        durationMs: t.durationMs,
      })),
    });
  });

  return tracks.length;
}
