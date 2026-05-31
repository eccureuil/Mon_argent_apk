# Mon_argent — Complete Application

## Stack

Expo SDK 54 (latest on App Store), Expo Router, TypeScript strict, local SQLite (expo-sqlite v16 async API), all data on-device.

## Architecture

```
constants/   → colors.ts, categories.ts
types/       → index.ts (9 interfaces), picker.d.ts (type fix)
utils/       → format.ts (formatAr, formatDate, formatDateTime, etc.)
database/    → db.ts (4 tables), userRepository.ts (auth CRUD)
hooks/       → useSession.tsx, useCourant.ts, useEpargne.ts, useFactures.ts, useRapport.ts
components/  → 8 reusable components (SoldeCard, TransactionItem, FactureCard, etc.)
services/    → notifications.ts (daily summary + overdue bills)
app/
├── _layout.tsx           (SessionProvider + AppState notification manager)
├── (auth)/
│   ├── _layout.tsx       (session guard → redirect to tabs)
│   ├── login.tsx
│   └── register.tsx
└── (tabs)/
    ├── _layout.tsx       (5 tabs: Accueil, Courant, Épargne, Rapport, Factures)
    ├── index.tsx         (Dashboard: soldes, charts, transfert, urgent bills)
    ├── courant.tsx       (3 sous-tabs: Espèces/Mobile Money/Banque)
    ├── epargne.tsx       (Épargne CRUD)
    ├── factures.tsx      (CRUD + payment → auto-expense in Courant)
    └── rapport.tsx       (analytics with Bar/Pie/Line charts)
```

## Scripts

```
start   → expo start
android → expo start --android
ios     → expo start --ios
web     → expo start --web
```

Type-check: `npx tsc --noEmit`

## Notes

- 100% offline, dark theme, French locale
- Currency: Ariary (Ar) via `formatAr()`
- Auth: SHA-256 via expo-crypto, sessions via expo-secure-store
- 3 independent wallets (Espèces/Mobile Money/Banque) within Compte Courant
- Bill payment auto-creates expense in Courant
- Daily notification at 19:00 + overdue bill alerts
- Compatible with Expo Go SDK 54
