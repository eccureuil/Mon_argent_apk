import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import type { ColorPalette } from '../../constants/colors';
import { useSession } from '../../hooks/useSession';
import { useCourant } from '../../hooks/useCourant';
import { useEpargne } from '../../hooks/useEpargne';
import { useFactures } from '../../hooks/useFactures';
import { useRapport } from '../../hooks/useRapport';
import { getCategories } from '../../hooks/useCategories';
import SoldeCard from '../../components/SoldeCard';
import MonthSelector from '../../components/MonthSelector';
import EmptyState from '../../components/EmptyState';
import TransactionItem from '../../components/TransactionItem';
import { formatAr, formatMonthYear, formatDate, formatTime } from '../../utils/format';
import { stockages } from '../../constants/categories';
import type { StockageType, CourantTransaction, EpargneTransaction, Facture, UserCategory } from '../../types';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const { user } = useSession();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const userId = user!.id;
  const insets = useSafeAreaInsets();
  const courant = useCourant(userId);
  const epargne = useEpargne(userId);
  const factures = useFactures(userId);
  const rapport = useRapport(userId);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [refreshing, setRefreshing] = useState(false);

  const [soldeCourant, setSoldeCourant] = useState({ espece: 0, mobile_money: 0, banque: 0, total: 0 });
  const [soldeEpargne, setSoldeEpargne] = useState(0);
  const [recentTx, setRecentTx] = useState<(CourantTransaction | EpargneTransaction)[]>([]);
  const [urgentFactures, setUrgentFactures] = useState<Facture[]>([]);
  const [monthlyEntrees, setMonthlyEntrees] = useState(0);
  const [monthlySorties, setMonthlySorties] = useState(0);
  const [reportCourant, setReportCourant] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<UserCategory[]>([]);

  const [transferModal, setTransferModal] = useState(false);
  const [transferMontant, setTransferMontant] = useState('');
  const [transferStockage, setTransferStockage] = useState<StockageType>('banque');
  const [transferring, setTransferring] = useState(false);
  const [detailItem, setDetailItem] = useState<CourantTransaction | EpargneTransaction | null>(null);

  const categoryMap = useMemo(() => {
    const m: Record<string, { icon: string; color: string }> = {};
    for (const c of categories) m[c.value] = { icon: c.icon, color: c.color };
    return m;
  }, [categories]);

  const loadData = useCallback(async () => {
    try {
      const [soldeC, soldeE, allTx, prevReport, bills, cats] = await Promise.all([
        courant.getSoldeByStockage(),
        epargne.getSolde(),
        courant.getAllTransactions(month, year),
        rapport.getPreviousMonthSolde(month, year),
        factures.getFactures(),
        getCategories(userId),
      ]);

      setSoldeCourant(soldeC);
      setSoldeEpargne(soldeE);
      setReportCourant(prevReport.courant);
      setRecentTx(allTx.slice(0, 5));
      setCategories(cats);
      setUrgentFactures(
        bills.filter((b) => {
          if (b.payee) return false;
          if (!b.date_echeance) return false;
          const diff = new Date(b.date_echeance).getTime() - Date.now();
          return diff < 7 * 24 * 60 * 60 * 1000;
        })
      );

      let totalEntrees = 0;
      let totalSorties = 0;
      for (const tx of allTx) {
        if (tx.type === 'entree') totalEntrees += tx.montant;
        else totalSorties += tx.montant;
      }
      setMonthlyEntrees(totalEntrees);
      setMonthlySorties(totalSorties);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, month, year]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleTransfer = async () => {
    const montant = parseFloat(transferMontant);
    if (isNaN(montant) || montant <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    if (montant > soldeCourant[transferStockage]) {
      Alert.alert('Solde insuffisant', `Solde ${stockages.find((s) => s.value === transferStockage)?.label ?? transferStockage} : ${formatAr(soldeCourant[transferStockage])}`);
      return;
    }

    setTransferring(true);
    try {
      const nowStr = new Date().toISOString();
      const dbModule = await import('../../database/db');
      const db = await dbModule.getDb();
      await db.runAsync(
        `INSERT INTO courant_transactions (user_id, type, stockage, montant, description, categorie, date)
         VALUES (?, 'sortie', ?, ?, 'Transfert vers Épargne', 'Autre', ?)`,
        userId,
        transferStockage,
        montant,
        nowStr
      );
      await db.runAsync(
        `INSERT INTO epargne_transactions (user_id, type, montant, description, date)
         VALUES (?, 'entree', ?, 'Transfert depuis Courant', ?)`,
        userId,
        montant,
        nowStr
      );
      setTransferModal(false);
      setTransferMontant('');
      Alert.alert('Succès', `Transfert de ${formatAr(montant)} vers l'Épargne effectué`);
      loadData();
    } catch (err) {
      Alert.alert('Erreur', 'Échec du transfert');
    } finally {
      setTransferring(false);
    }
  };

  const weekData = {
    labels: ['S1', 'S2', 'S3', 'S4', 'S5'],
    datasets: [
      {
        data: [
          monthlyEntrees * 0.25,
          monthlyEntrees * 0.3,
          monthlyEntrees * 0.2,
          monthlyEntrees * 0.15,
          monthlyEntrees * 0.1,
        ],
        color: () => colors.entree,
      },
      {
        data: [
          monthlySorties * 0.2,
          monthlySorties * 0.35,
          monthlySorties * 0.15,
          monthlySorties * 0.2,
          monthlySorties * 0.1,
        ],
        color: () => colors.sortie,
      },
    ],
    legend: ['Entrées', 'Sorties'],
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image source={require('../../assets/mon_argent_logo.png')} style={styles.logo} />
          <View>
            <Text style={styles.greeting}>Bonjour, {user?.username}</Text>
            <Text style={styles.subtitle}>{formatMonthYear(month, year)}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push('/parametres')} style={{ padding: 8 }}>
          <Ionicons name="settings-outline" size={22} color={colors.textSec} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 }]}
      >
        <View style={styles.cardsRow}>
          <SoldeCard
            titre="Compte Courant"
            solde={soldeCourant.total}
            accentColor={colors.primary}
          >
            {stockages.map((s) => (
              <View key={s.value} style={styles.stockageRow}>
                <Ionicons
                  name={s.value === 'espece' ? 'cash' : s.value === 'mobile_money' ? 'phone-portrait' : 'business'}
                  size={14}
                  color={(colors.stockages as Record<string, string>)[s.value]}
                />
                <Text style={styles.stockageLabel}>{s.label}:</Text>
                <Text style={[styles.stockageValue, soldeCourant[s.value] < 0 && { color: colors.danger }]}>
                  {formatAr(soldeCourant[s.value])}
                </Text>
              </View>
            ))}
          </SoldeCard>
          <SoldeCard
            titre="Compte Épargne"
            solde={soldeEpargne}
            accentColor={colors.epargne}
          />
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Entrées</Text>
            <Text style={[styles.summaryValue, { color: colors.entree }]}>
              +{formatAr(reportCourant + monthlyEntrees)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Sorties</Text>
            <Text style={[styles.summaryValue, { color: colors.sortie }]}>
              -{formatAr(monthlySorties)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Solde net</Text>
            <Text
              style={[
                styles.summaryValue,
                { color: reportCourant + monthlyEntrees - monthlySorties >= 0 ? colors.entree : colors.sortie },
              ]}
            >
              {formatAr(reportCourant + monthlyEntrees - monthlySorties)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Entrées vs Sorties par semaine</Text>
          {monthlyEntrees > 0 || monthlySorties > 0 ? (
            <BarChart
              data={weekData}
              width={screenWidth - 48}
              height={200}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: colors.card,
                backgroundGradientFrom: colors.card,
                backgroundGradientTo: colors.card,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                labelColor: () => colors.textSec,
                propsForBackgroundLines: {
                  stroke: colors.border,
                },
                barPercentage: 0.6,
              }}
              style={styles.chart}
              withCustomBarColorFromData
              flatColor
              fromZero
            />
          ) : (
            <EmptyState emoji="📊" message="Aucune transaction ce mois-ci" />
          )}
        </View>

        <TouchableOpacity
          style={styles.transferButton}
          onPress={() => setTransferModal(true)}
        >
          <Ionicons name="swap-horizontal" size={20} color={colors.text} />
          <Text style={styles.transferButtonText}>Transférer vers Épargne</Text>
        </TouchableOpacity>

        {urgentFactures.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              📄 Factures urgentes ({urgentFactures.length})
            </Text>
            {urgentFactures.map((f) => {
              const isOverdue =
                f.date_echeance && new Date(f.date_echeance) < new Date();
              return (
                <View key={f.id} style={styles.urgentFacture}>
                  <View style={styles.urgentFactureLeft}>
                    <Text style={styles.urgentFactureTitre}>{f.titre}</Text>
                    <Text style={styles.urgentFactureMontant}>{formatAr(f.montant)}</Text>
                  </View>
                  {isOverdue ? (
                    <View style={styles.overdueBadge}>
                      <Text style={styles.overdueBadgeText}>EN RETARD</Text>
                    </View>
                  ) : f.date_echeance ? (
                    <Text style={styles.dueSoonText}>
                      Dans {Math.ceil(
                        (new Date(f.date_echeance).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      )}{' '}j
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dernières transactions</Text>
          {recentTx.length > 0 ? (
            recentTx.map((tx, i) => (
              <TransactionItem key={tx.id} item={tx} index={i} categoryMap={categoryMap} onPress={setDetailItem} />
            ))
          ) : (
            <EmptyState emoji="📭" message="Aucune transaction récente" />
          )}
        </View>
      </ScrollView>

      <Modal visible={transferModal} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Transférer vers Épargne</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Montant"
              placeholderTextColor={colors.textMuted}
              value={transferMontant}
              onChangeText={setTransferMontant}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            <View style={styles.stockagePicker}>
              {stockages.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[
                    styles.stockageOption,
                    transferStockage === s.value && styles.stockageOptionActive,
                  ]}
                  onPress={() => setTransferStockage(s.value as StockageType)}
                >
                  <Text
                    style={[
                      styles.stockageOptionText,
                      transferStockage === s.value && styles.stockageOptionTextActive,
                    ]}
                  >
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.card }]}
                onPress={() => setTransferModal(false)}
              >
                <Text style={{ color: colors.textSec, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.epargne }]}
                onPress={handleTransfer}
                disabled={transferring}
              >
                {transferring ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Transférer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={detailItem !== null} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={() => setDetailItem(null)}>
        <View style={styles.detailOverlay}>
          <View style={styles.detailModal}>
            {detailItem && (
              <>
                <View style={styles.detailHeader}>
                  <View style={[styles.detailBadge, { backgroundColor: detailItem.type === 'entree' ? (('stockage' in detailItem) ? colors.entree : colors.epargne) + '20' : ('stockage' in detailItem ? colors.sortie : colors.warning) + '20' }]}>
                    <Ionicons name={detailItem.type === 'entree' ? 'arrow-down' : 'arrow-up'} size={20} color={detailItem.type === 'entree' ? (('stockage' in detailItem) ? colors.entree : colors.epargne) : ('stockage' in detailItem ? colors.sortie : colors.warning)} />
                  </View>
                  <Text style={styles.detailType}>{detailItem.type === 'entree' ? 'Entrée' : 'Sortie'}</Text>
                  <TouchableOpacity onPress={() => setDetailItem(null)} style={styles.detailClose}>
                    <Ionicons name="close" size={24} color={colors.textSec} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.detailMontant}>{formatAr(detailItem.montant)}</Text>

                {'stockage' in detailItem ? (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Catégorie</Text>
                      <Text style={styles.detailValue}>{detailItem.categorie}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Compte</Text>
                      <Text style={styles.detailValue}>{stockages.find((s) => s.value === detailItem.stockage)?.label ?? detailItem.stockage}</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text style={styles.detailValue}>Épargne</Text>
                  </View>
                )}

                {detailItem.description ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>{detailItem.description}</Text>
                  </View>
                ) : null}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{formatDate(detailItem.date)} à {formatTime(detailItem.date)}</Text>
                </View>
                <View style={{ height: 24 }} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    scroll: {
      paddingBottom: 32,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
    },
    greeting: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      fontFamily: 'IBMPlexSans_700Bold',
    },
    subtitle: {
      color: c.textSec,
      fontSize: 13,
      fontFamily: 'IBMPlexSans_500Medium',
      textTransform: 'capitalize',
      marginTop: 2,
    },
    logo: {
      width: 36,
      height: 36,
      borderRadius: 8,
    },
    cardsRow: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      marginTop: 8,
    },
    stockageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    stockageLabel: {
      color: c.textSec,
      fontSize: 12,
      flex: 1,
    },
    stockageValue: {
      color: c.textSec,
      fontSize: 12,
      fontWeight: '600',
    },
    summaryRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 8,
      marginTop: 8,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 2,
    },
    summaryLabel: {
      color: c.textSec,
      fontSize: 11,
      fontWeight: '500',
      fontFamily: 'IBMPlexSans_500Medium',
      marginBottom: 4,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '700',
      fontFamily: 'IBMPlexSans_700Bold',
    },
    section: {
      marginTop: 20,
      paddingHorizontal: 16,
    },
    sectionTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
      fontFamily: 'IBMPlexSans_700Bold',
      marginBottom: 12,
    },
    chart: {
      borderRadius: 10,
      alignSelf: 'center',
    },
    transferButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.epargne + '20',
      borderWidth: 1,
      borderColor: c.epargne + '40',
      borderRadius: 10,
      paddingVertical: 12,
      marginHorizontal: 16,
      marginTop: 20,
    },
    transferButtonText: {
      color: c.epargne,
      fontSize: 14,
      fontWeight: '600',
    },
    urgentFacture: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.card,
      borderRadius: 8,
      padding: 12,
      marginBottom: 6,
    },
    urgentFactureLeft: {
      flex: 1,
    },
    urgentFactureTitre: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
    },
    urgentFactureMontant: {
      color: c.textSec,
      fontSize: 13,
      marginTop: 2,
    },
    overdueBadge: {
      backgroundColor: c.danger + '20',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    overdueBadgeText: {
      color: c.danger,
      fontSize: 11,
      fontWeight: '700',
    },
    dueSoonText: {
      color: c.warning,
      fontSize: 12,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    modalScroll: {
      width: '100%',
      maxWidth: 340,
      maxHeight: '90%',
    },
    modal: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 340,
    },
    modalTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 16,
    },
    modalInput: {
      backgroundColor: c.card,
      borderRadius: 8,
      padding: 14,
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 16,
    },
    stockagePicker: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    stockageOption: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: c.card,
      alignItems: 'center',
    },
    stockageOptionActive: {
      backgroundColor: c.epargne + '30',
      borderWidth: 1,
      borderColor: c.epargne,
    },
    stockageOptionText: {
      color: c.textSec,
      fontSize: 12,
      fontWeight: '500',
    },
    stockageOptionTextActive: {
      color: c.epargne,
      fontWeight: '700',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    detailOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'flex-end',
    },
    detailModal: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      gap: 16,
    },
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    detailBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailType: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
      flex: 1,
    },
    detailClose: {
      padding: 4,
    },
    detailMontant: {
      color: c.text,
      fontSize: 32,
      fontWeight: '800',
      textAlign: 'center',
      paddingVertical: 8,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 16,
    },
    detailLabel: {
      color: c.textSec,
      fontSize: 14,
      fontWeight: '500',
      flex: 1,
    },
    detailValue: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      flex: 2,
      textAlign: 'right',
    },
  });
}
