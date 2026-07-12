/**
 * Resolves a subscription name to the page where you cancel/manage it.
 *
 * Like returnUrl.ts: a service gets a direct `cancelUrl` only when it's a
 * stable, canonical manage/cancel page (many redirect to login first — that's
 * expected and correct, since that IS the cancel path). Anything unrecognized
 * opens a site-pinned "how to cancel" search that always lands somewhere
 * useful and can never 404.
 *
 * Note: subscriptions bought through the App Store (a lot of them) can only be
 * cancelled in iOS Settings → your name → Subscriptions. resolveCancelPage
 * flags those so the UI can tell the user.
 */

interface CancelSite {
  /** Lowercased fragments matched (whole-word-ish) against the typed name */
  match: string[];
  label: string;
  domain: string;
  /** Direct manage/cancel page — canonical, stable URLs only */
  cancelUrl?: string;
  /** True when it's typically managed via the Apple App Store subscription list */
  appStore?: boolean;
}

function howToCancel(domain: string, label: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(
    `how to cancel ${label} subscription site:${domain}`
  )}`;
}

// More specific names before general ones they contain.
const CANCEL_SITES: CancelSite[] = [
  // ── Streaming video ──
  { match: ['netflix'], label: 'Netflix', domain: 'netflix.com', cancelUrl: 'https://www.netflix.com/cancelplan' },
  { match: ['disney+', 'disney plus', 'disneyplus', 'disney'], label: 'Disney+', domain: 'disneyplus.com', cancelUrl: 'https://www.disneyplus.com/account/subscription' },
  { match: ['hulu'], label: 'Hulu', domain: 'hulu.com', cancelUrl: 'https://secure.hulu.com/account' },
  { match: ['hbo max', 'hbomax', 'max'], label: 'Max', domain: 'max.com', cancelUrl: 'https://www.max.com/account' },
  { match: ['paramount+', 'paramount plus', 'paramount'], label: 'Paramount+', domain: 'paramountplus.com', cancelUrl: 'https://www.paramountplus.com/account/' },
  { match: ['peacock'], label: 'Peacock', domain: 'peacocktv.com' },
  { match: ['apple tv+', 'apple tv', 'appletv'], label: 'Apple TV+', domain: 'apple.com', appStore: true },
  { match: ['youtube premium', 'youtube tv', 'youtube'], label: 'YouTube', domain: 'youtube.com', cancelUrl: 'https://www.youtube.com/paid_memberships' },
  { match: ['sling'], label: 'Sling TV', domain: 'sling.com' },
  { match: ['fubo', 'fubotv'], label: 'Fubo', domain: 'fubo.tv', cancelUrl: 'https://www.fubo.tv/account' },
  { match: ['starz'], label: 'Starz', domain: 'starz.com' },
  { match: ['showtime'], label: 'Showtime', domain: 'showtime.com' },
  { match: ['crunchyroll'], label: 'Crunchyroll', domain: 'crunchyroll.com' },
  { match: ['espn+', 'espn plus', 'espn'], label: 'ESPN+', domain: 'espn.com' },

  // ── Music / audio ──
  { match: ['spotify'], label: 'Spotify', domain: 'spotify.com', cancelUrl: 'https://www.spotify.com/account/subscription/' },
  { match: ['apple music'], label: 'Apple Music', domain: 'apple.com', appStore: true },
  { match: ['youtube music'], label: 'YouTube Music', domain: 'youtube.com', cancelUrl: 'https://www.youtube.com/paid_memberships' },
  { match: ['pandora'], label: 'Pandora', domain: 'pandora.com', cancelUrl: 'https://www.pandora.com/account/subscription' },
  { match: ['tidal'], label: 'Tidal', domain: 'tidal.com' },
  { match: ['siriusxm', 'sirius'], label: 'SiriusXM', domain: 'siriusxm.com', cancelUrl: 'https://www.siriusxm.com/account' },
  { match: ['audible'], label: 'Audible', domain: 'audible.com' },

  // ── Shopping / memberships ──
  { match: ['amazon prime', 'prime'], label: 'Amazon Prime', domain: 'amazon.com', cancelUrl: 'https://www.amazon.com/gp/primecentral' },
  { match: ['walmart+', 'walmart plus'], label: 'Walmart+', domain: 'walmart.com' },
  { match: ['costco'], label: 'Costco', domain: 'costco.com' },
  { match: ["sam's club", 'sams club'], label: "Sam's Club", domain: 'samsclub.com' },
  { match: ['instacart'], label: 'Instacart', domain: 'instacart.com' },
  { match: ['doordash', 'dashpass'], label: 'DoorDash', domain: 'doordash.com' },
  { match: ['uber one', 'uber'], label: 'Uber One', domain: 'uber.com' },

  // ── Productivity / cloud / news ──
  { match: ['adobe', 'creative cloud'], label: 'Adobe', domain: 'adobe.com', cancelUrl: 'https://account.adobe.com/plans' },
  { match: ['microsoft 365', 'office 365', 'microsoft', 'xbox game pass', 'game pass'], label: 'Microsoft', domain: 'microsoft.com' },
  { match: ['google one', 'google storage'], label: 'Google One', domain: 'google.com', cancelUrl: 'https://one.google.com/settings' },
  { match: ['dropbox'], label: 'Dropbox', domain: 'dropbox.com', cancelUrl: 'https://www.dropbox.com/account/plan' },
  { match: ['icloud', 'icloud+'], label: 'iCloud+', domain: 'apple.com', appStore: true },
  { match: ['notion'], label: 'Notion', domain: 'notion.so', cancelUrl: 'https://www.notion.so/my-integrations' },
  { match: ['chatgpt', 'openai'], label: 'ChatGPT', domain: 'openai.com' },
  { match: ['new york times', 'nytimes', 'nyt'], label: 'NY Times', domain: 'nytimes.com', cancelUrl: 'https://www.nytimes.com/subscription/manage' },
  { match: ['wall street journal', 'wsj'], label: 'WSJ', domain: 'wsj.com', cancelUrl: 'https://customercenter.wsj.com/' },
  { match: ['linkedin premium', 'linkedin'], label: 'LinkedIn', domain: 'linkedin.com', cancelUrl: 'https://www.linkedin.com/premium/manage/' },

  // ── Fitness / wellness ──
  { match: ['planet fitness'], label: 'Planet Fitness', domain: 'planetfitness.com' },
  { match: ['peloton'], label: 'Peloton', domain: 'onepeloton.com' },
  { match: ['equinox'], label: 'Equinox', domain: 'equinox.com' },
  { match: ['la fitness'], label: 'LA Fitness', domain: 'lafitness.com' },
  { match: ['classpass'], label: 'ClassPass', domain: 'classpass.com' },

  // ── Games / misc ──
  { match: ['playstation plus', 'ps plus', 'playstation'], label: 'PlayStation', domain: 'playstation.com' },
  { match: ['nintendo switch online', 'nintendo'], label: 'Nintendo', domain: 'nintendo.com' },
];

function contains(haystack: string, fragment: string): boolean {
  return haystack.includes(fragment);
}

export interface ResolvedCancelPage {
  url: string;
  /** True when a known service matched */
  known: boolean;
  label: string;
  /** Managed via the iOS App Store subscriptions list */
  appStore: boolean;
}

/** How-to-cancel search for an unrecognized service name. */
export function cancelSearchUrl(name: string): string {
  const q = `how to cancel ${name.trim()} subscription`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** Resolve where to cancel/manage a subscription by its name. */
export function resolveCancelPage(name: string): ResolvedCancelPage {
  const s = name.trim().toLowerCase();
  if (s.length >= 2) {
    for (const site of CANCEL_SITES) {
      if (site.match.some((m) => contains(s, m))) {
        return {
          url: site.cancelUrl ?? howToCancel(site.domain, site.label),
          known: true,
          label: site.label,
          appStore: !!site.appStore,
        };
      }
    }
  }
  return { url: cancelSearchUrl(name), known: false, label: name.trim(), appStore: false };
}
