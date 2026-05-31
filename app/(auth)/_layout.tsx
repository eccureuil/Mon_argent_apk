import { useMemo } from 'react';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useSession } from '../../hooks/useSession';

export default function AuthLayout() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isLoading } = useSession();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="initial-setup" />
    </Stack>
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
