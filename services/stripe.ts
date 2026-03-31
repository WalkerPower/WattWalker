import { db } from "./firebase";
import { collection, addDoc, onSnapshot } from "firebase/firestore";
import { successUrl, cancelUrl } from "../billingConfig";

export const createCheckoutSession = async (
  uid: string,
  priceId: string,
  onCheckoutError?: () => void
) => {
  if (!uid || !priceId) throw new Error("Missing user ID or price ID");

  // Create a new document in the checkout_sessions collection for the user
  // This assumes the "Run Payments with Stripe" Firebase Extension is installed
  const checkoutRef = await addDoc(collection(db, "customers", uid, "checkout_sessions"), {
    price: priceId,
    success_url: successUrl(),
    cancel_url: cancelUrl(),
  });

  // Listen for changes to the document to get the redirect URL
  const unsubscribe = onSnapshot(checkoutRef, (snap) => {
    const { error, url } = snap.data() || {};

    if (error) {
      unsubscribe();
      console.error("Stripe Checkout Error:", error.message);
      alert(`Checkout failed: ${error.message}`);
      onCheckoutError?.();
      return;
    }

    if (url) {
      unsubscribe();
      window.location.assign(url);
    }
  });
};