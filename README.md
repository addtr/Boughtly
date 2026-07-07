# Boughtly

**The right price before. The right protection after.**

Boughtly helps everyday people protect the money they spend. Add anything you buy —
by snapping the receipt or entering it manually — and Boughtly tracks the return-window
deadline and warranty expiration for that item, reminding you before either runs out.

## Status: Phase 1 complete ✅

The full user flow works end to end:

- **Dashboard** — all tracked items sorted by the nearest deadline, each with a
  Countdown Ring showing days left; empty state for first-time users; FAB to add items.
- **Add Item** — attach a receipt photo (camera or library) and enter details manually;
  preset chips + custom input for warranty length (90 days / 1 yr / 2 yrs) and return
  window (14 / 30 / 60 / 90 days). Also doubles as the Edit screen.
- **Item Detail** — both deadlines with countdown rings, receipt image, notes,
  edit and delete.
- **Settings** — notification toggle and reminder-timing preferences, bulk item
  management, about/version.
- **Local notifications** — reminders scheduled on save (default: 3 days before the
  return window closes, 7 days before the warranty expires), cancelled/rescheduled on
  edit, delete, and settings changes.
- **Storage** — everything is stored locally on-device (AsyncStorage); receipt photos
  are copied into the app's documents directory.

- **Receipt auto-reading (OCR)** — free and on-device by default: ML Kit text
  recognition reads the receipt photo on the phone (no account, no network, no cost)
  and a heuristic parser extracts item, store, total, and date to prefill the form —
  never overwriting anything the user already typed. Requires a development build
  (native module; in Expo Go scanning just saves the photo and entry stays manual).
  A Claude-vision extraction path exists in the code (`src/services/receiptOcr.ts`)
  but is dormant — reserved for a future premium bundle; no UI exposes it.
- **Native date picker** on iOS/Android for the purchase date (text input on web).
- **Countdown Ring polish** — eased fill animation and a smooth blue→coral color
  cross-fade when an item becomes urgent.

- **Brand identity** — custom app icon (bag/receipt/shield mark), Android adaptive
  icons, splash screen, favicon, and notification icon, all generated as vector art
  (`scratchpad` script recreatable; palette from the design tokens).
- **Finishing touches** — tap a reminder to open that item; full-screen zoomable
  receipt viewer; dashboard search (appears at 4+ items) and a "Protection ended"
  section for fully-expired items; "N items protected · $X covered" summary;
  notification-permission feedback; export-data (share as JSON text) and
  delete-all-items in Settings; future purchase dates rejected.

Price tracking, paperwork automation, accounts, and cloud sync are future phases and
intentionally out of scope.

## Tech stack

- [Expo](https://expo.dev) SDK 57 (React Native + TypeScript)
- React Navigation (native stack)
- AsyncStorage for local persistence
- expo-notifications for local reminders
- expo-image-picker + expo-file-system for receipt photos
- react-native-svg for the Countdown Ring
- Sora (display) + Inter (body) bundled via `@expo-google-fonts`

## Running it

```bash
npm install
npx expo start
```

Then press `i` / `a` for a simulator, or scan the QR code with Expo Go on a device.
(Notifications and camera need a real device or dev build to fully test.)

### iOS device build (the chosen path for receipt scanning)

Receipt auto-reading uses a native module, so it doesn't run in Expo Go. The plan
for this project: build locally on a Mac with a **free** Apple ID (no $99 account
until App Store launch).

One-time: install Xcode (App Store), sign into Xcode → Settings → Accounts with an
Apple ID, `brew install cocoapods`. Then, with the iPhone plugged in:

```bash
npx expo run:ios --device
```

If signing errors: open `ios/Boughtly.xcworkspace`, Signing & Capabilities →
"Automatically manage signing" → select the Personal Team, re-run. On the phone,
trust the developer profile (Settings → General → VPN & Device Management) and
enable Developer Mode. Free-account installs expire after 7 days — re-run the
command to refresh. Day-to-day dev is still just `npx expo start`.

## Project structure

```
App.tsx                      # fonts, providers, navigation
src/
  theme/theme.ts             # design tokens (colors, type, spacing, shadows)
  types/item.ts              # TrackedItem + settings models, presets
  utils/dates.ts             # date math, deadline calculation, formatting
  store/AppStateContext.tsx  # items + settings state, AsyncStorage persistence
  notifications/             # reminder scheduling/cancellation
  components/                # CountdownRing, ItemCard, shared UI primitives
  screens/                   # Dashboard, AddItem, ItemDetail, Settings
```
