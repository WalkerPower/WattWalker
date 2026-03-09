import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  User
} from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../services/firebase';

const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        // --- LOGIN FLOW ---
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
          await signOut(auth); // Prevent access
          setError("Please verify your email address to login.");
        }
        // If verified, App.tsx handles the state update via onAuthStateChanged
      } else {
        // --- SIGNUP FLOW ---
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Initialize User Document in Firestore for Trial Tracking
        try {
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            createdAt: Date.now(), // Critical for 5-day trial logic
            role: null, // No paid role yet
            status: 'trial'
          });
        } catch (firestoreErr) {
          console.error("Error creating user document:", firestoreErr);
          // Continue even if firestore fails, though trial logic might be buggy without it
        }

        // Send verification email
        await sendEmailVerification(user);

        // Do not sign them in automatically. Sign out immediately.
        await signOut(auth);

        // Show verification screen
        setIsVerificationSent(true);
      }
    } catch (err: any) {
      console.error("Auth Error:", err.code, err.message);

      if (isLogin) {
        if (
          err.code === 'auth/invalid-credential' ||
          err.code === 'auth/user-not-found' ||
          err.code === 'auth/wrong-password' ||
          err.code === 'auth/invalid-email'
        ) {
          setError("Password or email Incorrect");
        } else {
          setError("Failed to sign in. Please try again.");
        }
      } else {
        if (err.code === 'auth/email-already-in-use') {
          setError("User already exists, sign in?");
        } else if (err.code === 'auth/weak-password') {
          setError("Password should be at least 6 characters");
        } else {
          setError(err.message || "Failed to sign up");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
    } catch (err: any) {
      console.error("Password Reset Error:", err.code, err.message);
      if (err.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else {
        // Show success message to prevent enumeration
        setResetEmailSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      // Check if new user to set trial timestamp
      // Note: Using getAdditionalUserInfo or checking firestore existence would be safer, 
      // but for simplicity App.tsx handles missing timestamps by defaulting to 'now' if needed
      // or we can force a setDoc with merge: true
      await setDoc(doc(db, 'users', result.user.uid), {
        email: result.user.email,
      }, { merge: true });

    } catch (err: any) {
      console.error("Google Auth Error:", err.code, err.message);

      if (err.code === 'auth/unauthorized-domain') {
        const hostname = window.location.hostname;
        setError(`Domain "${hostname}" is not authorized. Add it to Firebase Console > Authentication > Settings > Authorized Domains.`);
      } else if (err.code === 'auth/popup-closed-by-user') {
        return;
      } else if (err.code === 'auth/cancelled-popup-request') {
        return;
      } else {
        setError("Google Sign In failed. Please try again.");
      }
    }
  };

  const resetToLogin = () => {
    setIsVerificationSent(false);
    setIsForgotPassword(false);
    setResetEmailSent(false);
    setIsLogin(true);
    setError(null);
    setPassword('');
  };

  // --- RENDER: Verification Sent Screen ---
  if (isVerificationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Check your email</h2>
          <p className="text-slate-600 mb-8">
            We have sent you a verification email to <span className="font-semibold text-slate-900">{email}</span>. Please Verify it and login.
          </p>
          <button
            onClick={resetToLogin}
            className="w-full py-3 bg-[#00a8f9] hover:bg-[#0096e0] text-white font-bold rounded-lg transition-colors shadow-sm"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER: Forgot Password Screen ---
  if (isForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-md">
          <div className="flex flex-col items-center mb-6">
            <h2 className="text-xl font-bold text-slate-900">Reset Password</h2>
          </div>

          {resetEmailSent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-slate-600 mb-6 font-medium">
                If this email address is in our system, you will receive a change password link.
              </p>
              <button
                onClick={resetToLogin}
                className="w-full py-3 bg-[#00a8f9] hover:bg-[#0096e0] text-white font-bold rounded-lg transition-colors shadow-sm"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <p className="text-sm text-slate-500 mb-4 text-center">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg font-medium text-center">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00a8f9] focus:border-transparent text-slate-900"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#00a8f9] hover:bg-[#0096e0] text-white font-bold rounded-lg transition-colors shadow-sm disabled:opacity-70"
              >
                {loading ? 'Sending Link...' : 'Reset My Password'}
              </button>

              <button
                type="button"
                onClick={resetToLogin}
                className="w-full py-3 bg-white text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- RENDER: Main Auth Screen ---
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-md">

        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 flex items-center justify-center mb-4">
            <img src="/logo.png" alt="WattWalker Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">WattWalker</h1>
          <p className="text-slate-500 text-sm mt-1">{isLogin ? 'Sign in to continue' : 'Create an account'}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00a8f9] focus:border-transparent text-slate-900"
              placeholder="name@example.com"
              required
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setIsForgotPassword(true);
                  }}
                  className="text-xs text-[#00a8f9] hover:underline font-medium"
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00a8f9] focus:border-transparent text-slate-900"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#00a8f9] hover:bg-[#0096e0] text-white font-bold rounded-lg transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          type="button"
          className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
        </button>

        <div className="mt-6 text-center text-sm text-slate-500">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-[#00a8f9] font-bold hover:underline"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;