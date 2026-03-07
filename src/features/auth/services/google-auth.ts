import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { getFirebaseAuth } from "../../../lib/firebase/client";

export function isGoogleProvider(providerId: string) {
  return providerId === "google.com";
}

export function hasGoogleClientConfig(config: {
  webClientId?: string;
  androidClientId?: string;
  iosClientId?: string;
}) {
  return Boolean(config.webClientId || config.androidClientId || config.iosClientId);
}

export async function signInWithGoogleIdToken(idToken: string) {
  const auth = getFirebaseAuth();
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  return result.user;
}
