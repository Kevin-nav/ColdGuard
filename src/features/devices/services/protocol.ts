import { decode as decodeBase64, encode as encodeBase64 } from "base-64";

export const COLDGUARD_BLE_SERVICE_UUID = "6B8F7B61-8B30-4A70-BD9A-44B4C1D7C110";
export const COLDGUARD_BLE_COMMAND_CHARACTERISTIC_UUID = "6B8F7B61-8B30-4A70-BD9A-44B4C1D7C111";
export const COLDGUARD_BLE_RESPONSE_CHARACTERISTIC_UUID = "6B8F7B61-8B30-4A70-BD9A-44B4C1D7C112";

export type ColdGuardBleCommand =
  | "device.decommission"
  | "enroll.begin"
  | "enroll.commit"
  | "grant.verify"
  | "hello"
  | "wifi.ticket.request";

export async function createHandshakeProof(args: {
  deviceId: string;
  deviceNonce: string;
  handshakeToken: string;
  proofTimestamp: number;
}) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(args.handshakeToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const canonical = `${args.deviceNonce}|${args.deviceId}|${args.proofTimestamp}`;
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

type BleMessageValidator<T> = (value: unknown) => value is T;

export function encodeBleMessage(payload: Record<string, unknown>) {
  return encodeBase64(JSON.stringify(payload));
}

export function decodeBleMessage<T>(encodedValue: string, validate: BleMessageValidator<T>) {
  let jsonPayload = "";
  try {
    jsonPayload = decodeBase64(encodedValue);
  } catch {
    throw new Error("BLE_MESSAGE_BASE64_INVALID");
  }

  let decodedValue: unknown;
  try {
    decodedValue = JSON.parse(jsonPayload);
  } catch {
    throw new Error("BLE_MESSAGE_JSON_INVALID");
  }

  if (!validate(decodedValue)) {
    throw new Error("BLE_MESSAGE_SHAPE_INVALID");
  }

  return decodedValue;
}
