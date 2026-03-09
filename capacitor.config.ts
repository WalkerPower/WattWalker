import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.njsolar.wattwalker',
  appName: 'NJ Solar WattWalker',
  webDir: 'dist',
  // Use ionic:// scheme so Firebase Auth works on iOS (capacitor:// causes auth failures)
  server: {
    iosScheme: 'ionic'
  }
};

export default config;
