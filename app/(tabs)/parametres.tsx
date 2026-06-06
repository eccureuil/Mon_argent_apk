import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../../hooks/useTheme';
import { useSession } from '../../hooks/useSession';
import {
  getReglesBudget,
  upsertRegleBudget,
  deleteRegleBudget,
} from '../../hooks/useParametres';
import { resetDatabase } from '../../database/db';
import { logoutUser } from '../../database/userRepository';
import ConfirmDialog from '../../components/ConfirmDialog';
import { formatAr } from '../../utils/format';
import { courantCategories } from '../../constants/categories';
import type { RegleBudget, ThemePreference } from '../../types';

const themeOptions: { label: string; value: ThemePreference; icon: string }[] = [
  { label: 'Clair', value: 'light', icon: 'sunny' },
  { label: 'Sombre', value: 'dark', icon: 'moon' },
  { label: 'Système', value: 'system', icon: 'settings' },
];

export default function ParametresScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { user, logout } = useSession();
  const { themePreference, setTheme } = useTheme();
  const userId = user!.id;
  const username = user!.username;

  const [regles, setRegles] = useState<RegleBudget[]>([]);
  const [loading, setLoading] = useState(true);

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editRule, setEditRule] = useState<RegleBudget | null>(null);
  const [ruleCategorie, setRuleCategorie] = useState('');
  const [ruleMontant, setRuleMontant] = useState('');
  const [rulePeriode, setRulePeriode] = useState<'mensuel' | 'hebdomadaire'>('mensuel');
  const [ruleSaving, setRuleSaving] = useState(false);

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RegleBudget | null>(null);

  const loadRegles = useCallback(async () => {
    try {
      const data = await getReglesBudget(userId);
      setRegles(data);
    } catch (err) {
      console.error('Erreur chargement règles:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadRegles();
    }, [loadRegles])
  );

  const handleLogout = async () => {
    setLogoutVisible(false);
    await logout();
  };

  const handleReset = async () => {
    setResetVisible(false);
    await resetDatabase();
    await logoutUser();
    await logout();
  };

  const openAddRule = () => {
    setEditRule(null);
    setRuleCategorie('');
    setRuleMontant('');
    setRulePeriode('mensuel');
    setModalVisible(true);
  };

  const openEditRule = (rule: RegleBudget) => {
    setEditRule(rule);
    setRuleCategorie(rule.categorie);
    setRuleMontant(rule.montant_max.toString());
    setRulePeriode(rule.periode);
    setModalVisible(true);
  };

  const handleSaveRule = async () => {
    if (!ruleCategorie) {
      Alert.alert('Erreur', 'Veuillez choisir une catégorie');
      return;
    }
    const montant = parseFloat(ruleMontant);
    if (isNaN(montant) || montant <= 0) {
      Alert.alert('Erreur', 'Montant maximum invalide');
      return;
    }
    if (!editRule && regles.some((r) => r.categorie === ruleCategorie)) {
      Alert.alert('Erreur', 'Une règle existe déjà pour cette catégorie');
      return;
    }

    setRuleSaving(true);
    try {
      await upsertRegleBudget(userId, ruleCategorie, montant, rulePeriode);
      setModalVisible(false);
      loadRegles();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer la règle');
    } finally {
      setRuleSaving(false);
    }
  };

  const confirmDeleteRule = (rule: RegleBudget) => {
    setDeleteTarget(rule);
    setDeleteVisible(true);
  };

  const handleDeleteRule = async () => {
    if (!deleteTarget) return;
    setDeleteVisible(false);
    try {
      await deleteRegleBudget(userId, deleteTarget.id);
      loadRegles();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de supprimer la règle');
    }
    setDeleteTarget(null);
  };

  const catIcon = (value: string) => {
    const cat = courantCategories.find((c) => c.value === value);
    return cat?.icon ?? 'ellipsis-horizontal';
  };

  const catLabel = (value: string) => {
    const cat = courantCategories.find((c) => c.value === value);
    return cat?.label ?? value;
  };

  const renderSectionHeader = (title: string) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  const renderRow = (
    icon: string,
    label: string,
    right?: React.ReactNode,
    onPress?: () => void,
    danger = false
  ) => (
    <TouchableOpacity
      key={label}
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={styles.rowLeft}>
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={20}
          color={danger ? colors.danger : colors.primary}
          style={styles.rowIcon}
        />
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>
          {label}
        </Text>
      </View>
      {right}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Paramètres</Text>
        </View>

        {renderSectionHeader('Apparence')}
        <Text style={styles.sectionSubtitle}>Thème</Text>
        <View style={styles.section}>
          {themeOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={styles.row}
              onPress={() => setTheme(opt.value)}
              activeOpacity={0.6}
            >
              <View style={styles.rowLeft}>
                <Ionicons
                  name={opt.icon as keyof typeof Ionicons.glyphMap}
                  size={20}
                  color={themePreference === opt.value ? colors.primary : colors.textSec}
                  style={styles.rowIcon}
                />
                <Text style={[styles.rowLabel, themePreference === opt.value && { color: colors.primary }]}>
                  {opt.label}
                </Text>
              </View>
              {themePreference === opt.value && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {renderSectionHeader('Compte')}
        <View style={styles.section}>
          {renderRow(
            'person-circle',
            'Nom d\'utilisateur',
            <Text style={styles.rowValue}>{username}</Text>
          )}
          {renderRow('log-out', 'Déconnexion', undefined, () => setLogoutVisible(true), true)}
          {renderRow('trash', 'Réinitialiser les données', undefined, () => setResetVisible(true), true)}
        </View>

        {renderSectionHeader('Règles budgétaires')}
        <Text style={styles.sectionSubtitle}>
          Définissez un plafond de dépense par catégorie
        </Text>
        <View style={styles.section}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
          ) : regles.length === 0 ? (
            <Text style={styles.emptyText}>Aucune règle budgétaire définie</Text>
          ) : (
            regles.map((rule) => (
              <TouchableOpacity
                key={rule.id}
                style={styles.ruleRow}
                onPress={() => openEditRule(rule)}
                activeOpacity={0.6}
              >
                <View style={styles.ruleRowLeft}>
                  <Ionicons
                    name={catIcon(rule.categorie) as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={colors.categories?.[rule.categorie] ?? colors.primary}
                    style={styles.rowIcon}
                  />
                  <View>
                    <Text style={styles.ruleCat}>{catLabel(rule.categorie)}</Text>
                    <Text style={styles.ruleMax}>
                      {formatAr(rule.montant_max)}
                      {rule.periode === 'mensuel' ? ' / mois' : ' / semaine'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => confirmDeleteRule(rule)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity style={styles.addRuleBtn} onPress={openAddRule}>
            <Ionicons name="add-circle" size={20} color={colors.primary} />
            <Text style={styles.addRuleText}>Ajouter une règle</Text>
          </TouchableOpacity>
        </View>

        {renderSectionHeader('À propos')}
        <View style={styles.section}>
          {renderRow(
            'information-circle',
            'Version',
            <Text style={styles.rowValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
          )}
          {renderRow('person', 'Auteur', <Text style={styles.rowValue}>tsitsito</Text>)}
          {renderRow('logo-github', 'GitHub', undefined, () =>
            Linking.openURL('https://github.com/eccureuil/Mon_argent_apk.git')
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={logoutVisible}
        title="Déconnexion"
        message="Voulez-vous vraiment vous déconnecter ?"
        confirmLabel="Se déconnecter"
        onConfirm={handleLogout}
        onCancel={() => setLogoutVisible(false)}
      />

      <ConfirmDialog
        visible={resetVisible}
        title="Réinitialiser"
        message="Toutes vos données seront supprimées définitivement. Cette action est irréversible."
        confirmLabel="Tout supprimer"
        onConfirm={handleReset}
        onCancel={() => setResetVisible(false)}
      />

      <ConfirmDialog
        visible={deleteVisible}
        title="Supprimer la règle"
        message={`Supprimer la règle pour ${deleteTarget ? catLabel(deleteTarget.categorie) : ''} ?`}
        confirmLabel="Supprimer"
        onConfirm={handleDeleteRule}
        onCancel={() => {
          setDeleteVisible(false);
          setDeleteTarget(null);
        }}
      />

      <Modal visible={modalVisible} transparent animationType="fade">
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
                  {editRule ? 'Modifier la règle' : 'Nouvelle règle budgétaire'}
                </Text>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Catégorie</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={ruleCategorie}
                      onValueChange={setRuleCategorie}
                      style={styles.picker}
                      dropdownIconColor={colors.textSec}
                      mode={Platform.OS === 'android' ? 'dropdown' : undefined}
                    >
                      <Picker.Item
                        label="Choisir..."
                        value=""
                        color={colors.textMuted}
                        style={{ backgroundColor: colors.card }}
                      />
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
                  <Text style={styles.fieldLabel}>Montant maximum</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    value={ruleMontant}
                    onChangeText={setRuleMontant}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Période</Text>
                  <View style={styles.periodeToggle}>
                    {(['mensuel', 'hebdomadaire'] as const).map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.periodeOption,
                          rulePeriode === p && styles.periodeOptionActive,
                        ]}
                        onPress={() => setRulePeriode(p)}
                      >
                        <Text
                          style={[
                            styles.periodeText,
                            rulePeriode === p && styles.periodeTextActive,
                          ]}
                        >
                          {p === 'mensuel' ? 'Mensuel' : 'Hebdomadaire'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.card }]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={{ color: colors.textSec, fontWeight: '600' }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSaveRule}
                    disabled={ruleSaving}
                  >
                    {ruleSaving ? (
                      <ActivityIndicator color={colors.text} />
                    ) : (
                      <Text style={{ color: colors.text, fontWeight: '700' }}>
                        {editRule ? 'Modifier' : 'Ajouter'}
                      </Text>
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
    header: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    headerTitle: {
      color: c.text,
      fontSize: 28,
      fontWeight: '700',
    },
    sectionHeader: {
      color: c.primary,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: 24,
      marginBottom: 8,
      paddingHorizontal: 16,
    },
    sectionSubtitle: {
      color: c.textSec,
      fontSize: 13,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    section: {
      backgroundColor: c.surface,
      marginHorizontal: 16,
      borderRadius: 12,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.card,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rowIcon: {
      width: 24,
      textAlign: 'center',
    },
    rowLabel: {
      color: c.text,
      fontSize: 15,
    },
    rowValue: {
      color: c.textSec,
      fontSize: 14,
    },
    themeToggle: {
      flexDirection: 'row',
      gap: 6,
    },
    themeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: c.card,
    },
    themeOptionActive: {
      backgroundColor: c.primary + '20',
      borderWidth: 1,
      borderColor: c.primary,
    },
    themeOptionText: {
      color: c.textSec,
      fontSize: 12,
      fontWeight: '500',
    },
    themeOptionTextActive: {
      color: c.primary,
      fontWeight: '700',
    },
    emptyText: {
      color: c.textSec,
      fontSize: 14,
      textAlign: 'center',
      padding: 20,
    },
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.card,
    },
    ruleRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    ruleCat: {
      color: c.text,
      fontSize: 14,
      fontWeight: '600',
    },
    ruleMax: {
      color: c.textSec,
      fontSize: 12,
      marginTop: 2,
    },
    deleteBtn: {
      padding: 4,
    },
    addRuleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
    },
    addRuleText: {
      color: c.primary,
      fontSize: 14,
      fontWeight: '600',
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
    periodeToggle: {
      flexDirection: 'row',
      gap: 8,
    },
    periodeOption: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: c.card,
      alignItems: 'center',
    },
    periodeOptionActive: {
      backgroundColor: c.primary + '30',
      borderWidth: 1,
      borderColor: c.primary,
    },
    periodeText: {
      color: c.textSec,
      fontSize: 13,
      fontWeight: '500',
    },
    periodeTextActive: {
      color: c.primary,
      fontWeight: '700',
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
  });
}
