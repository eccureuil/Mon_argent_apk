import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { formatAr, formatDateTime, formatDate } from '../utils/format';
import type { Facture } from '../types';

interface FactureCardProps {
  facture: Facture;
  index: number;
  onPress: (facture: Facture) => void;
  onPay: (facture: Facture) => void;
}

export default function FactureCard({
  facture,
  index,
  onPress,
  onPay,
}: FactureCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  function getEcheanceInfo(dateEcheance: string | null): {
    label: string;
    color: string;
  } | null {
    if (!dateEcheance) return null;
    const now = new Date();
    const echeance = new Date(dateEcheance);
    const diffMs = echeance.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: `EN RETARD de ${Math.abs(diffDays)}j`, color: colors.danger };
    }
    if (diffDays <= 7) {
      return { label: `Dans ${diffDays}j`, color: colors.warning };
    }
    return { label: `Dans ${diffDays}j`, color: colors.textSec };
  }

  const echeanceInfo = getEcheanceInfo(facture.date_echeance);
  const catColor = (colors.categories as Record<string, string>)[facture.categorie] ?? colors.textSec;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <TouchableOpacity
        onPress={() => onPress(facture)}
        activeOpacity={0.7}
        style={[styles.card, facture.payee && styles.cardPaid]}
      >
        <View style={[styles.catIndicator, { backgroundColor: catColor }]} />
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={[styles.titre, facture.payee && styles.titrePaid]} numberOfLines={1}>
              {facture.titre}
            </Text>
            <Text style={[styles.montant, facture.payee && styles.montantPaid]}>
              {formatAr(facture.montant)}
            </Text>
          </View>

          {facture.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {facture.description}
            </Text>
          ) : null}

          <View style={styles.badges}>
            <View style={[styles.catBadge, { borderColor: catColor }]}>
              <Text style={[styles.catBadgeText, { color: catColor }]}>
                {facture.categorie}
              </Text>
            </View>

            {echeanceInfo ? (
              <View style={[styles.badge, { backgroundColor: echeanceInfo.color + '20' }]}>
                <Ionicons
                  name={facture.payee ? 'checkmark-circle' : 'alarm'}
                  size={14}
                  color={echeanceInfo.color}
                />
                <Text style={[styles.badgeText, { color: echeanceInfo.color }]}>
                  {echeanceInfo.label}
                </Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: colors.textMuted + '20' }]}>
                <Ionicons name="time" size={14} color={colors.textMuted} />
                <Text style={[styles.badgeText, { color: colors.textMuted }]}>
                  Sans échéance
                </Text>
              </View>
            )}

            {facture.payee && facture.date_paiement && (
              <View style={[styles.badge, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={[styles.badgeText, { color: colors.success }]}>
                  Payée le {formatDateTime(facture.date_paiement)}
                </Text>
              </View>
            )}
          </View>

          {!facture.payee && (
            <TouchableOpacity
              style={styles.payButton}
              onPress={(e) => {
                e.stopPropagation();
                onPay(facture);
              }}
            >
              <Ionicons name="card" size={16} color={colors.text} />
              <Text style={styles.payButtonText}>Marquer comme payée</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function createStyles(c: Record<string, any>) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: c.card,
      borderRadius: 10,
      marginHorizontal: 16,
      marginVertical: 4,
      overflow: 'hidden',
    },
    cardPaid: {
      opacity: 0.7,
    },
    catIndicator: {
      width: 4,
    },
    content: {
      flex: 1,
      padding: 14,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    titre: {
      color: c.text,
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
      marginRight: 8,
    },
    titrePaid: {
      textDecorationLine: 'line-through',
      color: c.textSec,
    },
    montant: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
    },
    montantPaid: {
      color: c.success,
    },
    description: {
      color: c.textSec,
      fontSize: 13,
      marginTop: 4,
      lineHeight: 18,
    },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    catBadge: {
      borderWidth: 1,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    catBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    payButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.primary,
      borderRadius: 8,
      paddingVertical: 10,
      marginTop: 10,
    },
    payButtonText: {
      color: c.text,
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
