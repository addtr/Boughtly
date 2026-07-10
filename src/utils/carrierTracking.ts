/**
 * Detect the shipping carrier from a tracking number's format and build the
 * URL of its tracking page. Formats are heuristics (carriers publish them):
 *
 *  - UPS:    "1Z" + 16 alphanumerics (1Z999AA10123456784)
 *  - Amazon: "TBA" + 12 digits (Amazon Logistics)
 *  - USPS:   20–22 digits starting with 9, or international "EC123456789US"
 *  - FedEx:  12 / 15 digits, or 20/22 digits starting with 96
 *  - DHL:    exactly 10 digits, or "JD"/"JJD" prefixes
 *
 * Anything unrecognized falls back to a web search for the number, which
 * every major carrier's page ranks for — so the button always goes somewhere
 * useful.
 */

export interface TrackingLink {
  carrier: string;
  url: string;
  /** False when we fell back to a search instead of a known carrier page */
  known: boolean;
}

export function trackingLink(rawNumber: string): TrackingLink | null {
  const n = rawNumber.replace(/\s+/g, '').toUpperCase();
  if (n.length < 8) return null;

  // UPS
  if (/^1Z[0-9A-Z]{16}$/.test(n)) {
    return {
      carrier: 'UPS',
      url: `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
      known: true,
    };
  }
  // Amazon Logistics
  if (/^TBA\d{12}$/.test(n)) {
    return {
      carrier: 'Amazon',
      url: `https://track.amazon.com/tracking/${encodeURIComponent(n)}`,
      known: true,
    };
  }
  // USPS international (EC123456789US) and domestic long-digit forms
  if (/^[A-Z]{2}\d{9}US$/.test(n)) {
    return {
      carrier: 'USPS',
      url: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
      known: true,
    };
  }
  if (/^\d+$/.test(n)) {
    // FedEx Ground 96-prefixed long forms take precedence over USPS's 9-prefix
    if ((n.length === 22 || n.length === 20) && n.startsWith('96')) {
      return {
        carrier: 'FedEx',
        url: `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
        known: true,
      };
    }
    if (n.length >= 20 && n.length <= 22 && n.startsWith('9')) {
      return {
        carrier: 'USPS',
        url: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
        known: true,
      };
    }
    if (n.length === 12 || n.length === 15) {
      return {
        carrier: 'FedEx',
        url: `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
        known: true,
      };
    }
    if (n.length === 10) {
      return {
        carrier: 'DHL',
        url: `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encodeURIComponent(n)}`,
        known: true,
      };
    }
  }
  // DHL courier prefixes
  if (/^JJ?D[0-9A-Z]{10,}$/.test(n)) {
    return {
      carrier: 'DHL',
      url: `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encodeURIComponent(n)}`,
      known: true,
    };
  }

  // Unknown format — a search reliably surfaces the right tracker.
  return {
    carrier: 'your carrier',
    url: `https://www.google.com/search?q=${encodeURIComponent(`track package ${n}`)}`,
    known: false,
  };
}
