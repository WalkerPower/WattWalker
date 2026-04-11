import type { User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/** Firestore profile rows after Google sign-in (popup or redirect). merge: safe to repeat. */
export async function persistGoogleUserDocs(user: User): Promise<void> {
  await setDoc(
    doc(db, 'users', user.uid),
    {
      email: user.email,
      createdAt: Date.now(),
    },
    { merge: true }
  );
  await setDoc(
    doc(db, 'customers', user.uid),
    {
      email: user.email,
    },
    { merge: true }
  );
}
