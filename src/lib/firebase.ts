import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableNetwork, disableNetwork, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable offline persistence
let isOfflineEnabled = false;
export const enableOfflinePersistence = async () => {
  if (isOfflineEnabled) return;
  
  // Safety checks
  if (typeof window === 'undefined') {
    console.warn('Cannot enable offline persistence in server environment');
    return;
  }

  if (!('indexedDB' in window)) {
    console.warn('IndexedDB not supported, offline persistence disabled');
    return;
  }
  
  try {
    // Enable offline persistence
    await import('firebase/firestore').then(({ enableIndexedDbPersistence }) => {
      enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
          console.warn('The current browser does not support all features required for persistence');
        } else {
          console.warn('Failed to enable offline persistence:', err);
        }
      });
    });
    isOfflineEnabled = true;
    console.log('✅ Firestore offline persistence enabled');
  } catch (error) {
    console.warn('Failed to enable offline persistence:', error);
  }
};

// Network management
export const setNetworkEnabled = async (enabled: boolean) => {
  try {
    if (enabled) {
      await enableNetwork(db);
      console.log('🌐 Firestore network enabled');
    } else {
      await disableNetwork(db);
      console.log('📴 Firestore network disabled');
    }
  } catch (error) {
    console.error('Failed to toggle network:', error);
  }
};

// Connect to emulators in development
if (import.meta.env.DEV) {
  // Note: Emulator connection will be handled in the app initialization
  console.log('Development mode: Firebase emulators will be used');
}

export default app;
