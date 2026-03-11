import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  from,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { triggerForceLogout } from './authEvents';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const httpLink = createHttpLink({ uri: API_URL });

const authLink = setContext(async (_, { headers }) => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
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

const AUTH_ERRORS = ['Authentication required', 'Invalid token', 'jwt expired'];

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message }) => {
      console.warn('[GraphQL error]:', message);

      const isAuthError = AUTH_ERRORS.some((e) => message.includes(e));
      if (isAuthError) {
        AsyncStorage.multiRemove(['auth_token', 'auth_user']).then(() => {
          triggerForceLogout();
        });
      }
    });
  }
  if (networkError) {
    console.warn('[Network error]:', networkError);
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
});
