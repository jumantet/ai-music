import "dotenv/config";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import { typeDefs } from "./graphql/schema/typeDefs";
import { resolvers } from "./graphql/resolvers";
import { getUserFromToken } from "./middleware/auth";
import { stripe, createCheckoutSession } from "./services/stripe";
import { prisma } from "./services/prisma";
import type { AuthContext } from "./middleware/auth";

/** Autorise localhost / 127.0.0.1 (navigateur souvent sur l’un ou l’autre → évite CORS silencieux). */
function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const allowed = new Set([
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:19006",
    "http://127.0.0.1:19006",
  ]);
  const fromEnv = process.env.FRONTEND_URL?.replace(/\/$/, "");
  if (fromEnv) allowed.add(fromEnv);
  return allowed.has(origin);
}

async function main() {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => callback(null, isAllowedCorsOrigin(origin)),
      credentials: true,
    }),
  );

  // Stripe webhook must receive raw body
  app.post(
    "/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"] as string;
      let event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET!,
        );
      } catch (err) {
        res.status(400).send(`Webhook Error: ${(err as Error).message}`);
        return;
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const userId = session.metadata?.userId;
          const customerId = session.customer as string;
          if (userId) {
            await prisma.user.update({
              where: { id: userId },
              data: { plan: "PRO", stripeCustomerId: customerId },
            });
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          const customerId = subscription.customer as string;
          await prisma.user.updateMany({
            where: { stripeCustomerId: customerId },
            data: { plan: "FREE" },
          });
          break;
        }

        default:
          break;
      }

      res.json({ received: true });
    },
  );

  app.use(express.json());

  const server = new ApolloServer<AuthContext>({
    typeDefs,
    resolvers,
    formatError: (formattedError) => {
      console.error("[GraphQL Error]", formattedError);
      return {
        message: formattedError.message,
        path: formattedError.path,
        extensions: formattedError.extensions,
      };
    },
  });

  await server.start();

  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req }) => {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith("Bearer ")
          ? authHeader.slice(7)
          : undefined;
        const user = await getUserFromToken(token);
        return { user };
      },
    }),
  );

  const PORT = process.env.PORT ?? 4000;
  app.listen(PORT, () => {
    console.log(`🚀 API ready at http://127.0.0.1:${PORT}/graphql`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
