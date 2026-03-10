import { decodeBleMessage, encodeBleMessage } from "./protocol";

type TestPayload = {
  ok: boolean;
  requestId: string;
};

function isTestPayload(value: unknown): value is TestPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.ok === "boolean" &&
    typeof candidate.requestId === "string"
  );
}

test("encodes and decodes BLE payloads without browser globals", () => {
  const encoded = encodeBleMessage({
    ok: true,
    requestId: "req-1",
  });

  expect(decodeBleMessage(encoded, isTestPayload)).toEqual({
    ok: true,
    requestId: "req-1",
  });
});

test("throws a clear error when the BLE payload is not valid base64", () => {
  expect(() => decodeBleMessage("%", isTestPayload)).toThrow("BLE_MESSAGE_BASE64_INVALID");
});

test("throws a clear error when the BLE payload shape is invalid", () => {
  const encoded = encodeBleMessage({
    ok: "yes",
    requestId: 1,
  });

  expect(() => decodeBleMessage(encoded, isTestPayload)).toThrow("BLE_MESSAGE_SHAPE_INVALID");
});
