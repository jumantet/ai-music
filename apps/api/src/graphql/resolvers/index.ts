import { authResolvers } from './auth';
import { userResolvers } from './user';
import { releaseResolvers } from './release';
import { epkResolvers } from './epk';
import { outreachResolvers } from './outreach';
import { billingResolvers } from './billing';

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
  releaseResolvers,
  epkResolvers,
  outreachResolvers,
  billingResolvers
);
