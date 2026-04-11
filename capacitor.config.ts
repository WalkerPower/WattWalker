import path from 'path';
import { config as loadEnv } from 'dotenv';
import type { CapacitorConfig } from '@capacitor/cli';

// Load .env for `npx cap sync` so native Google Sign-In gets Firebase’s Web client ID (serverClientId).
loadEnv({ path: path.resolve(__dirname, '.env') });
loadEnv({ path: path.resolve(__dirname, '.env.local'), override: true });

const googleWebClientId =
  process.env.GOOGLE_WEB_CLIENT_ID?.trim() ||
  process.env.VITE_GOOGLE_WEB_CLIENT_ID?.trim() ||
  '';

const config: CapacitorConfig = {
  appId: 'com.njsolar.wattwalker',
  appName: 'NJ Solar WattWalker',
  webDir: 'dist',
  // Use ionic:// scheme so Firebase Auth works on iOS (capacitor:// causes auth failures)
  server: {
    iosScheme: 'ionic'
  },
  // @codetrix-studio/capacitor-google-auth — serverClientId must be the OAuth 2.0 *Web* client ID
  // (Firebase Console → Project settings → Your apps → Web app, or Google Cloud → Credentials → Web client).
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      ...(googleWebClientId ? { serverClientId: googleWebClientId } : {}),
    },
  },
};

export default config;
