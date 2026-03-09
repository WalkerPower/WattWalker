# App Store Submission — Your Questions Answered

---

## Privacy Labels / Privacy Nutrition Labels — What Are These?

**Privacy Nutrition Labels** are Apple’s way of showing users what data your app collects, similar to food nutrition labels. In App Store Connect, you answer questions about:

- **Data types collected:** e.g. Email, Name, Usage Data
- **Purpose:** e.g. Account creation, Analytics
- **Linked to identity:** Yes or No
- **Used for tracking:** Yes or No

**Where to fill them out:** App Store Connect → Your App → **App Privacy** (left sidebar). Click **Edit** or **Get Started** and answer the questions.

**For NJ Solar WattWalker** (Firebase Auth, Firestore):
- **Contact info** (email): Collected, for account creation
- **User ID / Identifiers:** Likely yes (Firebase)
- **Usage data:** Maybe, if you track analytics
- Answer the rest based on what your app actually does

---

## App Store Listing — Who Is It For?

The description, keywords, screenshots, etc. are for **people browsing the App Store**. They help users find and understand your app.

- **Description:** Plain language for potential users
- **Keywords:** Search terms users might type
- **Screenshots:** Show what the app does
- **Support URL:** Where users can get help
- **Age rating:** Determined by your answers to Apple’s questionnaire

---

## Demo Account — Do You Need Multiple?

**One demo account is enough** for App Review.

Create a single test account Apple can use:

- **Email:** e.g. `appreview@yourdomain.com` or `demo@walkerpower.energy`
- **Password:** Simple but valid (e.g. `DemoTest123!`)
- **Verify the email** so the account can sign in

In App Store Connect → **App Review Information**, add:

- **Sign-in required:** Yes
- **Demo account username:** that email
- **Demo account password:** that password
- **Notes:** e.g. “Demo account for App Review. Full access to app features.”

Apple will use this to sign in and test the app.

---

## App Stuck / Screen Not Loading

Possible causes:

1. **Stuck on loading screen** — Firebase may not be connecting (network, config, permissions).
2. **“Expecting an image”** — The app may be waiting on a missing image (e.g. favicon) or a slow/failing CDN request.
3. **Network** — External scripts (Tailwind, fonts, Firebase) need internet; if blocked or slow, the app can hang.

Share exactly when it gets stuck (e.g. “right after opening”, “after login”) and any error messages if you see them.
