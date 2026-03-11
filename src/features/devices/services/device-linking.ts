import {
  clearPendingDeviceEnrollment,
  getPendingDeviceEnrollment,
  savePendingDeviceEnrollment,
} from "../../../lib/storage/secure-store";

const DEVICE_LINK_PATTERN = /^\/device\/([^/?#]+)$/i;

export type PendingDeviceEnrollment = {
  claim: string;
  deviceId: string;
  qrPayload: string;
  sourceUrl: string;
  version: string;
};

export function parseDeviceEnrollmentLink(input: string): PendingDeviceEnrollment {
  const normalized = input.trim();

  if (normalized.startsWith("coldguard://device/")) {
    const parsed = normalized.match(/^coldguard:\/\/device\/([^?]+)\?claim=([^&]+)&v=([^&]+)$/i);
    if (!parsed) {
      throw new Error("INVALID_DEVICE_QR_PAYLOAD");
    }

    const deviceId = decodeURIComponent(parsed[1]);
    const claim = decodeURIComponent(parsed[2]);
    const version = decodeURIComponent(parsed[3]);

    return {
      claim,
      deviceId,
      qrPayload: `coldguard://device/${encodeURIComponent(deviceId)}?claim=${encodeURIComponent(claim)}&v=${encodeURIComponent(version)}`,
      sourceUrl: normalized,
      version,
    };
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("INVALID_DEVICE_QR_PAYLOAD");
  }

  if (url.protocol !== "https:" || url.hostname !== "coldguard.org") {
    throw new Error("INVALID_DEVICE_QR_PAYLOAD");
  }

  const pathMatch = url.pathname.match(DEVICE_LINK_PATTERN);
  const claim = url.searchParams.get("claim");
  const version = url.searchParams.get("v");

  if (!pathMatch || !claim || !version) {
    throw new Error("INVALID_DEVICE_QR_PAYLOAD");
  }

  const deviceId = decodeURIComponent(pathMatch[1]);

  return {
    claim,
    deviceId,
    qrPayload: `coldguard://device/${encodeURIComponent(deviceId)}?claim=${encodeURIComponent(claim)}&v=${encodeURIComponent(version)}`,
    sourceUrl: url.toString(),
    version,
  };
}

export function buildEnrollmentRouteParams(payload: PendingDeviceEnrollment) {
  return {
    claim: payload.claim,
    deviceId: payload.deviceId,
    payload: payload.qrPayload,
    v: payload.version,
  };
}

export async function persistPendingDeviceEnrollment(payload: PendingDeviceEnrollment) {
  await savePendingDeviceEnrollment(JSON.stringify(payload));
}

export async function loadPendingDeviceEnrollment() {
  const payloadJson = await getPendingDeviceEnrollment();
  if (!payloadJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadJson) as PendingDeviceEnrollment;
    if (!parsed.deviceId || !parsed.claim || !parsed.qrPayload || !parsed.version) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function consumePendingDeviceEnrollment() {
  const payload = await loadPendingDeviceEnrollment();
  await clearPendingDeviceEnrollment();
  return payload;
}

export async function discardPendingDeviceEnrollment() {
  await clearPendingDeviceEnrollment();
}
