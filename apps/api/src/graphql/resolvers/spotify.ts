import { requireAuth, requireVerified } from '../../middleware/auth';
import type { AuthContext } from '../../middleware/auth';
import {
  getAppAccessToken,
  fetchTracksForArtist,
  searchSpotifyArtists,
} from '../../services/spotify';

export const spotifyResolvers = {
  Query: {
    spotifySearchArtistsPublic: async (_: unknown, { query }: { query: string }) => {
      const q = query.trim();
      if (q.length < 2 || q.length > 80) return [];
      const accessToken = await getAppAccessToken();
      return searchSpotifyArtists(accessToken, q, 12);
    },

    spotifySearchArtists: async (
      _: unknown,
      { query }: { query: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);
      const q = query.trim();
      if (q.length < 2) return [];
      const accessToken = await getAppAccessToken();
      return searchSpotifyArtists(accessToken, q, 15);
    },

    spotifyArtistTracks: async (
      _: unknown,
      { artistId, limit }: { artistId: string; limit?: number },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      const id = artistId.trim();
      if (!id) return [];
      const accessToken = await getAppAccessToken();
      const cap = Math.min(Math.max(limit ?? 100, 1), 200);
      const tracks = await fetchTracksForArtist(accessToken, id, cap);
      return tracks.map(({ previewUrl: _p, ...rest }) => rest);
    },
  },
};
