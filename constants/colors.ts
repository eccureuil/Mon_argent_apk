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
  bg: '#0D0D0D',
  surface: '#1A1A1A',
  card: '#222222',
  text: '#FFFFFF',
  textSec: '#9E9E9E',
  textMuted: '#666666',
  primary: '#4CAF50',
  primaryLight: '#66BB6A',
  epargne: '#2196F3',
  epargneLight: '#42A5F5',
  danger: '#F44336',
  dangerLight: '#EF5350',
  warning: '#FF9800',
  border: '#2C2C2C',
  overlay: 'rgba(0,0,0,0.7)',
  success: '#66BB6A',
  entree: '#4CAF50',
  sortie: '#F44336',
  stockages: {
    espece: '#8BC34A',
    mobile_money: '#FF9800',
    banque: '#2196F3',
  },
  categories: {
    Salaire: '#4CAF50',
    Freelance: '#2196F3',
    Remboursement: '#9C27B0',
    Vente: '#FF9800',
    Alimentation: '#FF5722',
    Transport: '#795548',
    Logement: '#607D8B',
    Santé: '#F44336',
    Loisirs: '#E91E63',
    Facture: '#FF9800',
    Loyer: '#607D8B',
    Électricité: '#FFC107',
    Eau: '#03A9F4',
    Internet: '#9C27B0',
    Abonnement: '#673AB7',
    Assurance: '#795548',
    Impôt: '#F44336',
    Autre: '#9E9E9E',
  },
};

export const lightColors: ColorPalette = {
  bg: '#F5F5F5',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSec: '#757575',
  textMuted: '#9E9E9E',
  primary: '#4CAF50',
  primaryLight: '#66BB6A',
  epargne: '#2196F3',
  epargneLight: '#42A5F5',
  danger: '#F44336',
  dangerLight: '#EF5350',
  warning: '#FF9800',
  border: '#E0E0E0',
  overlay: 'rgba(0,0,0,0.5)',
  success: '#66BB6A',
  entree: '#4CAF50',
  sortie: '#F44336',
  stockages: {
    espece: '#8BC34A',
    mobile_money: '#FF9800',
    banque: '#2196F3',
  },
  categories: {
    Salaire: '#4CAF50',
    Freelance: '#2196F3',
    Remboursement: '#9C27B0',
    Vente: '#FF9800',
    Alimentation: '#FF5722',
    Transport: '#795548',
    Logement: '#607D8B',
    Santé: '#F44336',
    Loisirs: '#E91E63',
    Facture: '#FF9800',
    Loyer: '#607D8B',
    Électricité: '#FFC107',
    Eau: '#03A9F4',
    Internet: '#9C27B0',
    Abonnement: '#673AB7',
    Assurance: '#795548',
    Impôt: '#F44336',
    Autre: '#9E9E9E',
  },
};
