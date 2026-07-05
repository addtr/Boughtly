# Boughtly

**The right price before. The right protection after.**

Boughtly helps everyday people protect the money they spend. Add anything you buy —
by snapping the receipt or entering it manually — and Boughtly tracks the return-window
deadline and warranty expiration for that item, reminding you before either runs out.

## Status: Pass 1 (working skeleton) ✅

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

**Not yet built (Pass 2):** receipt OCR (scan currently captures the photo; details are
entered manually), a native date picker for purchase date, ring polish/edge cases.
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
