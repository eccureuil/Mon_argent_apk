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
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../../hooks/useTheme';
import { useSession } from '../../hooks/useSession';
import { useCourant } from '../../hooks/useCourant';
import { checkBudgetAlert } from '../../hooks/useParametres';
import { getCategories } from '../../hooks/useCategories';
import StockageTabs from '../../components/StockageTabs';
import TransactionItem from '../../components/TransactionItem';
import EmptyState from '../../components/EmptyState';
import { formatAr, formatDate, formatTime } from '../../utils/format';
import { stockageLabels, stockages } from '../../constants/categories';
import type { StockageType, CourantTransaction, TransactionType, UserCategory } from '../../types';

export default function CourantScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useSession();
  const userId = user!.id;
  const insets = useSafeAreaInsets();
  const { getSoldeByStockage, getTransactions, addTransaction, deleteTransaction } =
    useCourant(userId);

  const now = new Date();
  const [stockage, setStockage] = useState<StockageType>('espece');
  const [solde, setSolde] = useState(0);
  const [transactions, setTransactions] = useState<CourantTransaction[]>([]);
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [detailItem, setDetailItem] = useState<CourantTransaction | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [txType, setTxType] = useState<TransactionType>('entree');
  const [txMontant, setTxMontant] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txCategorie, setTxCategorie] = useState('');
  const [txDate, setTxDate] = useState(now);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferSource, setTransferSource] = useState<StockageType>('espece');
  const [transferDest, setTransferDest] = useState<StockageType>('mobile_money');
  const [transferMontant, setTransferMontant] = useState('');
  const [transferFrais, setTransferFrais] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);

  const categoryMap = useMemo(() => {
    const m: Record<string, { icon: string; color: string }> = {};
    for (const c of categories) m[c.value] = { icon: c.icon, color: c.color };
    return m;
  }, [categories]);

  const loadData = useCallback(async (forDate: Date) => {
    try {
      const m = forDate.getMonth() + 1;
      const y = forDate.getFullYear();
      const [soldeData, txData, cats] = await Promise.all([
        getSoldeByStockage(),
        getTransactions(stockage, m, y),
        getCategories(userId),
      ]);
      setSolde(soldeData[stockage]);
      setTransactions(txData);
      setCategories(cats);
    } catch (err) {
      console.error('Courant load error:', err);
    } finally {
      setLoading(false);
    }
  }, [getSoldeByStockage, getTransactions, stockage]);

  useFocusEffect(
    useCallback(() => {
      const today = new Date();
      setSelectedDate(today);
      loadData(today);
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(selectedDate);
    setRefreshing(false);
  }, [loadData, selectedDate]);

  const handleStockageChange = useCallback((s: StockageType) => {
    setStockage(s);
    setLoading(true);
  }, []);

  const openForm = useCallback((type: TransactionType) => {
    setTxType(type);
    setTxMontant('');
    setTxDescription('');
    setTxCategorie('');
    setTxDate(new Date());
    setModalVisible(true);
  }, []);

  const handleSave = async () => {
    const montant = parseFloat(txMontant);
    if (isNaN(montant) || montant <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    if (!txCategorie) {
      Alert.alert('Erreur', 'Veuillez choisir une catégorie');
      return;
    }

    if (txType === 'sortie') {
      const soldeData = await getSoldeByStockage();
      if (montant > soldeData[stockage]) {
        Alert.alert('Solde insuffisant', `Solde ${stockage === 'espece' ? 'Espèces' : stockage === 'mobile_money' ? 'Mobile Money' : 'Banque'} : ${formatAr(soldeData[stockage])}`);
        return;
      }
    }

    setSaving(true);
    try {
      await addTransaction(
        txType,
        stockage,
        montant,
        txCategorie,
        txDate.toISOString(),
        txDescription.trim() || undefined
      );
      setModalVisible(false);
      await loadData(selectedDate);

      if (txType === 'sortie') {
        const alert = await checkBudgetAlert(userId, txCategorie, stockage);
        if (alert) {
          const catLabel = categories.find((c) => c.value === txCategorie)?.label ?? txCategorie;
          if (alert.depasse) {
            Alert.alert(
              '⚠️ Plafond dépassé',
              `Vous avez dépassé votre règle budgétaire pour ${catLabel}.\nDépensé ce mois : ${formatAr(alert.depense)} / Plafond : ${formatAr(alert.max)}`
            );
          } else if (alert.pourcentage >= 80) {
            Alert.alert(
              '💡 Attention budget',
              `Vous avez utilisé ${alert.pourcentage}% de votre budget ${catLabel} ce mois.`
            );
          }
        }
      }
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'ajouter la transaction');
    } finally {
      setSaving(false);
    }
  };

  const openTransferForm = useCallback(() => {
    setTransferSource(stockage);
    const other = stockages.find((s) => s.value !== stockage);
    setTransferDest(other ? other.value : 'mobile_money');
    setTransferMontant('');
    setTransferFrais('');
    setTransferModalVisible(true);
  }, [stockage]);

  const handleTransfer = async () => {
    const montant = parseFloat(transferMontant);
    const frais = parseFloat(transferFrais) || 0;
    if (isNaN(montant) || montant <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    if (transferSource === transferDest) {
      Alert.alert('Erreur', 'Sélectionnez deux comptes différents');
      return;
    }

    const soldeData = await getSoldeByStockage();
    const totalADebiter = montant + frais;
    if (totalADebiter > soldeData[transferSource]) {
      Alert.alert('Solde insuffisant', `Solde ${stockageLabels[transferSource]} : ${formatAr(soldeData[transferSource])}`);
      return;
    }

    setTransferSaving(true);
    try {
      const now = new Date().toISOString();
      const sourceLabel = stockageLabels[transferSource];
      const destLabel = stockageLabels[transferDest];

      await addTransaction('sortie', transferSource, montant, 'Autre', now, `Transfert vers ${destLabel}`);
      await addTransaction('entree', transferDest, montant, 'Autre', now, `Transfert depuis ${sourceLabel}`);
      if (frais > 0) {
        await addTransaction('sortie', transferSource, frais, 'Autre', now, `Frais transfert vers ${destLabel}`);
      }
      setTransferModalVisible(false);
      loadData(selectedDate);
    } catch (err) {
      Alert.alert('Erreur', 'Échec du transfert');
    } finally {
      setTransferSaving(false);
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
            loadData(selectedDate);
          } catch (err) {
            Alert.alert('Erreur', 'Impossible de supprimer');
          }
        },
      },
    ]);
  };

  const isSelectedDateToday =
    selectedDate.getDate() === now.getDate() &&
    selectedDate.getMonth() === now.getMonth() &&
    selectedDate.getFullYear() === now.getFullYear();

  const goPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const goNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    if (d > now) return;
    setSelectedDate(d);
  };

  const dayTransactions = useMemo(
    () =>
      transactions.filter((tx) => {
        const txDate = new Date(tx.date);
        return (
          txDate.getDate() === selectedDate.getDate() &&
          txDate.getMonth() === selectedDate.getMonth() &&
          txDate.getFullYear() === selectedDate.getFullYear()
        );
      }),
    [transactions, selectedDate]
  );

  const renderHeader = () => (
    <View>
      <View style={styles.soldeRow}>
        <View
          style={[
            styles.soldeCard,
            { borderLeftColor: solde >= 0 ? colors.primary : colors.danger },
          ]}
        >
          <Text style={styles.soldeLabel}>Solde {stockage === 'espece' ? 'Espèces' : stockage === 'mobile_money' ? 'Mobile Money' : 'Banque'}</Text>
          <Text style={[styles.soldeValue, solde < 0 && { color: colors.danger }]}>
            {formatAr(solde)}
          </Text>
        </View>
      </View>

      <View style={styles.dayRow}>
        <TouchableOpacity onPress={goPrevDay} style={styles.dayBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowDayPicker(true)} style={styles.dayLabelBtn}>
          <Text style={styles.dayLabel}>
            {selectedDate.toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={goNextDay}
          style={[styles.dayBtn, isSelectedDateToday && styles.dayBtnDisabled]}
          disabled={isSelectedDateToday}
        >
          <Ionicons name="chevron-forward" size={22} color={isSelectedDateToday ? colors.textMuted : colors.text} />
        </TouchableOpacity>
        {showDayPicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            maximumDate={now}
            onChange={(_, d) => {
              setShowDayPicker(false);
              if (d && d <= now) {
                setSelectedDate(d);
              }
            }}
          />
        )}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.entree + '20' }]}
          onPress={() => openForm('entree')}
        >
          <Ionicons name="add-circle" size={20} color={colors.entree} />
          <Text style={[styles.actionText, { color: colors.entree }]}>Entrée</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary + '20' }]}
          onPress={openTransferForm}
        >
          <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>Transfert</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.sortie + '20' }]}
          onPress={() => openForm('sortie')}
        >
          <Ionicons name="remove-circle" size={20} color={colors.sortie} />
          <Text style={[styles.actionText, { color: colors.sortie }]}>Sortie</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={{ paddingTop: insets.top + 16 }}>
        <StockageTabs selected={stockage} onSelect={handleStockageChange} />
      </View>

      <FlashList
        data={dayTransactions}
        renderItem={({ item, index }) => (
          <TransactionItem item={item} index={index} categoryMap={categoryMap} onPress={(item) => setDetailItem(item as CourantTransaction)} onDelete={handleDelete} />
        )}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <EmptyState emoji="💳" message="Aucune transaction ce jour" />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
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
              {txType === 'entree' ? 'Nouvelle entrée' : 'Nouvelle sortie'}
            </Text>

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
              <Text style={styles.fieldLabel}>Catégorie</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={txCategorie}
                  onValueChange={setTxCategorie}
                  style={styles.picker}
                  dropdownIconColor={colors.textSec}
                  mode={Platform.OS === 'android' ? 'dropdown' : undefined}
                >
                  <Picker.Item label="Choisir..." value="" color={colors.textMuted} style={{ backgroundColor: colors.card }} />
                  {categories.filter(c => c.type === txType || c.type === 'both').map((c) => (
                    <Picker.Item
                      key={c.value}
                      label={c.label}
                      value={c.value}
                      color={colors.text}
                      style={{ backgroundColor: colors.card }}
                    />
                  ))}
                </Picker>
              </View>
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
                  { backgroundColor: txType === 'entree' ? colors.entree : colors.sortie },
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {txType === 'entree' ? 'Ajouter' : 'Déduire'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={transferModalVisible} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen">
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
            <Text style={styles.modalTitle}>Transfert entre comptes</Text>

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Depuis</Text>
              <View style={styles.stockagePicker}>
                {stockages.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[
                      styles.stockageOption,
                      transferSource === s.value && styles.stockageOptionActive,
                    ]}
                    onPress={() => setTransferSource(s.value as StockageType)}
                  >
                    <Text style={[
                      styles.stockageOptionText,
                      transferSource === s.value && styles.stockageOptionTextActive,
                    ]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Vers</Text>
              <View style={styles.stockagePicker}>
                {stockages.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[
                      styles.stockageOption,
                      transferDest === s.value && styles.stockageOptionActive,
                    ]}
                    onPress={() => setTransferDest(s.value as StockageType)}
                  >
                    <Text style={[
                      styles.stockageOptionText,
                      transferDest === s.value && styles.stockageOptionTextActive,
                    ]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Montant</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={transferMontant}
                onChangeText={setTransferMontant}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Frais (optionnel)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={transferFrais}
                onChangeText={setTransferFrais}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.card }]}
                onPress={() => setTransferModalVisible(false)}
              >
                <Text style={{ color: colors.textSec, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleTransfer}
                disabled={transferSaving}
              >
                {transferSaving ? (
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
                  <View style={[styles.detailBadge, { backgroundColor: detailItem.type === 'entree' ? colors.entree + '20' : colors.sortie + '20' }]}>
                    <Ionicons name={detailItem.type === 'entree' ? 'arrow-down' : 'arrow-up'} size={20} color={detailItem.type === 'entree' ? colors.entree : colors.sortie} />
                  </View>
                  <Text style={styles.detailType}>{detailItem.type === 'entree' ? 'Entrée' : 'Sortie'}</Text>
                  <TouchableOpacity onPress={() => setDetailItem(null)} style={styles.detailClose}>
                    <Ionicons name="close" size={24} color={colors.textSec} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.detailMontant}>{formatAr(detailItem.montant)}</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Catégorie</Text>
                  <Text style={styles.detailValue}>{detailItem.categorie}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Compte</Text>
                  <Text style={styles.detailValue}>{stockageLabels[detailItem.stockage]}</Text>
                </View>

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

                {detailItem.source === 'facture' && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Source</Text>
                    <View style={styles.detailSourceBadge}>
                      <Ionicons name="document-text" size={14} color={colors.warning} />
                      <Text style={[styles.detailValue, { color: colors.warning }]}>Facture</Text>
                    </View>
                  </View>
                )}
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
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      gap: 12,
    },
    dayBtn: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: c.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 2,
    },
    dayBtnDisabled: {
      opacity: 0.4,
    },
    dayLabelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: c.surface,
    },
    dayLabel: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      textTransform: 'capitalize',
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
    pickerContainer: {
      backgroundColor: c.surface,
      borderRadius: 8,
      overflow: 'hidden',
    },
    picker: {
      color: c.text,
      backgroundColor: c.surface,
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
    detailSourceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flex: 2,
      justifyContent: 'flex-end',
    },
  });
}
