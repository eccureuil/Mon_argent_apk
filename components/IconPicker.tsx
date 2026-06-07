import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import type { ColorPalette } from '../constants/colors';

const ICONS = [
  'briefcase', 'laptop', 'cart', 'cash', 'cash-back', 'card',
  'restaurant', 'car', 'home', 'medkit', 'game-controller',
  'document-text', 'ellipsis-horizontal', 'flash', 'water',
  'globe', 'newspaper', 'shield-checkmark', 'calculator',
  'wallet', 'gift', 'airplane', 'fitness', 'book',
  'musical-note', 'tv', 'phone-portrait', 'business',
  'school', 'construct', 'paw', 'leaf', 'heart', 'star',
  'trending-up', 'trending-down', 'pie-chart', 'bar-chart',
  'camera', 'color-palette', 'shirt', 'train', 'bicycle',
] as const;

interface IconPickerProps {
  selected: string;
  onSelect: (icon: string) => void;
}

/** A scrollable grid of Ionicons for selecting a category icon. */
export default function IconPicker({ selected, onSelect }: IconPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.grid}>
        {ICONS.map((icon) => {
          const isSelected = selected === icon;
          return (
            <TouchableOpacity
              key={icon}
              style={[styles.item, isSelected && styles.selected]}
              onPress={() => onSelect(icon)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={22}
                color={isSelected ? colors.text : colors.textSec}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      maxHeight: 200,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    item: {
      width: '23%',
      aspectRatio: 1,
      borderRadius: 10,
      backgroundColor: c.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: c.border,
    },
    selected: {
      borderColor: c.primary,
      backgroundColor: c.primary + '15',
    },
  });
}
