export interface ColorPalette {
  bg: string;
  surface: string;
  card: string;
  text: string;
  textSec: string;
  textMuted: string;
  primary: string;
  epargne: string;
  danger: string;
  warning: string;
  border: string;
  overlay: string;
  success: string;
  entree: string;
  sortie: string;
  stockages: {
    espece: string;
    mobile_money: string;
    banque: string;
  };
}

export const CATEGORY_COLORS = [
  '#30D158',
  '#0A84FF',
  '#BF5AF2',
  '#FF9F0A',
  '#FF453A',
  '#5E5CE6',
  '#FF375F',
  '#64D2FF',
  '#FFD60A',
  '#FF6482',
  '#8E8E93',
  '#7C2D12',
];

export const colors: ColorPalette = {
  bg: '#000000',
  surface: '#1A1D28',
  card: '#121212',
  text: '#FFFFFF',
  textSec: '#A1A1AB',
  textMuted: '#636366',
  primary: '#2563EB',
  epargne: '#FF9F0A',
  danger: '#FF453A',
  warning: '#FF9F0A',
  border: '#1E2A3A',
  overlay: 'rgba(0,0,0,0.8)',
  success: '#30D158',
  entree: '#30D158',
  sortie: '#FF453A',
  stockages: {
    espece: '#30D158',
    mobile_money: '#FF9F0A',
    banque: '#0A84FF',
  },
};

export const lightColors: ColorPalette = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1C1C1E',
  textSec: '#8E8E93',
  textMuted: '#C7C7CC',
  primary: '#2563EB',
  epargne: '#FF9F0A',
  danger: '#FF453A',
  warning: '#FF9F0A',
  border: '#D1D1D6',
  overlay: 'rgba(0,0,0,0.5)',
  success: '#30D158',
  entree: '#30D158',
  sortie: '#FF453A',
  stockages: {
    espece: '#30D158',
    mobile_money: '#FF9F0A',
    banque: '#0A84FF',
  },
};
