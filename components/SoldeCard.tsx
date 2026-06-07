import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { formatAr } from '../utils/format';
import type { ColorPalette } from '../constants/colors';

interface SoldeCardProps {
  titre: string;
  solde: number;
  accentColor: string;
  children?: React.ReactNode;
}

/** A wallet balance card with title, amount, and optional children. */
export default function SoldeCard({
  titre,
  solde,
  accentColor,
  children,
}: SoldeCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isNegative = solde < 0;

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <Text style={styles.titre}>{titre}</Text>
      <Text style={[styles.solde, isNegative && styles.negative]}>
        {formatAr(solde)}
      </Text>
      {children && <View style={styles.children}>{children}</View>}
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 16,
      borderLeftWidth: 4,
      margin: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 3,
    },
    titre: {
      color: c.textSec,
      fontSize: 11,
      fontWeight: '600',
      fontFamily: 'IBMPlexSans_600SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: 4,
    },
    solde: {
      color: c.text,
      fontSize: 24,
      fontWeight: '700',
      fontFamily: 'IBMPlexSans_700Bold',
      marginBottom: 8,
    },
    negative: {
      color: c.danger,
    },
    children: {
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: 8,
      marginTop: 4,
    },
  });
}
