import { authResolvers } from './auth';
import { userResolvers } from './user';
import { campaignResolvers } from './campaign';
import { metaAdsResolvers } from './metaAds';
import { billingResolvers } from './billing';
import { spotifyResolvers } from './spotify';
import { trackResolvers } from './track';

function mergeResolvers(...resolverSets: Record<string, Record<string, unknown>>[]) {
  const merged: Record<string, Record<string, unknown>> = {};
  for (const resolvers of resolverSets) {
    for (const [typeName, typeResolvers] of Object.entries(resolvers)) {
      merged[typeName] = { ...(merged[typeName] ?? {}), ...typeResolvers };
    }
  }
  return merged;
}

export const resolvers = mergeResolvers(
  authResolvers,
  userResolvers,
  campaignResolvers,
  metaAdsResolvers,
  billingResolvers,
  spotifyResolvers,
  trackResolvers
);
