import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  confirmColor: confirmColorProp,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const confirmColor = confirmColorProp ?? colors.danger;
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dialog}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
              {children && <View style={styles.children}>{children}</View>}
              <View style={styles.buttons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onCancel}
                >
                  <Text style={styles.cancelText}>{cancelLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: confirmColor }]}
                  onPress={onConfirm}
                >
                  <Text style={styles.confirmText}>{confirmLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function createStyles(c: Record<string, any>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    dialog: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 340,
    },
    title: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
    },
    message: {
      color: c.textSec,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    children: {
      marginBottom: 16,
    },
    buttons: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    cancelText: {
      color: c.textSec,
      fontSize: 14,
      fontWeight: '600',
    },
    confirmText: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
