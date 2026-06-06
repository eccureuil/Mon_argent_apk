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
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../../hooks/useTheme';
import { useSession } from '../../hooks/useSession';
import { CATEGORY_COLORS } from '../../constants/colors';
import {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
} from '../../hooks/useCategories';
import IconPicker from '../../components/IconPicker';
import type { UserCategory } from '../../types';

const TYPE_OPTIONS = [
  { value: 'entree', label: 'Entrée' },
  { value: 'sortie', label: 'Sortie' },
  { value: 'both', label: 'Les deux' },
  { value: 'facture', label: 'Facture' },
];

const FILTER_OPTIONS = [
  { value: '', label: 'Toutes' },
  { value: 'entree', label: 'Entrée' },
  { value: 'sortie', label: 'Sortie' },
  { value: 'facture', label: 'Facture' },
];

export default function CategoriesScreen() {
  const { colors } = useTheme();
  const { user } = useSession();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [filter, setFilter] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<UserCategory | null>(null);
  const [formLabel, setFormLabel] = useState('');
  const [formIcon, setFormIcon] = useState('ellipsis-horizontal');
  const [formColor, setFormColor] = useState(CATEGORY_COLORS[0]);
  const [formType, setFormType] = useState('both');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const cats = await getCategories(user.id);
    setCategories(cats);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (!filter) return categories;
    return categories.filter(c => c.type === filter || c.type === 'both');
  }, [categories, filter]);

  const openAdd = () => {
    setEditing(null);
    setFormLabel('');
    setFormIcon('ellipsis-horizontal');
    setFormColor(CATEGORY_COLORS[0]);
    setFormType('both');
    setModalVisible(true);
  };

  const openEdit = (cat: UserCategory) => {
    setEditing(cat);
    setFormLabel(cat.label);
    setFormIcon(cat.icon);
    setFormColor(cat.color);
    setFormType(cat.type);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formLabel.trim()) return;
    if (!user) return;
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, { label: formLabel.trim(), icon: formIcon, color: formColor, type: formType });
      } else {
        await addCategory(user.id, formLabel.trim(), formIcon, formType, formColor);
      }
      setModalVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (cat: UserCategory) => {
    if (!user) return;
    Alert.alert(
      'Supprimer',
      `Supprimer « ${cat.label} » ?\nLes transactions liées passeront en « Autre ».`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(user.id, cat.id);
            await load();
          },
        },
      ]
    );
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  const typeLabel = (t: string) => TYPE_OPTIONS.find(o => o.value === t)?.label ?? t;
  const typeColor = (t: string) => {
    switch (t) {
      case 'entree': return colors.entree;
      case 'sortie': return colors.sortie;
      case 'facture': return colors.epargne;
      default: return colors.textSec;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Catégories</Text>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {FILTER_OPTIONS.map((o) => (
            <TouchableOpacity
              key={o.value}
              style={[styles.filterChip, filter === o.value && styles.filterChipActive]}
              onPress={() => setFilter(o.value)}
            >
              <Text style={[styles.filterText, filter === o.value && styles.filterTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map((cat) => (
          <View key={cat.id} style={styles.card}>
            <View style={[styles.iconCircle, { backgroundColor: cat.color + '20' }]}>
              <Ionicons name={cat.icon as any} size={20} color={cat.color} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>{cat.label}</Text>
              <Text style={[styles.cardType, { color: typeColor(cat.type) }]}>
                {typeLabel(cat.type)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => openEdit(cat)} style={styles.actionBtn}>
              <Ionicons name="pencil" size={18} color={colors.textSec} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(cat)} style={styles.actionBtn}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ))}
        {filtered.length === 0 && (
          <Text style={styles.empty}>Aucune catégorie</Text>
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" statusBarTranslucent presentationStyle="overFullScreen">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.modal, { paddingTop: 32 }]}>
                <Text style={styles.modalTitle}>
                  {editing ? 'Modifier' : 'Nouvelle'} catégorie
                </Text>

                <Text style={styles.fieldLabel}>Nom</Text>
                <TextInput
                  style={styles.input}
                  value={formLabel}
                  onChangeText={setFormLabel}
                  placeholder="Ex: Courses"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.fieldLabel}>Icône</Text>
                <IconPicker selected={formIcon} onSelect={setFormIcon} />

                <Text style={styles.fieldLabel}>Couleur</Text>
                <View style={styles.colorRow}>
                  {CATEGORY_COLORS.map((color) => {
                    const selected = formColor === color;
                    return (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorCircle,
                          { backgroundColor: color },
                          selected && styles.colorCircleSelected,
                        ]}
                        onPress={() => setFormColor(color)}
                      >
                        {selected && (
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={formType}
                    onValueChange={setFormType}
                    style={styles.picker}
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <Picker.Item key={o.value} label={o.label} value={o.value} />
                    ))}
                  </Picker>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnCancel]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.btnCancelText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSave, !formLabel.trim() && styles.btnDisabled]}
                    onPress={handleSave}
                    disabled={!formLabel.trim() || saving}
                  >
                    <Text style={styles.btnSaveText}>{saving ? '...' : 'Enregistrer'}</Text>
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backBtn: {
      padding: 4,
    },
    title: {
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
      fontFamily: 'IBMPlexSans_700Bold',
    },
    addBtn: {
      padding: 4,
    },
    filterRow: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      flexGrow: 0,
    },
    filterChip: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    filterChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    filterText: {
      color: c.textSec,
      fontSize: 13,
      fontWeight: '500',
    },
    filterTextActive: {
      color: '#FFFFFF',
    },
    list: {
      flex: 1,
      paddingHorizontal: 16,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    iconCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    cardContent: {
      flex: 1,
    },
    cardLabel: {
      color: c.text,
      fontSize: 15,
      fontWeight: '600',
      fontFamily: 'IBMPlexSans_600SemiBold',
    },
    cardType: {
      fontSize: 12,
      fontWeight: '500',
      fontFamily: 'IBMPlexSans_500Medium',
      marginTop: 2,
    },
    actionBtn: {
      padding: 8,
    },
    empty: {
      color: c.textMuted,
      textAlign: 'center',
      marginTop: 60,
      fontSize: 15,
    },
    colorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    colorCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorCircleSelected: {
      borderColor: c.text,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      gap: 12,
    },
    modalTitle: {
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
      fontFamily: 'IBMPlexSans_700Bold',
      marginBottom: 4,
    },
    fieldLabel: {
      color: c.textSec,
      fontSize: 13,
      fontWeight: '500',
      fontFamily: 'IBMPlexSans_500Medium',
    },
    input: {
      backgroundColor: c.bg,
      borderRadius: 10,
      padding: 14,
      color: c.text,
      fontSize: 15,
      borderWidth: 1,
      borderColor: c.border,
    },
    pickerWrapper: {
      backgroundColor: c.bg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    picker: {
      color: c.text,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    btn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    btnCancel: {
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
    },
    btnCancelText: {
      color: c.textSec,
      fontSize: 15,
      fontWeight: '600',
    },
    btnSave: {
      backgroundColor: c.primary,
    },
    btnSaveText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },
    btnDisabled: {
      opacity: 0.5,
    },
  });
}
