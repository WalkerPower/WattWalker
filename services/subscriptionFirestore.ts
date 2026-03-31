import { collection, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { PRICE_IDS } from '../billingConfig';
import type { UserRole } from '../types';

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

function priceIdToTier(priceId: string): UserRole | null {
  if (
    PRICE_IDS.basic.monthly === priceId ||
    PRICE_IDS.basic.yearly === priceId
  ) {
    return 'basic';
  }
  if (
    PRICE_IDS.professional.monthly === priceId ||
    PRICE_IDS.professional.yearly === priceId
  ) {
    return 'pro';
  }
  if (
    PRICE_IDS.premium.monthly === priceId ||
    PRICE_IDS.premium.yearly === priceId
  ) {
    return 'premium';
  }
  return null;
}

function tierRank(r: UserRole | null): number {
  if (!r) return 0;
  if (r === 'basic') return 1;
  if (r === 'pro') return 2;
  return 3;
}

/**
 * Stripe Firebase extension writes one doc per subscription under
 * customers/{uid}/subscriptions/{subscriptionId} with `status`, `role` (from
 * Stripe product metadata `firebaseRole`), and Stripe `items` (line items).
 */
function roleFromSubscriptionDoc(data: Record<string, unknown>): UserRole | null {
  const status = data.status as string | undefined;
  if (!status || !ACTIVE_STATUSES.has(status)) return null;

  const metaRole = data.role as string | undefined | null;
  if (metaRole === 'basic' || metaRole === 'pro' || metaRole === 'premium') {
    return metaRole;
  }

  const items = data.items as unknown[] | undefined;
  if (!items?.length) return null;
  const first = items[0] as Record<string, unknown>;
  const priceField = first?.price as Record<string, unknown> | string | undefined;
  const priceId =
    typeof priceField === 'string'
      ? priceField
      : (priceField?.id as string | undefined);
  if (priceId) return priceIdToTier(priceId);
  return null;
}

/**
 * Live-sync paid tier from the same Firestore path the Stripe extension uses.
 */
export function subscribeToStripeSubscription(
  uid: string,
  onChange: (payload: { hasActiveSubscription: boolean; userRole: UserRole }) => void
): Unsubscribe {
  const ref = collection(db, 'customers', uid, 'subscriptions');
  return onSnapshot(
    ref,
    (snap) => {
      let best: UserRole | null = null;
      snap.forEach((docSnap) => {
        const r = roleFromSubscriptionDoc(docSnap.data() as Record<string, unknown>);
        if (r && tierRank(r) > tierRank(best)) best = r;
      });
      if (best) {
        onChange({ hasActiveSubscription: true, userRole: best });
      } else {
        onChange({ hasActiveSubscription: false, userRole: 'basic' });
      }
    },
    (err) => {
      console.error('subscriptions listener error', err);
      onChange({ hasActiveSubscription: false, userRole: 'basic' });
    }
  );
}
