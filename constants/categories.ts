export const courantCategories = [
  { value: 'Salaire', label: 'Salaire', icon: 'briefcase' },
  { value: 'Freelance', label: 'Freelance', icon: 'laptop' },
  { value: 'Remboursement', label: 'Remboursement', icon: 'cash-back' },
  { value: 'Vente', label: 'Vente', icon: 'cart' },
  { value: 'Alimentation', label: 'Alimentation', icon: 'restaurant' },
  { value: 'Transport', label: 'Transport', icon: 'car' },
  { value: 'Logement', label: 'Logement', icon: 'home' },
  { value: 'Santé', label: 'Santé', icon: 'medkit' },
  { value: 'Loisirs', label: 'Loisirs', icon: 'game-controller' },
  { value: 'Facture', label: 'Facture', icon: 'document-text' },
  { value: 'Transfert', label: 'Transfert', icon: 'swap-horizontal' },
  { value: 'Autre', label: 'Autre', icon: 'ellipsis-horizontal' },
] as const;

export const factureCategories = [
  { value: 'Loyer', label: 'Loyer', icon: 'home' },
  { value: 'Électricité', label: 'Électricité', icon: 'flash' },
  { value: 'Eau', label: 'Eau', icon: 'water' },
  { value: 'Internet', label: 'Internet', icon: 'globe' },
  { value: 'Abonnement', label: 'Abonnement', icon: 'newspaper' },
  { value: 'Assurance', label: 'Assurance', icon: 'shield-checkmark' },
  { value: 'Impôt', label: 'Impôt', icon: 'calculator' },
  { value: 'Autre', label: 'Autre', icon: 'ellipsis-horizontal' },
] as const;

export const stockages = [
  { value: 'espece' as const, label: 'Espèces', icon: 'cash' },
  { value: 'mobile_money' as const, label: 'Mobile Money', icon: 'phone-portrait' },
  { value: 'banque' as const, label: 'Banque', icon: 'business' },
];

export const stockageLabels: Record<string, string> = {
  espece: 'Espèces',
  mobile_money: 'Mobile Money',
  banque: 'Banque',
};
