import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Sidebar } from '../../src/components/layout/Sidebar';
import { BottomTabBar } from '../../src/components/layout/BottomTabBar';
import { useTheme } from '../../src/hooks/useTheme';
import { useIsMobile } from '../../src/hooks/useIsMobile';

export default function AppLayout() {
  const { colors } = useTheme();
  const isMobile = useIsMobile();

  if (!isMobile) {
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
    <View style={[styles.mobileRoot, { backgroundColor: colors.bg }]}>
      <View style={styles.mobileContent}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </View>
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  content: { flex: 1, overflow: 'hidden' },
  mobileRoot: { flex: 1, flexDirection: 'column' },
  mobileContent: { flex: 1, overflow: 'hidden' },
});
