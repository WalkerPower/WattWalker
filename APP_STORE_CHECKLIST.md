# WattWalker – Apple App Store Compatibility Checklist

## ✅ Completed

1. **Privacy usage descriptions (Info.plist)** – Required for App Store approval
   - `NSCameraUsageDescription` – Explains camera use for capturing bill images
   - `NSPhotoLibraryUsageDescription` – Explains photo library access for selecting bill images

2. **Export compliance** – Streamlines submission
   - `ITSAppUsesNonExemptEncryption` set to `false` (standard HTTPS only)

3. **Existing configuration**
   - Bundle ID: `com.njsolar.wattwalker`
   - Display name: WattWalker
   - Marketing version: 1.0 | Build: 1
   - iOS deployment target: 15.0
   - iPhone & iPad support
   - Proper orientations configured

## ⚠️ Action required before submission

### App icon (single source of truth)

Place your 1024×1024 PNG here—it is used for both iOS and the web app:

**Location:** `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`  
**Format:** PNG, sRGB, square, no transparency

The build process copies this to `public/favicon.png` for the web version. One file, used everywhere.

### In App Store Connect

- Privacy nutrition labels (data collection, tracking, etc.)
- App description, keywords, screenshots
- Privacy policy URL (required if you collect data)
- Sign in with Apple (if you offer third‑party login)
- Account deletion (if the app supports user accounts)

---

*Last updated after App Store compatibility review*
