import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface CategoryOption {
  value: string;
  label: string;
  icon: string;
}

interface CategoryPickerProps {
  options: readonly CategoryOption[];
  selected: string;
  onSelect: (value: string) => void;
}

export default function CategoryPicker({
  options,
  selected,
  onSelect,
}: CategoryPickerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currentOption = options.find((o) => o.value === selected);

  return (
    <View style={styles.container}>
      <View style={styles.iconRow}>
        <Ionicons
          name={(currentOption?.icon ?? 'ellipsis-horizontal') as keyof typeof Ionicons.glyphMap}
          size={18}
          color={colors.primary}
        />
        <Text style={styles.label}>
          {currentOption?.label ?? 'Choisir une catégorie'}
        </Text>
      </View>
      <Picker
        selectedValue={selected}
        onValueChange={onSelect}
        style={styles.picker}
        dropdownIconColor={colors.textSec}
      >
        <Picker.Item
          label="Choisir une catégorie"
          value=""
          color={colors.textMuted}
          style={{ backgroundColor: colors.card }}
        />
        {options.map((opt) => (
          <Picker.Item
            key={opt.value}
            label={opt.label}
            value={opt.value}
            color={colors.text}
            style={{ backgroundColor: colors.card }}
          />
        ))}
      </Picker>
    </View>
  );
}

function createStyles(c: Record<string, any>) {
  return StyleSheet.create({
    container: {
      backgroundColor: c.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    iconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10,
    },
    label: {
      color: c.textSec,
      fontSize: 13,
    },
    picker: {
      color: c.text,
      backgroundColor: 'transparent',
      marginTop: -8,
    },
  });
}
