# Backend roadmap (deferred, server-dependent work)

Boughtly is intentionally **local-only** today — no server, all data on-device.
That's great for privacy and shipping fast, but a handful of features can't be
finished without a backend. This doc collects everything that's waiting on that
so it isn't lost. None of it blocks the first App Store release.

Suggested stack when the time comes: a managed backend (**Supabase** fits this
Expo app well — Postgres + auth + edge functions, generous free tier) or
Firebase. RevenueCat can front Plus billing (see PLUS_SETUP.md).

## 1. Real accounts + cross-device sign-in
**Why it needs a backend:** the Profile screen saves name/email/phone/password
on-device only, so you can't sign in on another phone and see your data.
**Build:** email/password (or Sign in with Apple) auth; store each user's items,
subscriptions, and watches server-side; pull them down on login.
**Touches:** `ProfileScreen`, `WelcomeScreen`, `AppStateContext` (swap local
persistence for synced reads/writes).

## 2. Cloud backup & sync (Plus perk, "coming soon")
**Why:** the paywall advertises this; it depends on #1.
**Build:** on change, mirror local data to the user's account; on a new device,
restore automatically. Until then, "Back up my data" (manual export) is the
free stopgap.

## 3. Push-based recall alerts (upgrade to the Plus recall feature)
**Why it needs a backend:** iOS can't run reliable always-on background checks.
Today the recall sweep only runs when the app is opened (Plus-gated).
**Build:** a scheduled server job checks each user's tracked items against the
CPSC recall feed and sends a **real push notification** the moment a match
appears — even with the app closed.
**Touches:** move `checkAllItemsForRecalls` logic server-side; add push tokens
(expo-notifications push) per device; keep the in-app check as a fallback.

## 4. Automatic background price checks (the price-alert automation)
**Why:** same background limitation. Today Boughtly *reminds* the user to price-
check; it can't fetch prices on its own (no free price API, and no background
runtime).
**Build:** a server job re-checks watched items / return-window items against a
price source and pushes "it dropped" alerts. Needs a price data source
(affiliate feed or a paid API) — revisit alongside affiliate monetization.

## 5. Subscription auto-discovery
**Why it needs a backend:** finding a user's existing subscriptions requires
bank-transaction access (**Plaid**) or Gmail receipt scanning — both need a
server holding secrets and doing the parsing (Gmail's restricted scope also
needs a Google security review).
**Build:** "Connect a bank" flow → Plaid `/transactions/recurring/get` →
surface detected subscriptions in the existing tracker for the user to confirm.
Start in Plaid's free sandbox.

## Rough order
1 (accounts) unlocks 2 (sync). 3 and 4 are independent server jobs that can
come after auth exists. 5 (Plaid) is the biggest lift and most sensitive —
do it last, once there's a reason to.
