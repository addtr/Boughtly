# Boughtly roadmap

Ideas parked for later, and what unlocks them.

## When the app moves to Xcode (dev build / standalone), revisit:

### Cloud sync / accounts
Real cross-device backup beyond the manual export file. Needs a backend
(Firebase/Supabase or custom): user accounts, item/watch/return sync,
receipt-photo upload. Biggest step from "personal app" to "shippable
product." Design decisions to make at the time: auth method, storage cost
for receipt images, offline-first merge strategy (the local AsyncStorage
model already keys everything by generated ids, which helps).

### Home & lock-screen widget
Glanceable "next deadline" widget (return window closing / warranty ending)
without opening the app. iOS widgets are a native WidgetKit extension
target — impossible in Expo Go, requires a development build via
`expo prebuild` + Xcode (e.g. the `@bacons/apple-targets` or
`expo-apple-targets` route). Data handoff via an App Group shared container.

## Also parked (buildable in Expo Go, not yet done)

- Bring-your-own Claude API key UI for premium OCR (the `claudeApiKey`
  setting already exists in `AppSettings`, no UI sets it).
- Live dark-mode switching — the palette currently follows the system theme
  at app launch (tokens are baked into module-level StyleSheets); reacting to
  a mid-session theme change needs the full theme-context refactor.
- Real auth — the Welcome screen's create-account/sign-in stores a local
  profile (`accountName`/`accountEmail` in settings); swap in server auth
  when cloud sync lands.

## Done since this file was created

- ~~Dark mode~~ (system theme at launch)
- ~~Undo for deletes~~
- ~~Onboarding permission priming~~
- ~~Barcode scan to auto-fill~~ (UPCitemdb + Open Food Facts)
- ~~Protection-plan tracking~~
- ~~Document attachments~~
- ~~Spending analytics~~ (Insights screen)
- ~~Welcome / account screen~~ (local profile)
