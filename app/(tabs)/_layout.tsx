import { useEffect, useState, useMemo } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useSession } from '../../hooks/useSession';

const tabIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home',
  courant: 'wallet',
  epargne: 'business',
  rapport: 'bar-chart',
  factures: 'document-text',
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, isLoading } = useSession();
  const [setupState, setSetupState] = useState<'loading' | 'done' | 'pending'>('loading');

  useEffect(() => {
    SecureStore.getItemAsync('setup_done').then((val) => {
      setSetupState(val === 'true' ? 'done' : 'pending');
    });
  }, []);

  if (isLoading || setupState === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  if (setupState === 'pending') return <Redirect href="/(auth)/initial-setup" />;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          const iconName = tabIcons[route.name] ?? 'ellipse';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSec,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 4,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 4,
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarLabel: 'Accueil' }}
      />
      <Tabs.Screen
        name="courant"
        options={{ tabBarLabel: 'Courant' }}
      />
      <Tabs.Screen
        name="epargne"
        options={{ tabBarLabel: 'Épargne' }}
      />
      <Tabs.Screen
        name="rapport"
        options={{ tabBarLabel: 'Rapport' }}
      />
      <Tabs.Screen
        name="factures"
        options={{ tabBarLabel: 'Factures' }}
      />
    </Tabs>
  );
}

function createStyles(c: Record<string, any>) {
  return StyleSheet.create({
    loading: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}
