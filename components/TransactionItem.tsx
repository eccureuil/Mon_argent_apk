import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { formatAr, formatDate, formatTime, truncate } from '../utils/format';
import type { CourantTransaction, EpargneTransaction } from '../types';

type Transaction = CourantTransaction | EpargneTransaction;

interface TransactionItemProps {
  item: Transaction;
  index: number;
  categoryMap?: Record<string, { icon: string; color: string }>;
  onPress?: (item: Transaction) => void;
  onDelete?: (id: number) => void;
}

function isCourant(tx: Transaction): tx is CourantTransaction {
  return 'stockage' in tx && 'source' in tx;
}

export default function TransactionItem({ item, index, categoryMap, onPress, onDelete }: TransactionItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isEntree = item.type === 'entree';
  const catInfo = isCourant(item) ? categoryMap?.[item.categorie] : undefined;
  const iconName = isCourant(item)
    ? (catInfo?.icon ?? 'ellipsis-horizontal')
    : 'wallet';

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <TouchableOpacity
        onPress={() => onPress?.(item)}
        onLongPress={() => onDelete?.(item.id)}
        activeOpacity={0.7}
        style={styles.container}
      >
        <View style={[styles.iconCircle, isEntree ? styles.entreeBg : styles.sortieBg]}>
          <Ionicons name={iconName as any} size={18} color={colors.text} />
        </View>
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.categorie} numberOfLines={1}>
              {isCourant(item) ? item.categorie : 'Épargne'}
            </Text>
            <Text style={[styles.montant, isEntree ? styles.entreeText : styles.sortieText]}>
              {isEntree ? '+' : '-'}
              {formatAr(item.montant)}
            </Text>
          </View>
          <View style={styles.bottomRow}>
            {item.description ? (
              <Text style={styles.description} numberOfLines={1}>
                {truncate(item.description, 30)}
              </Text>
            ) : (
              <Text style={styles.noDescription}>—</Text>
            )}
            <Text style={styles.date}>
              {formatDate(item.date)} à {formatTime(item.date)}
            </Text>
          </View>
          {isCourant(item) && item.source === 'facture' && (
            <View style={styles.sourceBadge}>
              <Ionicons name="document-text" size={12} color={colors.warning} />
              <Text style={styles.sourceText}>Facture</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function createStyles(c: Record<string, any>) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
      marginHorizontal: 16,
      marginVertical: 4,
      borderWidth: 1,
      borderColor: c.border,
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    entreeBg: {
      backgroundColor: c.entree + '20',
    },
    sortieBg: {
      backgroundColor: c.sortie + '20',
    },
    content: {
      flex: 1,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    categorie: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      fontFamily: 'IBMPlexSans_600SemiBold',
      flex: 1,
    },
    montant: {
      fontSize: 15,
      fontWeight: '700',
      fontFamily: 'IBMPlexSans_700Bold',
    },
    entreeText: {
      color: c.entree,
    },
    sortieText: {
      color: c.sortie,
    },
    bottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 3,
    },
    description: {
      color: c.textSec,
      fontSize: 12,
      fontFamily: 'IBMPlexSans_400Regular',
      flex: 1,
    },
    noDescription: {
      color: c.textMuted,
      fontSize: 12,
      fontFamily: 'IBMPlexSans_400Regular',
    },
    date: {
      color: c.textMuted,
      fontSize: 11,
      fontFamily: 'IBMPlexSans_400Regular',
      marginLeft: 8,
    },
    sourceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    sourceText: {
      color: c.warning,
      fontSize: 11,
      fontWeight: '500',
      fontFamily: 'IBMPlexSans_500Medium',
    },
  });
}
