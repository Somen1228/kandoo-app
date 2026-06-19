import { createContext, useContext, useEffect, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, firebaseConfigured } from '../config/firebase';

const AuthContext = createContext(null);
const GUEST_KEY = 'kandoo-offline-mode';
const DESKTOP_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID?.trim() || '';
const DESKTOP_GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_SECRET?.trim() || '';
const nativeApp = isTauri();
const mobileNativeApp = nativeApp && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const desktopNativeApp = nativeApp && !mobileNativeApp;

const firebaseProfile = (firebaseUser) => ({
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  phone: firebaseUser.phoneNumber,
  displayName: firebaseUser.displayName || firebaseUser.email || 'Kandoo user',
  photoUrl: firebaseUser.photoURL,
  authProvider: firebaseUser.providerData[0]?.providerId || 'password',
  firebaseUser,
});

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem(GUEST_KEY) === '1');
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState(null);
  const supportsGoogle = !mobileNativeApp;
  const googleConfigured = !desktopNativeApp || Boolean(DESKTOP_GOOGLE_CLIENT_ID);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      localStorage.removeItem(GUEST_KEY);
      setIsGuest(false);
      const fallback = firebaseProfile(firebaseUser);
      setUser(fallback);
      setLoading(false);
    });
  }, []);

  const requireAuth = () => {
    if (!auth) throw new Error('Firebase is not configured. Add the VITE_FIREBASE_* environment variables.');
  };

  const applyPersistence = (rememberMe) => {
    requireAuth();
    return setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
  };

  const signInWithEmail = async (email, password, rememberMe = true) => {
    setError(null);
    try {
      await applyPersistence(rememberMe);
      return (await signInWithEmailAndPassword(auth, email, password)).user;
    } catch (authError) {
      setError(authError.message);
      throw authError;
    }
  };

  const signUpWithEmail = async (email, password, displayName, rememberMe = true) => {
    setError(null);
    try {
      await applyPersistence(rememberMe);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName?.trim()) await updateProfile(result.user, { displayName: displayName.trim() });
      return result.user;
    } catch (authError) {
      setError(authError.message);
      throw authError;
    }
  };

  const signInWithGoogle = async (rememberMe = true) => {
    setError(null);
    if (!supportsGoogle) {
      const nativeError = new Error('Google sign-in is not available on this platform yet. Use email sign-in for now.');
      setError(nativeError.message);
      throw nativeError;
    }
    try {
      await applyPersistence(rememberMe);
      if (desktopNativeApp) {
        if (!DESKTOP_GOOGLE_CLIENT_ID) {
          throw new Error('Desktop Google OAuth is not configured. Add VITE_GOOGLE_DESKTOP_CLIENT_ID and rebuild Kandoo.');
        }
        const tokens = await invoke('google_oauth_sign_in', {
          clientId: DESKTOP_GOOGLE_CLIENT_ID,
          clientSecret: DESKTOP_GOOGLE_CLIENT_SECRET || null,
        });
        const credential = GoogleAuthProvider.credential(tokens.idToken, tokens.accessToken);
        return (await signInWithCredential(auth, credential)).user;
      }
      return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
    } catch (authError) {
      setError(authError.message);
      throw authError;
    }
  };

  const continueOffline = () => {
    localStorage.setItem(GUEST_KEY, '1');
    setIsGuest(true);
    setError(null);
  };

  const exitOfflineMode = () => {
    localStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
  };

  const logout = async () => {
    setError(null);
    if (auth) await signOut(auth);
    localStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
    setUser(null);
  };

  const value = {
    user,
    isGuest,
    loading,
    error,
    firebaseConfigured,
    supportsGoogle,
    googleConfigured,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    continueOffline,
    exitOfflineMode,
    logout,
    clearError: () => setError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
