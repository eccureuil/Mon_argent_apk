import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { formatAr, formatDate, formatTime, truncate } from '../utils/format';
import type { CourantTransaction, EpargneTransaction, TransactionType } from '../types';

type Transaction = CourantTransaction | EpargneTransaction;

interface TransactionItemProps {
  item: Transaction;
  index: number;
  onDelete?: (id: number) => void;
}

const categorieIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Salaire: 'briefcase',
  Freelance: 'laptop',
  Remboursement: 'return-down-back',
  Vente: 'cart',
  Alimentation: 'restaurant',
  Transport: 'car',
  Logement: 'home',
  Santé: 'medkit',
  Loisirs: 'game-controller',
  Facture: 'document-text',
  Autre: 'ellipsis-horizontal',
};

function isCourant(tx: Transaction): tx is CourantTransaction {
  return 'stockage' in tx && 'source' in tx;
}

export default function TransactionItem({ item, index, onDelete }: TransactionItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isEntree = item.type === 'entree';
  const iconName = isCourant(item)
    ? (categorieIcons[item.categorie] ?? 'ellipsis-horizontal')
    : 'wallet';

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <TouchableOpacity
        onLongPress={() => onDelete?.(item.id)}
        activeOpacity={0.7}
        style={styles.container}
      >
        <View style={[styles.iconCircle, isEntree ? styles.entreeBg : styles.sortieBg]}>
          <Ionicons name={iconName} size={18} color={colors.text} />
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
      borderRadius: 10,
      padding: 12,
      marginHorizontal: 16,
      marginVertical: 3,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    entreeBg: {
      backgroundColor: c.primary + '30',
    },
    sortieBg: {
      backgroundColor: c.danger + '30',
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
      flex: 1,
    },
    montant: {
      fontSize: 15,
      fontWeight: '700',
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
      marginTop: 2,
    },
    description: {
      color: c.textSec,
      fontSize: 12,
      flex: 1,
    },
    noDescription: {
      color: c.textMuted,
      fontSize: 12,
    },
    date: {
      color: c.textMuted,
      fontSize: 11,
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
    },
  });
}
