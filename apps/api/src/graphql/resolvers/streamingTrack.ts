import { resolveStreamingTrackMetadata } from '../../services/streamingTrackMetadata';

export const streamingTrackResolvers = {
  Query: {
    streamingTrackFromUrl: async (_: unknown, { url }: { url: string }) => {
      return resolveStreamingTrackMetadata(url);
    },
  },
};
