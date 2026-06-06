export interface ColorPalette {
  bg: string;
  surface: string;
  card: string;
  text: string;
  textSec: string;
  textMuted: string;
  primary: string;
  primaryLight: string;
  epargne: string;
  epargneLight: string;
  danger: string;
  dangerLight: string;
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
  categories: Record<string, string>;
}

export const colors: ColorPalette = {
  bg: '#000000',
  surface: '#1A1D28',
  card: '#121212',
  text: '#FFFFFF',
  textSec: '#A1A1AB',
  textMuted: '#636366',
  primary: '#2563EB',
  primaryLight: '#3B82F6',
  epargne: '#FF9F0A',
  epargneLight: '#FFBB3B',
  danger: '#FF453A',
  dangerLight: '#FF6961',
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
  categories: {
    Salaire: '#30D158',
    Freelance: '#0A84FF',
    Remboursement: '#BF5AF2',
    Vente: '#FF9F0A',
    Alimentation: '#FF453A',
    Transport: '#8E8E93',
    Logement: '#5E5CE6',
    Santé: '#FF375F',
    Loisirs: '#FF6482',
    Facture: '#FF9F0A',
    Loyer: '#5E5CE6',
    Électricité: '#FFD60A',
    Eau: '#64D2FF',
    Internet: '#BF5AF2',
    Abonnement: '#7C2D12',
    Assurance: '#8E8E93',
    Impôt: '#FF453A',
    Autre: '#636366',
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
  primaryLight: '#3B82F6',
  epargne: '#FF9F0A',
  epargneLight: '#FFBB3B',
  danger: '#FF453A',
  dangerLight: '#FF6961',
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
  categories: {
    Salaire: '#30D158',
    Freelance: '#0A84FF',
    Remboursement: '#BF5AF2',
    Vente: '#FF9F0A',
    Alimentation: '#FF453A',
    Transport: '#8E8E93',
    Logement: '#5E5CE6',
    Santé: '#FF375F',
    Loisirs: '#FF6482',
    Facture: '#FF9F0A',
    Loyer: '#5E5CE6',
    Électricité: '#FFD60A',
    Eau: '#64D2FF',
    Internet: '#BF5AF2',
    Abonnement: '#7C2D12',
    Assurance: '#8E8E93',
    Impôt: '#FF453A',
    Autre: '#636366',
  },
};
