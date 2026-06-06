# Mon_argent

## Stack

Expo SDK 54, Expo Router 6, TypeScript strict, all data in local SQLite (expo-sqlite v16 async). 100% offline.

## Commands

| Script | Actual command |
|---|---|
| `npm start` | `expo start` |
| `npm run android` | `expo run:android` (dev-client build) |
| `npm run ios` | `expo run:ios` (dev-client build) |
| `npm run web` | `expo start --web` |
| Type-check | `npx tsc --noEmit` |
| EAS APK preview | `eas build --platform android --profile preview` |
| EAS APK production | `eas build --platform android --profile production` |
| OTA update preview | `eas update --channel preview --message "description"` |
| OTA update production | `eas update --channel production --message "description"` |

## Project structure

```
database/db.ts              → lazy singleton getDb(), 7 tables (auto-CREATE)
database/userRepository.ts  → register/login/validateSession/logout
hooks/useSession.tsx        → SessionProvider context + useSession()
hooks/useTheme.tsx          → ThemeProvider context + useTheme()
hooks/use{Courant,Epargne,Factures,Rapport,Parametres}.ts → raw SQL in useCallback / standalone async fns
services/notifications.ts   → daily at 19:00 + overdue on foreground
app/_layout.tsx             → SessionProvider + ThemeProvider + AppState listener + OTA updater
app/(auth)/                 → login, register, initial-setup (Stack)
app/(tabs)/                 → 6 tabs: Accueil, Courant, Épargne, Rapport, Factures, Paramètres
```

## Data model (7 tables)

- `users` – username + SHA-256 hash (one user per device)
- `sessions` – token-based (stored in SecureStore key `session_token`)
- `courant_transactions` – type (`entree`/`sortie`), stockage (`espece`/`mobile_money`/`banque`), source (`manuel`/`facture`), optional `facture_id`
- `epargne_transactions` – type, montant, description, date
- `factures` – payee (boolean), optional `courant_transaction_id`
- `parametres` – key-value settings per user (UNIQUE user_id + cle)
- `regles_budget` – budget rules per category: montant_max + periode (`mensuel`/`hebdomadaire`)

## Key conventions

- **French locale** throughout; currency = Ariary via `formatAr()` with space-separated thousands
- **Dark theme** default; preference persisted in SecureStore key `theme_preference`; follows system scheme
- **3 wallets** in Compte Courant: `espece`, `mobile_money`, `banque` — enum `StockageType`
- **No external state library** — React Context + raw SQL hooks
- **Data loading** on screen focus via `useFocusEffect`; pull-to-refresh via `RefreshControl`
- **Modal bottom sheets** for all forms (bottom-up animation)
- **Component styling:** `createStyles(c: Record<string, any>)` factory called with `useMemo(…)`, receives palette from `useTheme()`
- **Bill payment flow:** `payerFacture()` creates a `courant_transaction` (source=`facture`, links `facture_id`), then marks facture as paid
- **Wallet transfer:** creates a `sortie` on source + `entree` on destination wallet; Courant→Épargne uses same pair pattern
- **Categories** defined as const arrays with icon names in `constants/categories.ts`
- **SecureStore keys:** `session_token` (auth), `theme_preference` (dark/light/system), `setup_done` (post-registration wizard flag)
- **`expo-sqlite` v16 async API:** `db.runAsync()`, `db.getFirstAsync()`, `db.getAllAsync()` — never use the old synchronous `exec()` or `transaction()` patterns
- **`resetDatabase()`** in `database/db.ts` drops all 7 tables and re-creates them (dev reset)

## Setup quirks

- `.npmrc` sets `legacy-peer-deps=true` — use `npm install` not `npm ci`
- AGENTS.md and CLAUDE.md are **gitignored** (see `.gitignore`)
- **No tests, no linter, no CI** — type-check via `npx tsc --noEmit` is the only quality gate
- `expo start` runs in Expo Go (SDK 54 compatible); `expo run:android`/`expo run:ios` produce dev-client builds
- App entrypoint via `expo-router/entry` in package.json `main`
- EAS project owner set to `tsitsito` in `app.json` — must be logged into that account (`npx eas login`) for `eas build` / `eas update`
- Uses `expo-crypto` SHA-256 (not bcrypt/scrypt) for password hashing
