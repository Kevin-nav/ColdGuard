export type PresentedDeviceError = {
  developerCode: string | null;
  userMessage: string;
};

const USER_MESSAGE_BY_CODE: Record<string, string> = {
  BLE_DEVICE_STATE_MISMATCH: "The device is in a different state than expected. Check the device and try again.",
  BLE_GATT_CONNECT_FAILED: "Bluetooth pairing could not be started. Move closer to the device and try again.",
  BLE_GATT_DISCONNECTED: "Bluetooth pairing was interrupted before setup finished. Try again closer to the device.",
  BLE_PERMISSION_REQUIRED: "Allow Bluetooth access to continue.",
  BLE_SERVICE_NOT_FOUND: "The phone found the device, but Bluetooth setup did not complete. Move closer and try again.",
  DEVICE_ALREADY_ENROLLED: "This device is already enrolled.",
  DEVICE_NOT_ENROLLED: "This device is not enrolled yet.",
  ENROLLMENT_NOT_READY:
    "The device is not in enrollment mode. Use the device button and menu to start a new enrollment first.",
  ENROLLMENT_BOOTSTRAP_INVALID:
    "This pairing code no longer matches the device. Generate a new enrollment code on the device and try again.",
  FACILITY_WIFI_CONNECT_FAILED:
    "The device could not join that facility Wi-Fi network. Check the network name and password and try again.",
  FACILITY_WIFI_NOT_PROVISIONED: "Facility Wi-Fi has not been set up for this device yet.",
  HANDSHAKE_PROOF_INVALID: "Secure pairing verification failed. Try pairing again from the device.",
  INVALID_DEVICE_QR_PAYLOAD: "This device code could not be read. Scan the device again.",
  "Operation was cancelled": "Bluetooth recovery was interrupted. ColdGuard will retry the recovery path automatically.",
  SOFTAP_CREDENTIALS_UNAVAILABLE: "The device does not have a saved local Wi-Fi session yet. Try recovery again.",
  WIFI_AP_TIMEOUT: "The device Wi-Fi check took too long. Stay near the device and try pairing again.",
  WIFI_AP_UNAVAILABLE: "The device did not expose its temporary Wi-Fi link. Try pairing again from the device.",
  WIFI_BRIDGE_ENROLLMENT_UNAVAILABLE: "This phone build does not support native device pairing yet.",
  WIFI_BRIDGE_NETWORK_UNAVAILABLE: "The phone joined the device Wi-Fi, but could not bind the connection for verification.",
  WIFI_PERMISSION_REQUIRED: "Allow Wi-Fi and location access to connect to the device.",
};

const USER_MESSAGE_BY_PREFIX: Array<[prefix: string, userMessage: string]> = [
  ["BLE_DISCOVER_SERVICES_", "Bluetooth pairing could not finish reading device services. Move closer and try again."],
  ["BLE_GATT_STATUS_", "Bluetooth pairing failed while opening the device session. Try again closer to the device."],
  ["BLE_SCAN_FAILED_", "The phone could not scan for the device over Bluetooth. Try again."],
  ["BLE_WRITE_STATUS_", "Bluetooth pairing was interrupted while sending setup data. Try again."],
  ["BLE_RESPONSE_TIMEOUT_", "The device did not answer in time during pairing. Try again closer to the device."],
  ["WIFI_BRIDGE_RUNTIME_SNAPSHOT_FAILED", "The device paired, but its temporary Wi-Fi link could not be verified."],
];

function normalizeDeveloperCode(raw: string | null) {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

function extractDeveloperCode(message: string) {
  const normalized = message.trim();
  if (!normalized) {
    return null;
  }

  if (/^[A-Z0-9_]+$/.test(normalized)) {
    return normalized;
  }

  return normalized;
}

export function presentDeviceError(error: unknown, fallbackMessage: string): PresentedDeviceError {
  if (!(error instanceof Error)) {
    return {
      developerCode: null,
      userMessage: fallbackMessage,
    };
  }

  const developerCode = normalizeDeveloperCode(extractDeveloperCode(error.message));
  const exactMessage = error.message.trim();
  const prefixedUserMessage = USER_MESSAGE_BY_PREFIX.find(([prefix]) => exactMessage.startsWith(prefix))?.[1];
  const userMessage =
    (developerCode && USER_MESSAGE_BY_CODE[developerCode]) ||
    USER_MESSAGE_BY_CODE[exactMessage] ||
    prefixedUserMessage ||
    exactMessage ||
    fallbackMessage;

  return {
    developerCode,
    userMessage,
  };
}
