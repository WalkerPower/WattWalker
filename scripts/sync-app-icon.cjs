#!/usr/bin/env node
/**
 * Syncs the iOS app icon to public/favicon.png for the web app.
 * Single source of truth: ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
 */
const fs = require('fs');
const path = require('path');

const iosIcon = path.join(__dirname, '..', 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');
const webFavicon = path.join(__dirname, '..', 'public', 'favicon.png');

if (fs.existsSync(iosIcon)) {
  fs.mkdirSync(path.dirname(webFavicon), { recursive: true });
  fs.copyFileSync(iosIcon, webFavicon);
  console.log('App icon synced to public/favicon.png');
} else {
  console.warn('No iOS app icon found at AppIcon.appiconset/AppIcon-512@2x.png — add your 1024×1024 PNG there.');
}
