import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  from,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ensureDraftSessionId } from "../lib/draftSession";
import { triggerForceLogout, triggerUnverifiedPrompt } from "./authEvents";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:4000/graphql";

/** Base URL of the API (no /graphql) — OAuth and REST routes. */
export function getApiOrigin(): string {
  return API_URL.replace(/\/graphql\/?$/, "");
}

const httpLink = createHttpLink({ uri: API_URL });

const draftSessionLink = setContext(async (_, { headers }) => {
  try {
    const sessionId = await ensureDraftSessionId();
    return {
      headers: {
        ...headers,
        "x-session-id": sessionId,
      },
    };
  } catch {
    return { headers };
  }
});

const authLink = setContext(async (_, { headers }) => {
  try {
    const token = await AsyncStorage.getItem("auth_token");
    return {
      headers: {
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    };
  } catch {
    return { headers };
  }
});

const AUTH_ERRORS = ["Authentication required", "Invalid token", "jwt expired"];

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, extensions }) => {
      console.warn("[GraphQL error]:", message);

      if (extensions?.code === "EMAIL_NOT_VERIFIED") {
        triggerUnverifiedPrompt();
        return;
      }

      if (extensions?.code === "INSUFFICIENT_CREDITS") {
        return;
      }

      const isAuthError = AUTH_ERRORS.some((e) => message.includes(e));
      if (isAuthError) {
        AsyncStorage.multiRemove(["auth_token", "auth_user"]).then(() => {
          triggerForceLogout();
        });
      }
    });
  }
  if (networkError) {
    console.warn("[Network error]:", networkError);
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, draftSessionLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: "cache-and-network" },
  },
});
