import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';

interface GradientBgProps {
  children: ReactNode;
}

/** A full-screen LinearGradient wrapper used as the app background. */
export default function GradientBg({ children }: GradientBgProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[colors.bgGradientFrom, colors.bgGradientTo]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
});
