// Your ACTUAL deployed WattWalker URL
export const DEPLOYED_URL = "https://wattwalker.njsolar.today";

// Legacy constants for backward compatibility (Mapped to Premium)
export const MONTHLY_PRICE_ID = "price_1SzkOvRTMNcgA09ICzh124TC";
export const YEARLY_PRICE_ID  = "price_1SzkjoRTMNcgA09I9t5fLmvR";

// Comprehensive Price ID Map
export const PRICE_IDS = {
  basic: {
    monthly: "price_1Szkf0RTMNcgA09IqTJuDmT2",
    yearly: "price_1SzklWRTMNcgA09IAmEAU0Dq"
  },
  professional: {
    monthly: "price_1Szkd6RTMNcgA09Ijxm8HteT",
    yearly: "price_1SzkkoRTMNcgA09IQFuSMTLn"
  },
  premium: {
    monthly: "price_1SzkOvRTMNcgA09ICzh124TC",  // Has 5-day trial
    yearly: "price_1SzkjoRTMNcgA09I9t5fLmvR"     // Has 5-day trial
  }
};

// Helper to detect whether the app uses hash routing.
export function usesHashRouting(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const href = window.location.href || "";
  return href.includes("/#/");
}

// Build success and cancel URLs based on routing type.
export function successUrl(): string {
  if (usesHashRouting()) {
    return `${DEPLOYED_URL}/#/success`;
  }
  return `${DEPLOYED_URL}/success`;
}

export function cancelUrl(): string {
  if (usesHashRouting()) {
    return `${DEPLOYED_URL}/#/failure`;
  }
  return `${DEPLOYED_URL}/failure`;
}