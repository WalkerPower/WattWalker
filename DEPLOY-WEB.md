# Deploy WattWalker (Walker Power Solar / GitHub `WalkerPower/WattWalker`)

Firebase project: **`newwattwalker`**  
Google account: **`paulwalker@walkerpowersolar.com`**

## What the code uses (no GitHub change required for Firebase)

| Item | Value |
|------|--------|
| Firebase project ID | `newwattwalker` (in `services/firebase.ts`, `.firebaserc`) |
| Default public URL after deploy | **https://newwattwalker.web.app** |
| Optional custom URL later | `wattwalker.njsolar.today` or `app.walkerpowersolar.com` |
| VIP login (no Stripe) | `paulwalker@walkerpowersolar.com`, `@walkerpowersolar.com` |

Forking to **WalkerPower/WattWalker** does not change Firebase — only GCP/Firebase IAM and deploy commands matter.

---

## Get the site visible fast (no custom DNS)

Use Firebase’s free URL first so you’re not blocked on `wattwalker.njsolar.today` DNS.

### One-time (your PC)

```powershell
cd C:\Users\IMDSO\Documents\GitHub\WattWalker
gcloud auth login paulwalker@walkerpowersolar.com
gcloud config set account paulwalker@walkerpowersolar.com
gcloud config set project newwattwalker
firebase login
```

Firebase Console → **Hosting** → Get started  
Firebase Console → **Authentication** → Authorized domains → add **`newwattwalker.web.app`**

### Deploy

```powershell
gcloud run deploy wattwalker --source . --region us-central1 --allow-unauthenticated --set-env-vars "GEMINI_API_KEY=YOUR_KEY"
npm run deploy:hosting
```

Open **https://newwattwalker.web.app** — login should work (not 404).

Sign in with **`paulwalker@walkerpowersolar.com`** (add user in Firebase Auth if needed) for VIP access without Stripe.

---

## Custom domain later

1. Firebase Hosting → **Add custom domain** (`wattwalker.njsolar.today` or your `walkerpowersolar.com` subdomain).
2. Update DNS at your registrar.
3. Add that domain under **Authentication → Authorized domains**.
4. Rebuild with that URL baked in:
   ```powershell
   $env:VITE_PUBLIC_APP_URL="https://wattwalker.njsolar.today"
   npm run build
   firebase deploy --only hosting --project newwattwalker
   ```

---

## GitHub Actions (optional)

Push to **`main`** on **WalkerPower/WattWalker** runs `.github/workflows/deploy-web.yml` if you add secrets:

- `GCP_SA_KEY`
- `GEMINI_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT`

Create a GCP service account in **`newwattwalker`** with roles: **Cloud Run Admin**, **Service Account User**, **Firebase Hosting Admin**, **Cloud Build Editor**.

---

## Local dev

| Terminal | Command | URL |
|----------|---------|-----|
| 1 | `npm run dev:api` | API :8080 |
| 2 | `npm run dev` | UI :3000 |

`.env`: `GEMINI_API_KEY=...` only (see `.env.example`).

---

## Push fork to GitHub

```powershell
git remote set-url origin https://github.com/WalkerPower/WattWalker.git
git push -u origin main
```
