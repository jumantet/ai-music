import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useApolloClient } from '@apollo/client';
import { router } from 'expo-router';
import { LOGIN_MUTATION, SIGNUP_MUTATION } from '../graphql/mutations';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: 'FREE' | 'PRO';
  emailVerified: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const apolloClient = useApolloClient();

  const [loginMutation] = useMutation(LOGIN_MUTATION);
  const [signupMutation] = useMutation(SIGNUP_MUTATION);

  useEffect(() => {
    AsyncStorage.getItem('auth_user')
      .then((stored) => {
        if (stored) setUser(JSON.parse(stored));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await loginMutation({ variables: { email, password } });
    const { token, user: authUser } = data.login;
    await AsyncStorage.setItem('auth_token', token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(authUser));
    setUser(authUser);
    router.replace('/(app)/dashboard');
  }, [loginMutation]);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const { data } = await signupMutation({ variables: { email, password, name } });
    const { token, user: authUser } = data.signup;
    await AsyncStorage.setItem('auth_token', token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(authUser));
    setUser(authUser);
    router.replace('/(app)/dashboard');
  }, [signupMutation]);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
    await apolloClient.clearStore();
    setUser(null);
    router.replace('/(auth)/login');
  }, [apolloClient]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
