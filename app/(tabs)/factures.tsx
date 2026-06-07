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
import { Picker } from '@react-native-picker/picker';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../hooks/useTheme';
import type { ColorPalette } from '../../constants/colors';
import { useSession } from '../../hooks/useSession';
import { useCourant } from '../../hooks/useCourant';
import { useFactures } from '../../hooks/useFactures';
import { getCategories } from '../../hooks/useCategories';
import FactureCard from '../../components/FactureCard';
import EmptyState from '../../components/EmptyState';
import { scheduleBillDueNotification } from '../../services/notifications';
import { stockages } from '../../constants/categories';
import { formatAr } from '../../utils/format';
import type { Facture, StockageType, UserCategory } from '../../types';

type FilterTab = 'toutes' | 'a_payer' | 'payees';

/** Factures screen with bill management and payment. */
export default function FacturesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useSession();
  const userId = user!.id;
  const insets = useSafeAreaInsets();
  const { getFactures, createFacture, updateFacture, deleteFacture, payerFacture, autoCreateRecurringBills } =
    useFactures(userId);
  const { getSoldeByStockage: getSoldeCourant } = useCourant(userId);

  const [factures, setFactures] = useState<Facture[]>([]);
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [filter, setFilter] = useState<FilterTab>('a_payer');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [formModal, setFormModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  const [payStockage, setPayStockage] = useState<StockageType>('banque');

  const [fTitre, setFTitre] = useState('');
  const [fDescription, setFDescription] = useState('');
  const [fMontant, setFMontant] = useState('');
  const [fCategorie, setFCategorie] = useState('');
  const [fDateEcheance, setFDateEcheance] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fRecurrence, setFRecurrence] = useState(false);
  const [saving, setSaving] = useState(false);

  const categoryColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) m[c.value] = c.color;
    return m;
  }, [categories]);

  const loadData = useCallback(async () => {
    try {
      await autoCreateRecurringBills();
      const [data, cats] = await Promise.all([
        getFactures(),
        getCategories(userId),
      ]);
      setFactures(data);
      setCategories(cats);
    } catch (err) {
      console.error('Factures load error:', err);
    } finally {
      setLoading(false);
    }
  }, [getFactures, autoCreateRecurringBills]);

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

  const filteredFactures = factures.filter((f) => {
    if (filter === 'a_payer') return !f.payee;
    if (filter === 'payees') return f.payee;
    return true;
  });

  const totalAPayer = factures
    .filter((f) => !f.payee)
    .reduce((sum, f) => sum + f.montant, 0);
  const nbAPayer = factures.filter((f) => !f.payee).length;

  const openCreate = () => {
    setEditingId(null);
    setFTitre('');
    setFDescription('');
    setFMontant('');
    setFCategorie('');
    setFDateEcheance(null);
    setFRecurrence(false);
    setFormModal(true);
  };

  const openEdit = (f: Facture) => {
    if (f.payee) {
      Alert.alert('Impossible', 'Cette facture est déjà payée');
      return;
    }
    setEditingId(f.id);
    setFTitre(f.titre);
    setFDescription(f.description ?? '');
    setFMontant(f.montant.toString());
    setFCategorie(f.categorie);
    setFDateEcheance(f.date_echeance ? new Date(f.date_echeance) : null);
    setFRecurrence(f.recurrence === 'mensuel');
    setFormModal(true);
  };

  const openDetail = (f: Facture) => {
    setSelectedFacture(f);
    setDetailModal(true);
  };

  const handleSave = async () => {
    if (!fTitre.trim()) {
      Alert.alert('Erreur', 'Le titre est requis');
      return;
    }
    const montant = parseFloat(fMontant);
    if (isNaN(montant) || montant <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    if (!fCategorie) {
      Alert.alert('Erreur', 'Veuillez choisir une catégorie');
      return;
    }

    setSaving(true);
    try {
      const echeanceStr = fDateEcheance?.toISOString();

      const recurrence = fRecurrence ? 'mensuel' : null;

      if (editingId) {
        await updateFacture(
          editingId,
          fTitre.trim(),
          montant,
          fCategorie,
          fDescription.trim() || undefined,
          echeanceStr,
          recurrence
        );
      } else {
        const newId = await createFacture(
          fTitre.trim(),
          montant,
          fCategorie,
          fDescription.trim() || undefined,
          echeanceStr,
          recurrence
        );
        if (echeanceStr) {
          await scheduleBillDueNotification(newId, fTitre.trim(), montant, echeanceStr);
        }
      }
      setFormModal(false);
      loadData();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de sauvegarder la facture');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Confirmer', 'Supprimer cette facture ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteFacture(id);
            loadData();
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer');
          }
        },
      },
    ]);
  };

  const openPayModal = (f: Facture) => {
    setSelectedFacture(f);
    setPayStockage('banque');
    setPayModal(true);
  };

  const handlePay = async () => {
    if (!selectedFacture) return;

    const soldeData = await getSoldeCourant();
    if (selectedFacture.montant > soldeData[payStockage]) {
      Alert.alert('Solde insuffisant', `Solde ${stockages.find((s) => s.value === payStockage)?.label ?? payStockage} : ${formatAr(soldeData[payStockage])}`);
      return;
    }

    setSaving(true);
    try {
      await payerFacture(
        selectedFacture.id,
        selectedFacture.montant,
        selectedFacture.titre,
        selectedFacture.categorie,
        payStockage
      );
      setPayModal(false);
      setDetailModal(false);
      loadData();
      Alert.alert(
        'Facture payée !',
        `Dépense enregistrée dans Compte Courant (${
          stockages.find((s) => s.value === payStockage)?.label ?? payStockage
        })`
      );
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de payer la facture');
    } finally {
      setSaving(false);
    }
  };

  const renderFilterTabs = () => (
    <View style={styles.filterRow}>
      {(['toutes', 'a_payer', 'payees'] as FilterTab[]).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.filterTab, filter === tab && styles.filterTabActive]}
          onPress={() => setFilter(tab)}
        >
          <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>
            {tab === 'toutes' ? 'Toutes' : tab === 'a_payer' ? 'À payer' : 'Payées'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderFAB = () => (
    <TouchableOpacity style={styles.fab} onPress={openCreate}>
      <Ionicons name="add" size={28} color="#FFFFFF" />
    </TouchableOpacity>
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
      <View style={{ paddingTop: insets.top + 8, backgroundColor: colors.bg }}>
        {renderFilterTabs()}
        {filter !== 'payees' && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryLeft}>
              <Ionicons name="document-text" size={24} color={colors.primary} />
              <View>
                <Text style={styles.summaryLabel}>Total à payer</Text>
                <Text style={styles.summaryCount}>{nbAPayer} facture{nbAPayer > 1 ? 's' : ''}</Text>
              </View>
            </View>
            <Text style={styles.summaryAmount}>{formatAr(totalAPayer)}</Text>
          </View>
        )}
      </View>
      <FlashList
        data={filteredFactures}
        renderItem={({ item, index }) => (
          <FactureCard
            facture={item}
            index={index}
            categoryColor={categoryColorMap[item.categorie]}
            onPress={(f) => {
              if (!f.payee) {
                Alert.alert(f.titre, f.description ?? '', [
                  { text: 'Modifier', onPress: () => openEdit(f) },
                  { text: 'Supprimer', style: 'destructive', onPress: () => handleDelete(f.id) },
                  { text: 'Fermer', style: 'cancel' },
                ]);
              } else {
                openDetail(f);
              }
            }}
            onPay={openPayModal}
          />
        )}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          <EmptyState
            iconName="document-text-outline"
            message={
              filter === 'a_payer'
                ? 'Aucune facture à payer'
                : filter === 'payees'
                ? 'Aucune facture payée'
                : 'Aucune facture'
            }
            actionLabel="Créer une facture"
            onAction={openCreate}
          />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      {renderFAB()}

      <Modal visible={formModal} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen">
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
              {editingId ? 'Modifier la facture' : 'Nouvelle facture'}
            </Text>
            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Titre *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Titre de la facture"
                placeholderTextColor={colors.textMuted}
                value={fTitre}
                onChangeText={setFTitre}
              />
            </View>
            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Montant *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={fMontant}
                onChangeText={setFMontant}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Catégorie *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={fCategorie}
                  onValueChange={setFCategorie}
                  style={styles.picker}
                  dropdownIconColor={colors.textSec}
                  mode={Platform.OS === 'android' ? 'dropdown' : undefined}
                >
                  <Picker.Item label="Choisir..." value="" color={colors.textMuted} style={{ backgroundColor: colors.card }} />
                  {categories.filter(c => c.type === 'facture').map((c) => (
                    <Picker.Item key={c.value} label={c.label} value={c.value} color={colors.text} style={{ backgroundColor: colors.card }} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Description (optionnel)</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                placeholder="Description"
                placeholderTextColor={colors.textMuted}
                value={fDescription}
                onChangeText={setFDescription}
                multiline
                numberOfLines={3}
              />
            </View>
            <View style={styles.modalField}>
              <Text style={styles.fieldLabel}>Date d'échéance (optionnel)</Text>
              <TouchableOpacity
                style={styles.dateBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={18} color={colors.textSec} />
                <Text style={styles.dateText}>
                  {fDateEcheance
                    ? fDateEcheance.toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : 'Sans date'}
                </Text>
                {fDateEcheance && (
                  <TouchableOpacity
                    onPress={() => setFDateEcheance(null)}
                    style={{ marginLeft: 'auto' }}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={fDateEcheance ?? new Date()}
                  mode="date"
                  display="default"
                  onChange={(_, d) => {
                    setShowDatePicker(false);
                    if (d) setFDateEcheance(d);
                  }}
                />
              )}
            </View>
            <View style={styles.modalField}>
              <TouchableOpacity
                style={styles.recurrenceToggle}
                onPress={() => setFRecurrence(!fRecurrence)}
              >
                <Ionicons
                  name="repeat"
                  size={20}
                  color={fRecurrence ? colors.primary : colors.textSec}
                />
                <Text style={[styles.recurrenceLabel, fRecurrence && { color: colors.primary }]}>
                  Facture récurrente mensuelle
                </Text>
                <View
                  style={[
                    styles.recurrenceCheckbox,
                    fRecurrence && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                >
                  {fRecurrence && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.card }]}
                onPress={() => setFormModal(false)}
              >
                <Text style={{ color: colors.textSec, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>
                    {editingId ? 'Modifier' : 'Créer'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={payModal} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen">
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
            <Text style={styles.modalTitle}>Payer la facture</Text>
            <Text style={styles.payMessage}>
              Payer {selectedFacture?.titre} pour {formatAr(selectedFacture?.montant ?? 0)} Ar ? Choisir le compte de débit :
            </Text>
            <View style={styles.stockagePicker}>
              {stockages.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[
                    styles.stockageOption,
                    payStockage === s.value && styles.stockageOptionActive,
                  ]}
                  onPress={() => setPayStockage(s.value as StockageType)}
                >
                  <Text
                    style={[
                      styles.stockageOptionText,
                      payStockage === s.value && styles.stockageOptionTextActive,
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
                onPress={() => setPayModal(false)}
              >
                <Text style={{ color: colors.textSec, fontWeight: '600' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handlePay}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Payer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={detailModal} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen">
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
            {selectedFacture && (
              <>
                <View style={styles.detailHeader}>
                  <Text style={styles.detailTitre}>{selectedFacture.titre}</Text>
                  <Text style={styles.detailMontant}>
                    {formatAr(selectedFacture.montant)}
                  </Text>
                </View>
                {selectedFacture.description ? (
                  <Text style={styles.detailDescription}>
                    {selectedFacture.description}
                  </Text>
                ) : null}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Catégorie</Text>
                  <Text style={styles.detailValue}>{selectedFacture.categorie}</Text>
                </View>
                {selectedFacture.date_echeance && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Échéance</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedFacture.date_echeance).toLocaleDateString(
                        'fr-FR',
                        { day: 'numeric', month: 'long', year: 'numeric' }
                      )}
                    </Text>
                  </View>
                )}
                {selectedFacture.recurrence === 'mensuel' && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Récurrence</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="repeat" size={14} color={colors.primary} />
                      <Text style={[styles.detailValue, { color: colors.primary }]}>Mensuelle</Text>
                    </View>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Statut</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      {
                        color: selectedFacture.payee
                          ? colors.success
                          : colors.danger,
                      },
                    ]}
                  >
                    {selectedFacture.payee ? 'Payée' : 'À payer'}
                  </Text>
                </View>
                {selectedFacture.date_paiement && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payée le</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedFacture.date_paiement).toLocaleDateString(
                        'fr-FR',
                        {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.card, marginTop: 16 }]}
                  onPress={() => setDetailModal(false)}
                >
                  <Text style={{ color: colors.textSec, fontWeight: '600' }}>Fermer</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
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
    filterRow: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 10,
      padding: 3,
    },
    filterTab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    filterTabActive: {
      backgroundColor: c.card,
    },
    filterText: {
      color: c.textSec,
      fontSize: 13,
      fontWeight: '500',
    },
    filterTextActive: {
      color: c.primary,
      fontWeight: '700',
    },
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.surface,
      marginHorizontal: 16,
      marginBottom: 4,
      borderRadius: 12,
      padding: 16,
    },
    summaryLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    summaryLabel: {
      color: c.textSec,
      fontSize: 13,
    },
    summaryCount: {
      color: c.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    summaryAmount: {
      color: c.danger,
      fontSize: 20,
      fontWeight: '700',
    },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
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
      gap: 14,
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
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
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
    recurrenceToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.card,
      borderRadius: 8,
      padding: 14,
    },
    recurrenceLabel: {
      color: c.textSec,
      fontSize: 14,
      fontWeight: '500',
      flex: 1,
    },
    recurrenceCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: c.border,
      justifyContent: 'center',
      alignItems: 'center',
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
    payMessage: {
      color: c.textSec,
      fontSize: 14,
      lineHeight: 20,
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
    detailHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    detailTitre: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      flex: 1,
    },
    detailMontant: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
    },
    detailDescription: {
      color: c.textSec,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    detailLabel: {
      color: c.textSec,
      fontSize: 14,
    },
    detailValue: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
  });
}
