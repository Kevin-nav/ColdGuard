/* eslint-disable import/no-duplicates */
import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, initializeAuth } from "firebase/auth";
// @ts-expect-error – Metro resolves this via the "react-native" field in
// @firebase/auth/package.json, but TS uses the default entry which doesn't
// export getReactNativePersistence.
import { getReactNativePersistence } from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getEnv } from "../../config/env";

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

function getFirebaseApp() {
  if (cachedApp) return cachedApp;

  const env = getEnv();
  if (getApps().length) {
    cachedApp = getApp();
    return cachedApp;
  }

  cachedApp = initializeApp({
    apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
  });

  return cachedApp;
}

export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;

  const app = getFirebaseApp();

  // Use initializeAuth with AsyncStorage persistence on first call
  // so auth state survives app restarts.
  cachedAuth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });

  return cachedAuth;
}
