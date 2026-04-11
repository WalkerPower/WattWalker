import { Capacitor } from '@capacitor/core';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';
import { persistGoogleUserDocs } from './persistGoogleProfile';

/**
 * OAuth Web client ID (same value embedded in capacitor.config via GOOGLE_WEB_CLIENT_ID at cap sync).
 * iOS client ID: Google Cloud → Credentials → iOS client for bundle com.njsolar.wattwalker
 */
export function readGoogleOAuthEnv() {
  const webClientId = (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined)?.trim();
  const iosClientId = (import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined)?.trim();
  return { webClientId, iosClientId };
}

export function isNativeGoogleSignInConfigured(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  const { webClientId, iosClientId } = readGoogleOAuthEnv();
  return Boolean(webClientId && iosClientId);
}

/**
 * Native Google sheet → ID token → Firebase. Required on iOS because Google blocks OAuth inside WKWebView.
 */
export async function signInWithGoogleNative(): Promise<void> {
  const { webClientId, iosClientId } = readGoogleOAuthEnv();
  if (!webClientId || !iosClientId) {
    throw new Error('GOOGLE_NATIVE_NOT_CONFIGURED');
  }

  const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');

  await GoogleAuth.initialize({
    clientId: iosClientId,
    scopes: ['profile', 'email'],
    grantOfflineAccess: true,
  });

  const googleUser = await GoogleAuth.signIn();
  const idToken = googleUser.authentication?.idToken;
  if (!idToken) {
    throw new Error('GOOGLE_NO_ID_TOKEN');
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  await persistGoogleUserDocs(result.user);
}
