# Fix Codemagic Build Failures — Step-by-Step

Your builds are failing because Codemagic needs a **certificate** and **provisioning profile** before it can sign the app. Follow these steps in order.

---

## Step 1: Get Your App's Apple ID Number

1. Go to **[appstoreconnect.apple.com](https://appstoreconnect.apple.com)**
2. Sign in → **My Apps** → **NJ Solar WattWalker**
3. Click **App Information** (under General)
4. Copy the **Apple ID** number (e.g. `1234567890`)
5. **Save it** — you'll need it in Step 5

---

## Step 2: Add a Distribution Certificate in Codemagic

1. Go to **[codemagic.io](https://codemagic.io)**
2. Click **Teams** in the left sidebar
3. Click your team name
4. Click **Code signing identities**
5. Click the **iOS certificates** tab
6. Click **Create certificate** (or **Add certificate**)
7. If you see **Create certificate**:
   - Select your App Store Connect API key
   - Choose **Apple Distribution**
   - Enter a reference name: `njsolar-dist`
   - Click **Generate certificate**
   - **Download and save** the certificate and password (you may need them later)
8. If you only see **Add certificate**:
   - You need a .p12 file from a Mac (or use MacinCloud to create one)
   - Upload it and set a reference name: `njsolar-dist`

---

## Step 3: Add a Provisioning Profile in Codemagic

**First, create it in Apple Developer Portal (if you haven't):**

1. Go to **[developer.apple.com](https://developer.apple.com)** → **Certificates, Identifiers & Profiles**
2. Click **Profiles** → **+**
3. Select **App Store Connect** → Continue
4. Select the App ID for **com.njsolar.wattwalker** → Continue
5. Select your **Distribution certificate** → Continue
6. Name it: `NJ Solar WattWalker App Store`
7. Click **Generate** → **Download** (save the .mobileprovision file)

**Then add it to Codemagic:**

1. In Codemagic → **Teams** → your team → **Code signing identities**
2. Click the **iOS provisioning profiles** tab
3. Click **Add profile**
4. Reference name: `njsolar-appstore`
5. Upload the .mobileprovision file you downloaded
6. Click **Save**

---

## Step 4: Update codemagic.yaml with Your App ID

1. Open `codemagic.yaml` in your WattWalker project
2. Find the line: `APP_STORE_APP_ID: "6AR6G3NBJA"`
3. Replace `"0"` with your Apple ID number from Step 1 (e.g. `"1234567890"`)
4. Save the file

---

## Step 5: Push and Trigger a New Build

1. Open Cursor terminal (Ctrl + `)
2. Run:
   ```
   cd C:\Users\IMDSO\Documents\GitHub\WattWalker
   git add codemagic.yaml
   git commit -m "Set App Store App ID"
   git push
   ```
3. Go to Codemagic → **Applications** → **NJ Solar WattWalker**
4. Click **Start new build**

---

## Step 6: Check Integration Name

1. In Codemagic → **Teams** → your team → **Integrations**
2. Find your **App Store Connect** or **Developer Portal** integration
3. Note the exact name (e.g. `codemagic` or `App Store Connect`)
4. Open `codemagic.yaml` and find: `app_store_connect: codemagic`
5. The word after the colon **must match** the integration name exactly
6. If it doesn't match, change it, save, and push again

---

## If It Still Fails

1. In Codemagic, open the failed build
2. Click the **red failed step** to expand it
3. **Copy the full error message** (or take a screenshot)
4. Share it so we can see exactly what's breaking
