import { requireAuth, requireVerified } from '../../middleware/auth';
import type { AuthContext } from '../../middleware/auth';
import { resolveStreamingTrackMetadata } from '../../services/streamingTrackMetadata';

export const streamingTrackResolvers = {
  Query: {
    streamingTrackFromUrl: async (
      _: unknown,
      { url }: { url: string },
      ctx: AuthContext
    ) => {
      requireAuth(ctx.user);
      requireVerified(ctx.user);
      return resolveStreamingTrackMetadata(url);
    },
  },
};
