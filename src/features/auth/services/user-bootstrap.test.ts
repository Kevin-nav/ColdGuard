import { makeUserBootstrapPayload } from "./user-bootstrap";

test("creates payload without caller-supplied firebase uid", () => {
  const payload = makeUserBootstrapPayload("nurse@clinic.org", "Akosua Mensah");
  expect(payload).toEqual({
    email: "nurse@clinic.org",
    displayName: "Akosua Mensah",
  });
});
