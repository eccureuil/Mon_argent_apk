import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../hooks/useTheme';
import { useSession } from '../../hooks/useSession';
import { useEpargne } from '../../hooks/useEpargne';
import { useCourant } from '../../hooks/useCourant';
import MonthSelector from '../../components/MonthSelector';
import TransactionItem from '../../components/TransactionItem';
import EmptyState from '../../components/EmptyState';
import { formatAr, formatDate, formatTime } from '../../utils/format';
import { stockageLabels, stockages } from '../../constants/categories';
import type { EpargneTransaction, TransactionType, StockageType } from '../../types';

export default function EpargneScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useSession();
  const userId = user!.id;
  const insets = useSafeAreaInsets();
  const { getSolde, getTransactions, addTransaction, deleteTransaction } =
    useEpargne(userId);
  const { addTransaction: addCourantTransaction } = useCourant(userId);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [solde, setSolde] = useState(0);
  const [transactions, setTransactions] = useState<EpargneTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [txType, setTxType] = useState<TransactionType>('entree');
  const [txMontant, setTxMontant] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txDate, setTxDate] = useState(now);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retraitDestination, setRetraitDestination] = useState<'retrait' | 'courant'>('retrait');
  const [destStockage, setDestStockage] = useState<StockageType>('espece');
  const [detailItem, setDetailItem] = useState<EpargneTransaction | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [soldeData, txData] = await Promise.all([
        getSolde(),
        getTransactions(month, year),
      ]);
      setSolde(soldeData);
      setTransactions(txData);
    } catch (err) {
      console.error('Epargne load error:', err);
    } finally {
      setLoading(false);
    }
  }, [getSolde, getTransactions, month, year]);

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

  const openForm = useCallback((type: TransactionType) => {
    setTxType(type);
    setTxMontant('');
    setTxDescription('');
    setTxDate(new Date());
    setRetraitDestination('retrait');
    setDestStockage('espece');
    setModalVisible(true);
  }, []);

  const handleSave = async () => {
    const montant = parseFloat(txMontant);
    if (isNaN(montant) || montant <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }

    setSaving(true);
    try {
      if (txType === 'sortie' && retraitDestination === 'courant') {
        await addTransaction('sortie', montant, txDate.toISOString(), txDescription.trim() || undefined);
        const destLabel = stockageLabels[destStockage];
        await addCourantTransaction('entree', destStockage, montant, 'Autre', txDate.toISOString(), `Transfert depuis Épargne (${destLabel})`);
      } else {
        await addTransaction(
          txType,
          montant,
          txDate.toISOString(),
          txDescription.trim() || undefined
        );
      }
      setModalVisible(false);
      loadData();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'ajouter la transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Confirmer', 'Supprimer cette transaction ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTransaction(id);
            loadData();
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer');
          }
        },
      },
    ]);
  };

  const handleMonthPrev = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleMonthNext = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const renderHeader = () => (
    <View>
      <View style={styles.soldeRow}>
        <View style={styles.soldeCard}>
          <Text style={styles.soldeLabel}>Épargne totale</Text>
          <Text style={[styles.soldeValue, solde < 0 && { color: colors.danger }]}>
            {formatAr(solde)}
          </Text>
        </View>
      </View>

      <MonthSelector
        month={month}
        year={year}
        onPrev={handleMonthPrev}
        onNext={handleMonthNext}
      />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.epargne + '20' }]}
          onPress={() => openForm('entree')}
        >
          <Ionicons name="add-circle" size={20} color={colors.epargne} />
          <Text style={[styles.actionText, { color: colors.epargne }]}>
            Entrée Épargne
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.warning + '20' }]}
          onPress={() => openForm('sortie')}
        >
          <Ionicons name="remove-circle" size={20} color={colors.warning} />
          <Text style={[styles.actionText, { color: colors.warning }]}>
            Retrait
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.epargne} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top + 16 }}>
        {renderHeader()}
      </View>
      <FlashList
        data={transactions}
        renderItem={({ item, index }) => (
          <TransactionItem item={item} index={index} onPress={(item) => setDetailItem(item as EpargneTransaction)} onDelete={handleDelete} />
        )}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          <EmptyState emoji="🏦" message="Aucune transaction d'épargne ce mois-ci" />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.epargne} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />

      <Modal visible={modalVisible} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {txType === 'entree' ? 'Ajouter à l\'Épargne' : 'Retrait Épargne'}
            </Text>

            {txType === 'sortie' && (
              <>
                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Type de retrait</Text>
                  <View style={styles.destinationPicker}>
                    <TouchableOpacity
                      style={[styles.destOption, retraitDestination === 'retrait' && styles.destOptionActive]}
                      onPress={() => setRetraitDestination('retrait')}
                    >
                      <Text style={[styles.destOptionText, retraitDestination === 'retrait' && styles.destOptionTextActive]}>Retrait simple</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.destOption, retraitDestination === 'courant' && styles.destOptionActive]}
                      onPress={() => setRetraitDestination('courant')}
                    >
                      <Text style={[styles.destOptionText, retraitDestination === 'courant' && styles.destOptionTextActive]}>Vers Compte Courant</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {retraitDestination === 'courant' && (
                  <View style={styles.modalField}>
                    <Text style={styles.fieldLabel}>Destination</Text>
                    <View style={styles.stockagePicker}>
                      {stockages.map((s) => (
                        <TouchableOpacity
                          key={s.value}
                          style={[styles.stockageOption, destStockage === s.value && styles.stockageOptionActive]}
                          onPress={() => setDestStockage(s.value as StockageType)}
                        >
                          <Text style={[styles.stockageOptionText, destStockage === s.value && styles.stockageOptionTextActive]}>{s.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Montant</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={txMontant}
                onChangeText={setTxMontant}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Description (optionnel)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Description"
                placeholderTextColor={colors.textMuted}
                value={txDescription}
                onChangeText={setTxDescription}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Date</Text>
              <TouchableOpacity
                style={styles.dateBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={18} color={colors.textSec} />
                <Text style={styles.dateText}>
                  {txDate.toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={txDate}
                  mode="date"
                  display="default"
                  onChange={(_, d) => {
                    setShowDatePicker(false);
                    if (d) setTxDate(d);
                  }}
                />
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.card }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{ color: colors.textSec, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: txType === 'entree' ? colors.epargne : colors.warning },
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {txType === 'entree' ? 'Ajouter' : retraitDestination === 'courant' ? 'Transférer' : 'Retirer'}
                  </Text>
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
                  <View style={[styles.detailBadge, { backgroundColor: detailItem.type === 'entree' ? colors.epargne + '20' : colors.warning + '20' }]}>
                    <Ionicons name={detailItem.type === 'entree' ? 'arrow-down' : 'arrow-up'} size={20} color={detailItem.type === 'entree' ? colors.epargne : colors.warning} />
                  </View>
                  <Text style={styles.detailType}>{detailItem.type === 'entree' ? 'Ajout Épargne' : 'Retrait Épargne'}</Text>
                  <TouchableOpacity onPress={() => setDetailItem(null)} style={styles.detailClose}>
                    <Ionicons name="close" size={24} color={colors.textSec} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.detailMontant}>{formatAr(detailItem.montant)}</Text>

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
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(c: Record<string, any>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    soldeRow: {
      paddingHorizontal: 16,
      marginTop: 8,
    },
    soldeCard: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 20,
      borderLeftWidth: 3,
      borderLeftColor: c.epargne,
    },
    soldeLabel: {
      color: c.textSec,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    soldeValue: {
      color: c.text,
      fontSize: 28,
      fontWeight: '700',
      marginTop: 4,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      marginVertical: 8,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 2,
    },
    actionText: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: 'IBMPlexSans_700Bold',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'flex-end',
    },
    modalScroll: {
      maxHeight: '90%',
    },
    modal: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      gap: 16,
    },
    modalTitle: {
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 4,
    },
    modalField: {
      gap: 6,
    },
    fieldLabel: {
      color: c.textSec,
      fontSize: 13,
      fontWeight: '500',
    },
    modalInput: {
      backgroundColor: c.card,
      borderRadius: 8,
      padding: 14,
      color: c.text,
      fontSize: 16,
    },
    dateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.card,
      borderRadius: 8,
      padding: 14,
    },
    dateText: {
      color: c.text,
      fontSize: 15,
      textTransform: 'capitalize',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    destinationPicker: {
      flexDirection: 'row',
      gap: 8,
    },
    destOption: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: c.card,
      alignItems: 'center',
    },
    destOptionActive: {
      backgroundColor: c.warning + '30',
      borderWidth: 1,
      borderColor: c.warning,
    },
    destOptionText: {
      color: c.textSec,
      fontSize: 12,
      fontWeight: '500',
    },
    destOptionTextActive: {
      color: c.warning,
      fontWeight: '700',
    },
    stockagePicker: {
      flexDirection: 'row',
      gap: 8,
    },
    stockageOption: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: c.card,
      alignItems: 'center',
    },
    stockageOptionActive: {
      backgroundColor: c.primary + '30',
      borderWidth: 1,
      borderColor: c.primary,
    },
    stockageOptionText: {
      color: c.textSec,
      fontSize: 12,
      fontWeight: '500',
    },
    stockageOptionTextActive: {
      color: c.primary,
      fontWeight: '700',
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
