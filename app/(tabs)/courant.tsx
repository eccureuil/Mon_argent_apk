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
import StockageTabs from '../../components/StockageTabs';
import MonthSelector from '../../components/MonthSelector';
import TransactionItem from '../../components/TransactionItem';
import EmptyState from '../../components/EmptyState';
import { formatAr, formatMonthYear } from '../../utils/format';
import { courantCategories, stockageLabels, stockages } from '../../constants/categories';
import type { StockageType, CourantTransaction, TransactionType } from '../../types';

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
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [solde, setSolde] = useState(0);
  const [transactions, setTransactions] = useState<CourantTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const loadData = useCallback(async () => {
    try {
      const [soldeData, txData] = await Promise.all([
        getSoldeByStockage(),
        getTransactions(stockage, month, year),
      ]);
      setSolde(soldeData[stockage]);
      setTransactions(txData);
    } catch (err) {
      console.error('Courant load error:', err);
    } finally {
      setLoading(false);
    }
  }, [getSoldeByStockage, getTransactions, stockage, month, year]);

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
      await loadData();

      if (txType === 'sortie') {
        const alert = await checkBudgetAlert(userId, txCategorie, stockage);
        if (alert) {
          const catLabel = courantCategories.find((c) => c.value === txCategorie)?.label ?? txCategorie;
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
      loadData();
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
            loadData();
          } catch (err) {
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

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

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

      <MonthSelector
        month={month}
        year={year}
        onPrev={handleMonthPrev}
        onNext={handleMonthNext}
      />

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
        data={transactions}
        renderItem={({ item, index }) => (
          <TransactionItem item={item} index={index} onDelete={handleDelete} />
        )}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <EmptyState emoji="💳" message="Aucune transaction ce mois-ci" />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={[styles.modal, { paddingBottom: insets.bottom + 32 }]}>
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
                  {courantCategories.map((c) => (
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

      <Modal visible={transferModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={[styles.modal, { paddingBottom: insets.bottom + 32 }]}>
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
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 10,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '700',
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
  });
}
