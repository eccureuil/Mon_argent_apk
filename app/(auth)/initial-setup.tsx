import { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { api } from '../../services/api';
import { useSession } from '../../hooks/useSession';
import type { StockageType } from '../../types';
import type { ColorPalette } from '../../constants/colors';

const stockageFields: { key: StockageType; label: string; icon: string }[] = [
  { key: 'espece', label: 'Espèces', icon: 'cash' },
  { key: 'mobile_money', label: 'Mobile Money', icon: 'phone-portrait' },
  { key: 'banque', label: 'Banque', icon: 'business' },
];

/** Initial setup wizard for entering starting balances after registration. */
export default function InitialSetupScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useSession();
  const insets = useSafeAreaInsets();
  const userId = user!.id;

  const [espece, setEspece] = useState('');
  const [mobileMoney, setMobileMoney] = useState('');
  const [banque, setBanque] = useState('');
  const [epargne, setEpargne] = useState('');
  const [saving, setSaving] = useState(false);

  const mobileRef = useRef<TextInput>(null);
  const banqueRef = useRef<TextInput>(null);
  const epargneRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    Keyboard.dismiss();

    const values = [
      { stockage: 'espece' as StockageType, montant: parseFloat(espece) || 0 },
      { stockage: 'mobile_money' as StockageType, montant: parseFloat(mobileMoney) || 0 },
      { stockage: 'banque' as StockageType, montant: parseFloat(banque) || 0 },
    ];

    const epargneMontant = parseFloat(epargne) || 0;
    const totalCourant = values.reduce((sum, v) => sum + v.montant, 0);

    if (totalCourant === 0 && epargneMontant === 0) {
      Alert.alert('Solde initial', 'Entrez au moins un montant pour commencer');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/initial-setup', {
        espece: values[0].montant,
        mobile_money: values[1].montant,
        banque: values[2].montant,
        epargne: epargneMontant,
      });

      if (!res.ok) throw new Error(res.data.error);

      await SecureStore.setItemAsync('setup_done', 'true');
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de sauvegarder le solde initial');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Ionicons name="cash-outline" size={64} color={colors.primary} style={styles.logo} />
          <Text style={styles.title}>Bienvenue !</Text>
          <Text style={styles.subtitle}>
            Entrez vos soldes initiaux pour commencer
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compte Courant</Text>

            {stockageFields.map((s, i) => (
              <View key={s.key} style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Ionicons
                    name={s.icon as keyof typeof Ionicons.glyphMap}
                    size={16}
                    color={(colors.stockages as Record<string, string>)[s.key]}
                  />
                  <Text style={styles.label}>{s.label}</Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  value={
                    s.key === 'espece'
                      ? espece
                      : s.key === 'mobile_money'
                      ? mobileMoney
                      : banque
                  }
                  onChangeText={(t) => {
                    if (s.key === 'espece') setEspece(t);
                    else if (s.key === 'mobile_money') setMobileMoney(t);
                    else setBanque(t);
                  }}
                  keyboardType="numeric"
                  returnKeyType={i < stockageFields.length - 1 ? 'next' : 'done'}
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    if (i === 0) mobileRef.current?.focus();
                    else if (i === 1) banqueRef.current?.focus();
                    else Keyboard.dismiss();
                  }}
                  ref={s.key === 'mobile_money' ? mobileRef : s.key === 'banque' ? banqueRef : undefined}
                />
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compte Épargne</Text>
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="wallet" size={16} color={colors.epargne} />
                <Text style={styles.label}>Solde initial Épargne</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                value={epargne}
                onChangeText={setEpargne}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                ref={epargneRef}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.buttonText}>Commencer</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

function createStyles(c: ColorPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    scroll: {
      paddingHorizontal: 24,
    },
    logo: {
      fontSize: 56,
      textAlign: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: c.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      color: c.textSec,
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 12,
    },
    inputGroup: {
      gap: 6,
      marginBottom: 12,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    label: {
      color: c.textSec,
      fontSize: 13,
      fontWeight: '500',
    },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 14,
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
    },
    button: {
      backgroundColor: c.primary,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
