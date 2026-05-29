<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8a45debe-e37a-4c14-bc6c-f606a4b71d48

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy [.env.example](.env.example) to `.env` and set `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey).
3. Install backend deps and run the API (bill analysis uses the server key, not the browser):
   `pip install -r backend/requirements.txt`
   `npm run dev:api`
4. In another terminal, run the UI:
   `npm run dev`

   Vite proxies `/api` and `/convert` to port 8080. For production on any backend host, set `GEMINI_API_KEY` as a server environment variable.

## Deploy web (Walker Power Solar / `newwattwalker`)

Repo: **https://github.com/WalkerPower/WattWalker**

See **[DEPLOY-WEB.md](DEPLOY-WEB.md)**. Fast path: deploy Cloud Run + `npm run deploy:hosting`, then open **https://newwattwalker.web.app** (custom domain optional).
