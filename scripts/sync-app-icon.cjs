#!/usr/bin/env node
/**
 * Syncs the iOS app icon to public/favicon.png for the web app.
 * Single source of truth: ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
 */
const fs = require('fs');
const path = require('path');

const iosIcon = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
const webFavicon = path.join(__dirname, '..', 'public', 'favicon.png');

fs.mkdirSync(path.dirname(webFavicon), { recursive: true });
if (fs.existsSync(iosIcon)) {
  fs.copyFileSync(iosIcon, webFavicon);
  console.log('App icon synced to public/favicon.png');
} else {
  const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(webFavicon, minimalPng);
  console.warn('No iOS app icon found — created placeholder favicon to prevent 404.');
}
