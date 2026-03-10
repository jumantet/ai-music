import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { Sidebar } from '../../src/components/layout/Sidebar';
import { useTheme } from '../../src/hooks/useTheme';

export default function AppLayout() {
  const { colors } = useTheme();

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <Sidebar />
        <View style={styles.content}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  content: { flex: 1, overflow: 'hidden' },
});
