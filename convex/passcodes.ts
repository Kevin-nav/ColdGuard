const PASSCODE_HASH_PREFIX = "pbkdf2_sha256";
const PASSCODE_HASH_ITERATIONS = 120_000;
const PASSCODE_SALT_BYTES = 16;
const PASSCODE_HASH_BYTES = 32;

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  const normalized = hex.trim();
  if (normalized.length % 2 !== 0) {
    return null;
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    const parsed = Number.parseInt(normalized.slice(index, index + 2), 16);
    if (Number.isNaN(parsed)) {
      return null;
    }
    bytes[index / 2] = parsed;
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

async function derivePasscodeHash(passcode: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", encodeUtf8(passcode), "PBKDF2", false, [
    "deriveBits",
  ]);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: PASSCODE_HASH_ITERATIONS,
      salt: salt as unknown as BufferSource,
    },
    material,
    PASSCODE_HASH_BYTES * 8,
  );

  return new Uint8Array(derivedBits);
}

export function isHashedPasscode(value: string) {
  return value.startsWith(`${PASSCODE_HASH_PREFIX}$`);
}

export async function hashInstitutionPasscode(passcode: string) {
  const normalizedPasscode = passcode.trim();
  const salt = crypto.getRandomValues(new Uint8Array(PASSCODE_SALT_BYTES));
  const hash = await derivePasscodeHash(normalizedPasscode, salt);
  return `${PASSCODE_HASH_PREFIX}$${PASSCODE_HASH_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

export async function verifyInstitutionPasscode(storedPasscode: string, inputPasscode: string) {
  const normalizedInput = inputPasscode.trim();

  if (!isHashedPasscode(storedPasscode)) {
    return constantTimeEqual(encodeUtf8(storedPasscode), encodeUtf8(normalizedInput));
  }

  const [prefix, iterationsValue, saltHex, expectedHashHex] = storedPasscode.split("$");
  if (
    prefix !== PASSCODE_HASH_PREFIX ||
    !iterationsValue ||
    !saltHex ||
    !expectedHashHex ||
    Number.parseInt(iterationsValue, 10) !== PASSCODE_HASH_ITERATIONS
  ) {
    return false;
  }

  const saltBytes = hexToBytes(saltHex);
  const expectedHashBytes = hexToBytes(expectedHashHex);
  if (!saltBytes || !expectedHashBytes) {
    return false;
  }

  const derivedHash = await derivePasscodeHash(normalizedInput, saltBytes);
  return constantTimeEqual(derivedHash, expectedHashBytes);
}
