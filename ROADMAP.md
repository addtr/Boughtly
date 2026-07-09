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

- Dark mode — full theme refactor; every screen imports the static `colors`
  token object from `src/theme/theme.ts`, so this needs a theme context
  threaded through all screens. Do as a dedicated pass.
- Undo / trash for deletes — soft-delete with a brief Undo instead of
  instant permanent removal.
- Onboarding permission priming — explain notifications/camera before the
  iOS system prompt so users don't reflexively deny.
- Barcode scan to auto-fill item name/brand.
- Bring-your-own Claude API key UI for premium OCR (the `claudeApiKey`
  setting already exists in `AppSettings`, no UI sets it).
- Extended-warranty / protection-plan tracking (AppleCare, Asurion, store
  plans) — provider, coverage end, claim contact, deductible.
- Attach warranty documents/manuals (PDFs) to an item.
- Spending analytics — monthly spend, by store, by tag, trend chart.
