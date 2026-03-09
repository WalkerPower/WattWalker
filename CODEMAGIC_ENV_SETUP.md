# Codemagic Environment Variables — One-Time Setup

Add these 3 secrets in Codemagic. **Use a fresh API key** to avoid 401 errors.

---

## Step 1: Create a NEW API Key (Recommended — avoids old/bad keys)

1. Go to **[appstoreconnect.apple.com](https://appstoreconnect.apple.com)** → **Users and Access** → **Integrations** → **App Store Connect API**
2. Click the **+** button to create a new key
3. Name it: **Codemagic**
4. Set **Access** to **App Manager**
5. Click **Generate**
6. **Download the .p8 file immediately** (you can only download once)
7. Note your **Issuer ID** (at the top of the page)
8. Note the **Key ID** for the key you just created (in the table)
9. Save the .p8 file somewhere you can find it

---

## Step 2: Copy the .p8 Key Correctly (Important — fixes 401 errors)

The .p8 key must be pasted **exactly as-is** with all line breaks intact. Wrong format = 401.

**On Windows:**
1. Open the .p8 file in **Notepad**
2. Press **Ctrl+A** (select all)
3. Press **Ctrl+C** (copy)
4. Paste into Codemagic — the key should look like this (multiple lines):

```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
...more lines...
-----END PRIVATE KEY-----
```

**Do NOT:**
- Remove line breaks
- Add extra spaces
- Use base64 encoding
- Truncate the key

---

## Step 3: Add Variables in Codemagic

1. Go to **[codemagic.io](https://codemagic.io)** → **Applications** → **NJ Solar WattWalker**
2. Click the **Environment variables** tab
3. Open your **appstore_credentials** group (or create it)
4. **Delete** the old `APP_STORE_CONNECT_PRIVATE_KEY` value if it exists
5. Add/update these 3 variables (each as **Secret**):

| Variable name | Value | Check |
|---------------|-------|-------|
| `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID from Step 1 (UUID format) | No spaces, no quotes |
| `APP_STORE_CONNECT_KEY_IDENTIFIER` | Key ID from Step 1 (10 chars) | Must match the NEW key |
| `APP_STORE_CONNECT_PRIVATE_KEY` | Paste full .p8 contents with line breaks | Must include BEGIN/END lines |

6. Save the group

---

## Alternative: Use Developer Portal Integration (If Env Vars Keep Failing)

Uploading the .p8 file avoids copy/paste issues:

1. Go to **Codemagic** → **Teams** → your team → **Team integrations**
2. Find **Developer Portal** → click **Connect** or **Manage keys**
3. Click **Add key** (or **Add another key**)
4. **App Store Connect API key name:** type exactly: `asc`
5. **Issuer ID:** paste from App Store Connect
6. **Key ID:** paste from App Store Connect
7. **Private key:** click **Choose file** and upload the .p8 file (do NOT paste — upload)
8. Click **Save**

Then we need to switch codemagic.yaml back to use `auth: integration` with the name `asc`. Tell me when this is done and I'll update the yaml.

---

## Step 4: Add the Group to the Workflow

1. Still in **Environment variables**, find **Variable groups**
2. Make sure **appstore_credentials** is added to the workflow (check the box or add it)
3. Save

---

## Step 5: Start a New Build

1. Go to **Applications** → **NJ Solar WattWalker**
2. Click **Start new build**
3. Select **main** branch
4. Click **Start build**

---

Done. No integration name needed.
