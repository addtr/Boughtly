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

### Share extension — "Share to Boughtly"
From Mail / Photos / Safari / Files: share sheet → Boughtly, receipt lands
in the app already parsed. Needs a native share-extension target (Expo
config plugins: `expo-share-intent` or `expo-share-extension` + prebuild).
Cheap to wire: the app already ingests images (OCR pipeline via
`handleExtracted`), text (paste parser), and PDFs (document attachments) —
the extension just hands one of those in via the App Group / URL scheme.
Highest-impact dev-build feature after ML Kit OCR.

### Email-in address (forward receipts to you@…)
Forward an order-confirmation email; it appears in the app automatically.
NOT an Xcode feature — needs the backend: an inbound-mail service
(Mailgun/Postmark/Cloudflare Email Workers) + accounts + push/sync, so it
rides on the cloud-sync milestone. The paste parser already handles order
email text, so parsing is done; this is delivery plumbing.

### In-app purchases (Boughtly Plus)
Freemium scaffold can be built in Expo Go (isPremium flag, paywall screen,
feature gates), but real payments need StoreKit → RevenueCat at dev-build
time. Agreed pricing structure: $5.99/mo (decoy) · $39.99/yr (hero, "save
44%") · $79.99 lifetime. Gates: AI receipt scanning, unlimited items &
watches, price-adjustment alerts, insights/recap, multi-page receipts +
attachments, CSV. Keep free: core scan/track/remind loop, backup/restore,
app lock, warranty claim assistant.

## Also parked (buildable in Expo Go, not yet done)

- Bring-your-own Claude API key UI for premium OCR (the `claudeApiKey`
  setting already exists in `AppSettings`, no UI sets it).
- Real auth — the Welcome screen's create-account/sign-in stores a local
  profile (`accountName`/`accountEmail` in settings); swap in server auth
  when cloud sync lands.

## Done since this file was created

- ~~Dark mode~~ (live theme switching: System / Light / Dark in Settings,
  applies instantly via ThemeContext)
- ~~Undo for deletes~~
- ~~Onboarding permission priming~~
- ~~Barcode scan to auto-fill~~ (UPCitemdb + Open Food Facts)
- ~~Protection-plan tracking~~
- ~~Document attachments~~
- ~~Spending analytics~~ (Insights screen)
- ~~Welcome / account screen~~ (local profile)
