import * as SecureStore from "expo-secure-store";

const CLINIC_HANDSHAKE_TOKEN_KEY = "coldguard.clinic.handshakeToken";

export async function saveClinicHandshakeToken(token: string) {
  await SecureStore.setItemAsync(CLINIC_HANDSHAKE_TOKEN_KEY, token);
}

export async function getClinicHandshakeToken() {
  return await SecureStore.getItemAsync(CLINIC_HANDSHAKE_TOKEN_KEY);
}
