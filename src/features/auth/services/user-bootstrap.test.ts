import { makeUserBootstrapPayload } from "./user-bootstrap";

test("creates payload with firebase uid", () => {
  const payload = makeUserBootstrapPayload("uid_1", "nurse@clinic.org");
  expect(payload.firebaseUid).toBe("uid_1");
});
