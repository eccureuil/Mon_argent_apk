import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { formatMonthYear } from '../utils/format';

interface MonthSelectorProps {
  month: number;
  year: number;
  onPrev: () => void;
  onNext: () => void;
}

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

function createStyles(c: Record<string, any>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      gap: 16,
    },
    button: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: c.surface,
    },
    buttonDisabled: {
      opacity: 0.4,
    },
    label: {
      color: c.text,
      fontSize: 16,
      fontWeight: '600',
      textTransform: 'capitalize',
      minWidth: 180,
      textAlign: 'center',
    },
  });
}
