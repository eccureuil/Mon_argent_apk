import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { formatMonthYear } from '../utils/format';
import type { ColorPalette } from '../constants/colors';

interface MonthSelectorProps {
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
}

/** Prev/next month navigation with a formatted label. */
export default function MonthSelector({
  month,
  year,
  onPrev,
  onNext,
}: MonthSelectorProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const now = new Date();
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPrev} style={styles.button}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.label}>{formatMonthYear(month, year)}</Text>
      <TouchableOpacity
        onPress={onNext}
        style={[styles.button, isCurrentMonth && styles.buttonDisabled]}
        disabled={isCurrentMonth}
      >
        <Ionicons
          name="chevron-forward"
          size={22}
          color={isCurrentMonth ? colors.textMuted : colors.text}
        />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      gap: 16,
    },
    button: {
      padding: 8,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    buttonDisabled: {
      opacity: 0.3,
    },
    label: {
      color: c.text,
      fontSize: 15,
      fontWeight: '600',
      fontFamily: 'IBMPlexSans_600SemiBold',
      textTransform: 'capitalize',
      minWidth: 180,
      textAlign: 'center',
      letterSpacing: 0.3,
    },
  });
}
