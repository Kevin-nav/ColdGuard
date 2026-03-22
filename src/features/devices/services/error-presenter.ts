export type PresentedDeviceError = {
  developerCode: string | null;
  userMessage: string;
};

const USER_MESSAGE_BY_CODE: Record<string, string> = {
  BLE_DEVICE_STATE_MISMATCH: "The device is in a different state than expected. Check the device and try again.",
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
  WIFI_PERMISSION_REQUIRED: "Allow Wi-Fi and location access to connect to the device.",
};

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
  const userMessage =
    (developerCode && USER_MESSAGE_BY_CODE[developerCode]) ||
    USER_MESSAGE_BY_CODE[exactMessage] ||
    exactMessage ||
    fallbackMessage;

  return {
    developerCode,
    userMessage,
  };
}
