import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { stockages } from '../constants/categories';
import type { StockageType } from '../types';

interface StockageTabsProps {
  selected: StockageType;
  onSelect: (stockage: StockageType) => void;
}

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  espece: 'cash',
  mobile_money: 'phone-portrait',
  banque: 'business',
};

export default function StockageTabs({ selected, onSelect }: StockageTabsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      {stockages.map((s, index) => {
        const isActive = selected === s.value;
        return (
          <Animated.View
            key={s.value}
            entering={FadeInDown.delay(index * 80).springify()}
            style={[styles.tab, isActive && styles.tabActive]}
          >
            <TouchableOpacity onPress={() => onSelect(s.value)} style={styles.tabInner}>
              <Ionicons
                name={iconMap[s.value]}
                size={18}
                color={isActive ? colors.primary : colors.textSec}
              />
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

function createStyles(c: Record<string, any>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 3,
      marginHorizontal: 16,
      marginVertical: 8,
    },
    tab: {
      flex: 1,
      borderRadius: 8,
    },
    tabActive: {
      backgroundColor: c.card,
    },
    tabInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    label: {
      color: c.textSec,
      fontSize: 13,
      fontWeight: '500',
    },
    labelActive: {
      color: c.primary,
      fontWeight: '700',
    },
  });
}
