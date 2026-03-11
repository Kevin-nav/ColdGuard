import * as SecureStore from "expo-secure-store";

const CLINIC_HANDSHAKE_TOKEN_KEY = "coldguard.clinic.handshakeToken";
const PENDING_DEVICE_ENROLLMENT_KEY = "coldguard.device.pendingEnrollment";

export async function saveClinicHandshakeToken(token: string) {
  await SecureStore.setItemAsync(CLINIC_HANDSHAKE_TOKEN_KEY, token);
}

export async function getClinicHandshakeToken() {
  return await SecureStore.getItemAsync(CLINIC_HANDSHAKE_TOKEN_KEY);
}

export async function savePendingDeviceEnrollment(payloadJson: string) {
  await SecureStore.setItemAsync(PENDING_DEVICE_ENROLLMENT_KEY, payloadJson);
}

export async function getPendingDeviceEnrollment() {
  return await SecureStore.getItemAsync(PENDING_DEVICE_ENROLLMENT_KEY);
}

export async function clearPendingDeviceEnrollment() {
  await SecureStore.deleteItemAsync(PENDING_DEVICE_ENROLLMENT_KEY);
}
