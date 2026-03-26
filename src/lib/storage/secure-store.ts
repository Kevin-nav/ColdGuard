import * as SecureStore from "expo-secure-store";

const CLINIC_HANDSHAKE_TOKEN_KEY = "coldguard.clinic.handshakeToken";
const MONITORING_CLIENT_ID_KEY = "coldguard.device.monitoringClientId";
const PENDING_DEVICE_ENROLLMENT_KEY = "coldguard.device.pendingEnrollment";

export async function saveClinicHandshakeToken(token: string) {
  await SecureStore.setItemAsync(CLINIC_HANDSHAKE_TOKEN_KEY, token);
}

export async function getClinicHandshakeToken() {
  return await SecureStore.getItemAsync(CLINIC_HANDSHAKE_TOKEN_KEY);
}

function generateMonitoringClientId() {
  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getOrCreateMonitoringClientId() {
  const existing = await SecureStore.getItemAsync(MONITORING_CLIENT_ID_KEY);
  if (existing?.trim()) {
    return existing;
  }

  const created = generateMonitoringClientId();
  await SecureStore.setItemAsync(MONITORING_CLIENT_ID_KEY, created);
  return created;
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
