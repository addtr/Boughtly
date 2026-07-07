import { PricePoint } from '../types/tracking';

/**
 * The honest deal-check. Works from prices the user has actually logged —
 * no scraped data, no guessing. Says clearly when there isn't enough history
 * to judge, and calls out the inflated-"original"-price trick when the math
 * doesn't add up.
 */

export interface DealVerdict {
  level: 'great' | 'good' | 'meh' | 'suspicious' | 'unknown';
  title: string;
  detail: string;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function analyzeDeal(history: PricePoint[], candidate: PricePoint): DealVerdict {
  const prior = history.filter((p) => p !== candidate).map((p) => p.price);
  const claimed = candidate.claimedOriginal;

  // Inflated-anchor check works even with little history
  if (claimed !== undefined) {
    if (prior.length > 0 && claimed > Math.max(...prior) * 1.05) {
      return {
        level: 'suspicious',
        title: 'That “original price” looks inflated',
        detail: `The store claims it was ${fmt(claimed)}, but you've never seen it above ${fmt(
          Math.max(...prior)
        )}. Judge the sale price on its own, not the discount.`,
      };
    }
    if (prior.length === 0 && claimed >= candidate.price * 2.5) {
      return {
        level: 'suspicious',
        title: 'Huge discount, no history',
        detail: `A ${Math.round(
          (1 - candidate.price / claimed) * 100
        )}% discount is a classic inflated-price tactic. Log a few real prices before trusting it.`,
      };
    }
  }

  if (prior.length < 3) {
    return {
      level: 'unknown',
      title: 'Not enough history yet',
      detail:
        'Log a few prices over time and Boughtly can tell you whether a “sale” is actually below the usual price.',
    };
  }

  const typical = median(prior);
  const lowest = Math.min(...prior);

  if (candidate.price <= lowest) {
    return {
      level: 'great',
      title: 'Lowest price you’ve seen',
      detail: `Below every price you've logged (usual ${fmt(typical)}, previous low ${fmt(
        lowest
      )}). If you want it, this is the moment.`,
    };
  }
  if (candidate.price <= typical * 0.93) {
    return {
      level: 'good',
      title: 'A real discount',
      detail: `About ${Math.round(
        (1 - candidate.price / typical) * 100
      )}% below the usual ${fmt(typical)}. Not the all-time low (${fmt(lowest)}), but genuinely cheaper.`,
    };
  }
  return {
    level: 'meh',
    title: 'Not really a deal',
    detail: `This is the usual price — you've typically seen it around ${fmt(
      typical
    )}. A “sale” at this level is marketing, not savings.`,
  };
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

/** Latest-price trend versus the typical logged price, for list badges. */
export function trendVsTypical(log: PricePoint[]): number | null {
  if (log.length < 2) return null;
  const latest = log[log.length - 1].price;
  const prior = log.slice(0, -1).map((p) => p.price);
  const typical = median(prior);
  if (typical === 0) return null;
  return (latest - typical) / typical;
}
