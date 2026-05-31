import 'react-native';
import type { ReactNode } from 'react';

declare module '@react-native-picker/picker' {
  interface PickerProps<T> {
    children?: ReactNode;
  }
}
