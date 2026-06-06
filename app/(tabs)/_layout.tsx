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
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          paddingTop: 6,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          fontFamily: 'IBMPlexSans_600SemiBold',
          marginBottom: 4,
          letterSpacing: 0.3,
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
      <Tabs.Screen
        name="parametres"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="categories"
        options={{ href: null }}
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
