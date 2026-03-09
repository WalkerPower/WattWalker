# GitHub Actions: iOS App Store Build Setup

This guide explains how to configure the **iOS App Store Build** workflow so it can build WattWalker and upload it to App Store Connect (TestFlight) from your Windows PC—no Mac required.

---

## What You Need to Provide

### 1. Apple Developer Account
- Active Apple Developer Program membership ($99/year)
- Your **Apple ID** (email) and an **App-Specific Password**

### 2. Distribution Certificate (.p12)
- A signing certificate for "Apple Distribution"
- Exported as a `.p12` file with a password

### 3. Provisioning Profile
- An App Store provisioning profile for `com.njsolar.wattwalker`
- Downloaded from [developer.apple.com](https://developer.apple.com/account/resources/profiles/list)

---

## Step-by-Step Setup

### A. Create an App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in → **Sign-In and Security** → **App-Specific Passwords**
3. Click **Generate** → Name it (e.g. "GitHub Actions")
4. Copy the password (format: `xxxx-xxxx-xxxx-xxxx`) and save it securely

### B. Export Your Distribution Certificate

You need access to a Mac (or a cloud Mac) for this step—it's a one-time setup.

1. On a Mac, open **Keychain Access**
2. Under **My Certificates**, find your **Apple Distribution** certificate
3. Right-click the cert (and its private key) → **Export "Apple Distribution: ..."**
4. Choose **.p12** format and set a strong password
5. Save the file

### C. Create the App Store Provisioning Profile

1. Go to [developer.apple.com/account/resources/profiles/list](https://developer.apple.com/account/resources/profiles/list)
2. Click **+** → Select **App Store** distribution
3. Select the App ID for NJ Solar WattWalker (`com.njsolar.wattwalker`)
4. Select your Distribution certificate
5. Name it (e.g. "WattWalker App Store") and download the `.mobileprovision` file

### D. Encode Files as Base64

On **Windows PowerShell**:

```powershell
# Certificate (.p12)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\DistributionCertificate.p12"))

# Provisioning profile (.mobileprovision)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\profile.mobileprovision"))
```

Copy each output (long string of characters).

### E. Add GitHub Secrets

1. Open your repo on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add:

| Secret Name | Value |
|-------------|-------|
| `APPLE_ID` | Your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | The app-specific password (xxxx-xxxx-xxxx-xxxx) |
| `IOS_CERTIFICATE_PASSWORD` | The password you set when exporting the .p12 |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64` | The base64 string of your .p12 file |
| `IOS_PROVISIONING_PROFILE_BASE64` | The base64 string of your .mobileprovision file |

---

## Running the Build

1. Push your code to the `main` branch, or
2. Go to **Actions** → **iOS App Store Build** → **Run workflow**

The workflow will:
- Build the web app
- Sync to the iOS project
- Build and sign the iOS app
- Upload the IPA to App Store Connect (TestFlight)

Once uploaded, the build appears in App Store Connect under your app → **TestFlight** tab. From there you can submit it for App Store review.

---

## Troubleshooting

- **Build fails on signing**: Double-check that the provisioning profile matches the bundle ID `com.njsolar.wattwalker` and your Distribution certificate
- **Upload fails**: Verify `APPLE_ID` and `APPLE_APP_SPECIFIC_PASSWORD`; ensure 2FA is enabled and the app-specific password is correct
- **"No such module" or Swift errors**: Ensure `npm run build` succeeds and `npx cap sync ios` runs without errors locally first
