import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type User,
} from 'firebase/auth';

const VITE = import.meta.env as Record<string, string | undefined>;

export const firebaseConfigured = Boolean(VITE.VITE_FIREBASE_API_KEY && VITE.VITE_FIREBASE_PROJECT_ID);

let app: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp({
      apiKey: VITE.VITE_FIREBASE_API_KEY,
      authDomain: VITE.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: VITE.VITE_FIREBASE_PROJECT_ID,
    });
  }
  return app;
}

export function getFirebaseAuth() {
  if (!firebaseConfigured) return null;
  if (getApps().length === 0) getFirebaseApp();
  return getAuth();
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export function toProfile(user: User | null): UserProfile | null {
  if (!user) return null;
  return { uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL };
}

export async function signUp(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase is not configured on this deployment.');
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signIn(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase is not configured on this deployment.');
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase is not configured on this deployment.');
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function signOutUser() {
  const auth = getFirebaseAuth();
  if (auth) await signOut(auth);
}

export async function getIdToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}
