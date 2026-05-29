/**
 * Walker Power Solar — web app URLs and Firebase project.
 * Override public URL at build time: VITE_PUBLIC_APP_URL=https://your-domain.example.com
 */
export const FIREBASE_PROJECT_ID = 'newwattwalker';

/** Firebase Hosting default (works right after deploy, no custom DNS). */
export const FIREBASE_HOSTING_URL = 'https://newwattwalker.web.app';

const envUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim().replace(/\/$/, '');

/** Stripe checkout return URLs and share links — must match an authorized Firebase Auth domain. */
export const DEPLOYED_URL = envUrl || FIREBASE_HOSTING_URL;
