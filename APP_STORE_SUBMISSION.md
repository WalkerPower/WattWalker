# NJ Solar WattWalker — App Store Submission Checklist

Your build is in TestFlight. Here's how to get it live on the App Store.

---

## Quick Verification (Optional)

1. Go to **[appstoreconnect.apple.com](https://appstoreconnect.apple.com)** → **My Apps** → **NJ Solar WattWalker**
2. Click **TestFlight** tab
3. Confirm your build appears (may take 5–15 min to process)
4. Optional: Add yourself as an internal tester and install via TestFlight to test

---

## Beta App Review Information (Required for TestFlight)

Before builds can be distributed via TestFlight, you must fill this out:

1. Go to **App Store Connect** → **My Apps** → **NJ Solar WattWalker** → **TestFlight** tab
2. In the left sidebar, under your app, click **App Information** (or find **Beta App Review Information**)
3. Fill in:
   - **First Name**
   - **Last Name**
   - **Phone Number**
   - **Email Address**
   - **Demo account** (username + password) for sign-in

Without this, TestFlight uploads may be rejected.

---

## Before Submitting for Review

Fill these out in App Store Connect → **NJ Solar WattWalker** → **App Store** (left sidebar):

| Item | Where | Notes |
|------|-------|-------|
| **Description** | App Information / Product Page | Describe what the app does |
| **Keywords** | Product Page | Comma-separated, no spaces (e.g. `energy,bill,solar,utility`) |
| **Support URL** | App Information | A working URL (e.g. your website) |
| **Privacy Policy URL** | App Information | **Required** if you collect user data (Firebase = yes) |
| **Screenshots** | Product Page | Required for each device size (6.7", 6.5", 5.5" iPhone) |
| **Age Rating** | General | Complete the questionnaire |
| **App Review Contact** | App Review Information | Your phone and email |
| **Demo Account** | App Review Information | Email + password for Apple to sign in (app requires login) |

---

## Submit for Review

1. In App Store Connect → **NJ Solar WattWalker** → **App Store**
2. Create a new version (e.g. **1.0**) if needed
3. Fill in all required fields (listed above)
4. Under **Build**, select your TestFlight build
5. Click **Submit for Review**
6. Answer any export compliance / content rights questions
7. Submit

---

## After Submission

- **Review time:** Usually 24–48 hours
- **Status:** Check **App Store** → **App Store** tab for status
- **If rejected:** Read Apple’s feedback, fix the issue, and resubmit

---

## Quick Reference

- **Bundle ID:** com.njsolar.wattwalker  
- **App name:** NJ Solar WattWalker  
- **Privacy:** You collect email (Firebase Auth) — complete Privacy Nutrition Labels
