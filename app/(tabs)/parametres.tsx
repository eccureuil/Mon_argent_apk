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
  Switch,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../hooks/useTheme';
import { useSession } from '../../hooks/useSession';
import {
  getReglesBudget,
  upsertRegleBudget,
  deleteRegleBudget,
  getParametre,
  setParametre,
} from '../../hooks/useParametres';
import { getCategories } from '../../hooks/useCategories';
import { resetDatabase, getDb } from '../../database/db';
import { logoutUser, updateUsername, updatePassword } from '../../database/userRepository';
import ConfirmDialog from '../../components/ConfirmDialog';
import { formatAr } from '../../utils/format';
import type { RegleBudget, ThemePreference, UserCategory } from '../../types';
import {
  cancelAllScheduled,
  scheduleDailySummary,
  setSoundEnabled,
} from '../../services/notifications';

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
  const [displayedUsername, setDisplayedUsername] = useState(user!.username);

  const [regles, setRegles] = useState<RegleBudget[]>([]);
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editRule, setEditRule] = useState<RegleBudget | null>(null);
  const [ruleCategorie, setRuleCategorie] = useState('');
  const [ruleMontant, setRuleMontant] = useState('');
  const [rulePeriode, setRulePeriode] = useState<'mensuel' | 'hebdomadaire'>('mensuel');
  const [ruleSaving, setRuleSaving] = useState(false);

  const sortieCategories = useMemo(
    () => categories.filter((c) => c.type === 'sortie'),
    [categories]
  );

  const [guideVisible, setGuideVisible] = useState(false);

  const [usernameModalVisible, setUsernameModalVisible] = useState(false);
  const [usernameValue, setUsernameValue] = useState(displayedUsername);
  const [usernameSaving, setUsernameSaving] = useState(false);

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RegleBudget | null>(null);

  const [notifRappels, setNotifRappels] = useState(true);
  const [notifHeure, setNotifHeure] = useState(19);
  const [notifMinute, setNotifMinute] = useState(0);
  const [notifEcheance, setNotifEcheance] = useState(true);
  const [notifEcheanceJours, setNotifEcheanceJours] = useState(1);
  const [notifSon, setNotifSon] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const loadNotifPrefs = useCallback(async () => {
    const getVal = async (key: string, def: string) => {
      const v = await getParametre(userId, key);
      return v ?? def;
    };
    setNotifRappels((await getVal('notif_rappels_enabled', 'true')) === 'true');
    setNotifHeure(parseInt(await getVal('notif_rappels_heure', '19'), 10));
    setNotifMinute(parseInt(await getVal('notif_rappels_minute', '0'), 10));
    setNotifEcheance((await getVal('notif_echeance_enabled', 'true')) === 'true');
    setNotifEcheanceJours(parseInt(await getVal('notif_echeance_jours', '1'), 10));
    setNotifSon((await getVal('notif_sound_enabled', 'true')) === 'true');
  }, [userId]);

  const syncNotifs = useCallback(async () => {
    const db = await getDb();
    if (notifRappels) {
      await scheduleDailySummary(userId, notifHeure, notifMinute);
    } else {
      await cancelAllScheduled();
    }
    setSoundEnabled(notifSon);
  }, [userId, notifRappels, notifHeure, notifMinute, notifSon]);

  const toggleRappels = useCallback(async (v: boolean) => {
    setNotifRappels(v);
    await setParametre(userId, 'notif_rappels_enabled', v ? 'true' : 'false');
    if (v) {
      await scheduleDailySummary(userId, notifHeure, notifMinute);
    } else {
      await cancelAllScheduled();
    }
  }, [userId, notifHeure, notifMinute]);

  const toggleEcheance = useCallback(async (v: boolean) => {
    setNotifEcheance(v);
    await setParametre(userId, 'notif_echeance_enabled', v ? 'true' : 'false');
  }, [userId]);

  const toggleSon = useCallback(async (v: boolean) => {
    setNotifSon(v);
    setSoundEnabled(v);
    await setParametre(userId, 'notif_sound_enabled', v ? 'true' : 'false');
  }, [userId]);

  const handleTimeChange = useCallback(async (_: any, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      const h = date.getHours();
      const m = date.getMinutes();
      setNotifHeure(h);
      setNotifMinute(m);
      await setParametre(userId, 'notif_rappels_heure', h.toString());
      await setParametre(userId, 'notif_rappels_minute', m.toString());
      if (notifRappels) {
        await scheduleDailySummary(userId, h, m);
      }
    }
  }, [userId, notifRappels]);

  const changeEcheanceJours = useCallback(async (delta: number) => {
    const newVal = Math.max(0, Math.min(30, notifEcheanceJours + delta));
    setNotifEcheanceJours(newVal);
    await setParametre(userId, 'notif_echeance_jours', newVal.toString());
  }, [userId, notifEcheanceJours]);

  const loadRegles = useCallback(async () => {
    try {
      const [data, cats] = await Promise.all([
        getReglesBudget(userId),
        getCategories(userId),
      ]);
      setRegles(data);
      setCategories(cats);
    } catch (err) {
      console.error('Erreur chargement règles:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadRegles();
      loadNotifPrefs();
    }, [loadRegles, loadNotifPrefs])
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
    const cat = categories.find((c) => c.value === value);
    return cat?.icon ?? 'ellipsis-horizontal';
  };

  const catColorFn = (value: string) => {
    const cat = categories.find((c) => c.value === value);
    return cat?.color ?? colors.textSec;
  };

  const catLabel = (value: string) => {
    const cat = categories.find((c) => c.value === value);
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

        {renderSectionHeader('Notifications')}
        <Text style={styles.sectionSubtitle}>Rappels & alertes</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="notifications" size={20} color={colors.primary} style={styles.rowIcon} />
              <Text style={styles.rowLabel}>Rappel quotidien</Text>
            </View>
            <Switch
              value={notifRappels}
              onValueChange={toggleRappels}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={notifRappels ? colors.primary : colors.textMuted}
            />
          </View>
          {notifRappels && (
            <TouchableOpacity style={styles.row} onPress={() => setShowTimePicker(true)} activeOpacity={0.6}>
              <View style={styles.rowLeft}>
                <Ionicons name="time" size={20} color={colors.primary} style={styles.rowIcon} />
                <Text style={styles.rowLabel}>Heure du rappel</Text>
              </View>
              <Text style={styles.rowValue}>{String(notifHeure).padStart(2, '0')}:{String(notifMinute).padStart(2, '0')}</Text>
            </TouchableOpacity>
          )}
          {showTimePicker && (
            <DateTimePicker
              value={new Date(0, 0, 0, notifHeure, notifMinute)}
              mode="time"
              display="default"
              onChange={handleTimeChange}
            />
          )}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="alarm" size={20} color={colors.primary} style={styles.rowIcon} />
              <Text style={styles.rowLabel}>Rappel avant échéance</Text>
            </View>
            <Switch
              value={notifEcheance}
              onValueChange={toggleEcheance}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={notifEcheance ? colors.primary : colors.textMuted}
            />
          </View>
          {notifEcheance && (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="calendar" size={20} color={colors.primary} style={styles.rowIcon} />
                <Text style={styles.rowLabel}>Jours avant</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => changeEcheanceJours(-1)}
                  disabled={notifEcheanceJours <= 0}
                >
                  <Ionicons name="remove" size={18} color={notifEcheanceJours <= 0 ? colors.textMuted : colors.text} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{notifEcheanceJours}</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => changeEcheanceJours(1)}
                  disabled={notifEcheanceJours >= 30}
                >
                  <Ionicons name="add" size={18} color={notifEcheanceJours >= 30 ? colors.textMuted : colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="volume-high" size={20} color={colors.primary} style={styles.rowIcon} />
              <Text style={styles.rowLabel}>Son des notifications</Text>
            </View>
            <Switch
              value={notifSon}
              onValueChange={toggleSon}
              trackColor={{ false: colors.border, true: colors.primary + '60' }}
              thumbColor={notifSon ? colors.primary : colors.textMuted}
            />
          </View>
        </View>

        {renderSectionHeader('Compte')}
        <View style={styles.section}>
          {renderRow('person-circle', 'Nom d\'utilisateur',
            <Text style={styles.rowValue}>{displayedUsername}</Text>,
            () => {
              setUsernameValue(displayedUsername);
              setUsernameModalVisible(true);
            }
          )}
          {renderRow('lock-closed', 'Mot de passe',
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />,
            () => {
              setOldPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setShowOldPwd(false);
              setShowNewPwd(false);
              setShowConfirmPwd(false);
              setPasswordModalVisible(true);
            }
          )}
          {renderRow('list', 'Catégories', undefined, () => router.push('/categories'))}
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
                    color={catColorFn(rule.categorie)}
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
          {renderRow('person', 'Auteur', <Text style={styles.rowValue}>Tsitsito</Text>, () => Linking.openURL('https://tsitohaina.vercel.app'))}
          {renderRow('logo-github', 'GitHub', undefined, () =>
            Linking.openURL('https://github.com/eccureuil/Mon_argent_apk.git')
          )}
          {renderRow('book', 'Guide d\'utilisation',
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />,
            () => setGuideVisible(true)
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
                      {sortieCategories.map((c) => (
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

      <Modal visible={usernameModalVisible} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.modal}>
                <Text style={styles.modalTitle}>Modifier le nom d'utilisateur</Text>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Nouveau nom</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={usernameValue}
                    onChangeText={setUsernameValue}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.card }]}
                    onPress={() => setUsernameModalVisible(false)}
                  >
                    <Text style={{ color: colors.textSec, fontWeight: '600' }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                    onPress={async () => {
                      const trimmed = usernameValue.trim();
                      if (!trimmed) { Alert.alert('Erreur', 'Le nom ne peut pas être vide'); return; }
                      setUsernameSaving(true);
                      try {
                        await updateUsername(userId, trimmed);
                        setDisplayedUsername(trimmed);
                        setUsernameModalVisible(false);
                      } catch (err: any) {
                        Alert.alert('Erreur', err.message);
                      } finally {
                        setUsernameSaving(false);
                      }
                    }}
                    disabled={usernameSaving}
                  >
                    {usernameSaving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Enregistrer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={passwordModalVisible} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.modal}>
                <Text style={styles.modalTitle}>Modifier le mot de passe</Text>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Ancien mot de passe</Text>
                  <View style={styles.pwdRow}>
                    <TextInput
                      style={styles.modalInputPwd}
                      value={oldPassword}
                      onChangeText={setOldPassword}
                      secureTextEntry={!showOldPwd}
                      autoCapitalize="none"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <TouchableOpacity onPress={() => setShowOldPwd(!showOldPwd)} style={styles.eyeBtn}>
                      <Ionicons name={showOldPwd ? 'eye-off' : 'eye'} size={20} color={colors.textSec} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Nouveau mot de passe</Text>
                  <View style={styles.pwdRow}>
                    <TextInput
                      style={styles.modalInputPwd}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNewPwd}
                      autoCapitalize="none"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <TouchableOpacity onPress={() => setShowNewPwd(!showNewPwd)} style={styles.eyeBtn}>
                      <Ionicons name={showNewPwd ? 'eye-off' : 'eye'} size={20} color={colors.textSec} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.fieldLabel}>Confirmer le nouveau mot de passe</Text>
                  <View style={styles.pwdRow}>
                    <TextInput
                      style={styles.modalInputPwd}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPwd}
                      autoCapitalize="none"
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPwd(!showConfirmPwd)} style={styles.eyeBtn}>
                      <Ionicons name={showConfirmPwd ? 'eye-off' : 'eye'} size={20} color={colors.textSec} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.card }]}
                    onPress={() => setPasswordModalVisible(false)}
                  >
                    <Text style={{ color: colors.textSec, fontWeight: '600' }}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                    onPress={async () => {
                      if (!oldPassword) { Alert.alert('Erreur', 'Veuillez entrer l\'ancien mot de passe'); return; }
                      if (newPassword.length < 4) { Alert.alert('Erreur', 'Le nouveau mot de passe doit faire au moins 4 caractères'); return; }
                      if (newPassword !== confirmPassword) { Alert.alert('Erreur', 'Les mots de passe ne correspondent pas'); return; }
                      setPasswordSaving(true);
                      try {
                        await updatePassword(userId, oldPassword, newPassword);
                        setPasswordModalVisible(false);
                        Alert.alert('Succès', 'Mot de passe modifié avec succès');
                      } catch (err: any) {
                        Alert.alert('Erreur', err.message);
                      } finally {
                        setPasswordSaving(false);
                      }
                    }}
                    disabled={passwordSaving}
                  >
                    {passwordSaving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Enregistrer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={guideVisible} transparent animationType="slide" statusBarTranslucent presentationStyle="fullScreen">
        <View style={styles.guideOverlay}>
          <View style={[styles.guideHeader, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.guideTitle}>Guide d'utilisation</Text>
            <TouchableOpacity onPress={() => setGuideVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.guideContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.guideSectionRow}>
              <Ionicons name="stats-chart" size={20} color={colors.primary} />
              <Text style={styles.guideSectionTitle}>Bienvenue</Text>
            </View>
            <Text style={styles.guideText}>
              Mon Argent est une application 100 % hors-ligne de gestion de finances personnelles. 
              Toutes vos données sont stockées localement sur votre appareil — rien n'est envoyé sur Internet.
            </Text>

            <View style={styles.guideSectionRow}>
              <Ionicons name="home" size={20} color={colors.primary} />
              <Text style={styles.guideSectionTitle}>Accueil (Dashboard)</Text>
            </View>
            <Text style={styles.guideText}>
              Vue d'ensemble de vos finances du jour : solde des comptes, entrées et sorties. 
              Vous pouvez naviguer jour par jour avec les flèches, et appuyer sur une transaction pour voir ses détails.
            </Text>

            <View style={styles.guideSectionRow}>
              <Ionicons name="wallet" size={20} color={colors.primary} />
              <Text style={styles.guideSectionTitle}>Compte Courant</Text>
            </View>
            <Text style={styles.guideText}>
              Gérez vos transactions quotidiennes dans 3 portefeuilles : Espèce, Mobile Money et Banque.
            </Text>
            <Text style={styles.guideBullet}>
              • Ajoutez une entrée (salaire, vente, etc.) ou une sortie (achat, facture, etc.)
            </Text>
            <Text style={styles.guideBullet}>
              • Chaque transaction est liée à une catégorie et à un portefeuille
            </Text>
            <Text style={styles.guideBullet}>
              • Transférez de l'argent entre portefeuilles
            </Text>
            <Text style={styles.guideBullet}>
              • Transférez vers le Compte Épargne
            </Text>

            <View style={styles.guideSectionRow}>
              <Ionicons name="save" size={20} color={colors.primary} />
              <Text style={styles.guideSectionTitle}>Compte Épargne</Text>
            </View>
            <Text style={styles.guideText}>
              Suivez votre épargne avec des dépôts et retraits. Possibilité de transférer depuis le Compte Courant.
            </Text>

            <View style={styles.guideSectionRow}>
              <Ionicons name="document-text" size={20} color={colors.primary} />
              <Text style={styles.guideSectionTitle}>Factures</Text>
            </View>
            <Text style={styles.guideText}>
              Ajoutez vos factures (loyer, électricité, abonnements…) avec leur montant et date d'échéance.
            </Text>
            <Text style={styles.guideBullet}>
              • Filtrez par statut : payées, non-payées ou toutes
            </Text>
            <Text style={styles.guideBullet}>
              • La carte "Total à payer" résume vos factures en attente
            </Text>
            <Text style={styles.guideBullet}>
              • Payez une facture : une transaction est automatiquement créée dans le Compte Courant
            </Text>
            <Text style={styles.guideBullet}>
              • Activez la récurrence mensuelle : une nouvelle facture est automatiquement créée chaque mois après paiement
            </Text>

            <View style={styles.guideSectionRow}>
              <Ionicons name="notifications" size={20} color={colors.primary} />
              <Text style={styles.guideSectionTitle}>Notifications</Text>
            </View>
            <Text style={styles.guideText}>
              Personnalisez vos alertes dans Paramètres {'>'} Notifications.
            </Text>
            <Text style={styles.guideBullet}>
              • Rappel quotidien : recevez un résumé de vos entrées et sorties du mois à l'heure de votre choix (par défaut 19h)
            </Text>
            <Text style={styles.guideBullet}>
              • Rappel avant échéance : soyez notifié quelques jours avant la date d'une facture (réglable de 0 à 30 jours)
            </Text>
            <Text style={styles.guideBullet}>
              • Son des notifications : activez ou coupez le son des alertes
            </Text>

            <View style={styles.guideSectionRow}>
              <Ionicons name="trending-up" size={20} color={colors.primary} />
              <Text style={styles.guideSectionTitle}>Rapport</Text>
            </View>
            <Text style={styles.guideText}>
              Analysez vos finances mois par mois.
            </Text>
            <Text style={styles.guideBullet}>
              • Report du mois précédent + flux du mois = solde final
            </Text>
            <Text style={styles.guideBullet}>
              • Graphiques : barres (entrées/sorties par semaine), camembert (répartition par catégorie)
            </Text>
            <Text style={styles.guideBullet}>
              • Top 5 des plus grosses dépenses
            </Text>
            <Text style={styles.guideBullet}>
              • Évolution du solde Épargne
            </Text>
            <Text style={styles.guideBullet}>
              • Exportez un relevé mensuel en PDF (partage ou sauvegarde)
            </Text>

            <View style={styles.guideSectionRow}>
              <Ionicons name="settings" size={20} color={colors.primary} />
              <Text style={styles.guideSectionTitle}>Paramètres</Text>
            </View>
            <Text style={styles.guideText}>
              Personnalisez votre application.
            </Text>
            <Text style={styles.guideBullet}>
              • Thème : Clair, Sombre ou automatique (suit votre système)
            </Text>
            <Text style={styles.guideBullet}>
              • Compte : modifiez votre nom d'utilisateur ou votre mot de passe
            </Text>
            <Text style={styles.guideBullet}>
              • Catégories : ajoutez, modifiez ou supprimez des catégories (icône, couleur, type)
            </Text>
            <Text style={styles.guideBullet}>
              • Règles budgétaires : fixez un plafond de dépense par catégorie (mensuel ou hebdomadaire)
            </Text>
            <Text style={styles.guideBullet}>
              • Déconnexion ou réinitialisation complète des données
            </Text>

            <View style={styles.guideSectionRow}>
              <Ionicons name="lock-closed" size={20} color={colors.primary} />
              <Text style={styles.guideSectionTitle}>Données & confidentialité</Text>
            </View>
            <Text style={styles.guideText}>
              Mon Argent est 100 % hors-ligne : aucune donnée personnelle n'est transmise sur Internet. 
              Tout est stocké dans une base de données SQLite locale. Votre mot de passe est hashé en SHA-256 
              et reste uniquement sur votre appareil.
            </Text>

            <View style={{ height: 40 }} />
          </ScrollView>
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
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    stepperBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: c.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepperValue: {
      color: c.text,
      fontSize: 16,
      fontWeight: '600',
      minWidth: 24,
      textAlign: 'center',
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
    pwdRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 8,
    },
    modalInputPwd: {
      flex: 1,
      padding: 14,
      color: c.text,
      fontSize: 16,
    },
    eyeBtn: {
      padding: 10,
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
    guideOverlay: {
      flex: 1,
      backgroundColor: c.bg,
    },
    guideHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.surface,
    },
    guideTitle: {
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
    },
    guideContent: {
      padding: 20,
    },
    guideSectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 20,
      marginBottom: 8,
    },
    guideSectionTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
    },
    guideText: {
      color: c.textSec,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 8,
    },
    guideBullet: {
      color: c.textSec,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 4,
      paddingLeft: 16,
    },
  });
}
