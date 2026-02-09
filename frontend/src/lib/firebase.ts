'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, Auth, User } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig, isFirebaseConfigured } from './firebase.config';

// Singleton instances
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

/**
 * Initialize Firebase (only once)
 */
export function initFirebase(): FirebaseApp | null {
    if (!isFirebaseConfigured) {
        console.warn('[Firebase] Not configured - running in demo mode');
        return null;
    }

    if (!app && getApps().length === 0) {
        app = initializeApp(firebaseConfig);
        console.log('[Firebase] Initialized');
    } else if (!app) {
        app = getApps()[0];
    }

    return app;
}

/**
 * Get Firebase Auth instance
 */
export function getFirebaseAuth(): Auth | null {
    if (!isFirebaseConfigured) return null;

    const firebaseApp = initFirebase();
    if (!firebaseApp) return null;

    if (!auth) {
        auth = getAuth(firebaseApp);
    }
    return auth;
}

/**
 * Get Firestore instance
 * Using named database 'slknight' (user created named DB instead of default)
 */
export function getFirebaseDb(): Firestore | null {
    if (!isFirebaseConfigured) return null;

    const firebaseApp = initFirebase();
    if (!firebaseApp) return null;

    if (!db) {
        // Connect to the named 'slknight' database instead of (default)
        db = getFirestore(firebaseApp, 'slknight');
    }
    return db;
}

/**
 * Get Firebase Storage instance
 */
export function getFirebaseStorage(): FirebaseStorage | null {
    if (!isFirebaseConfigured) return null;

    const firebaseApp = initFirebase();
    if (!firebaseApp) return null;

    if (!storage) {
        storage = getStorage(firebaseApp);
    }
    return storage;
}

/**
 * Sign in anonymously (for demo mode)
 */
export async function signInAnon(): Promise<User | null> {
    const authInstance = getFirebaseAuth();
    if (!authInstance) {
        console.log('[Firebase] Auth not available - using demo mode');
        return null;
    }

    try {
        const result = await signInAnonymously(authInstance);
        console.log('[Firebase] Signed in anonymously:', result.user.uid);
        return result.user;
    } catch (error) {
        console.error('[Firebase] Anonymous sign-in failed:', error);
        return null;
    }
}
