import { __testing } from "./users";

test("normalizes any non-supervisor role to Nurse", () => {
  expect(__testing.normalizeUserRole("Nurse")).toBe("Nurse");
  expect(__testing.normalizeUserRole("Supervisor")).toBe("Supervisor");
  expect(__testing.normalizeUserRole("Admin")).toBe("Nurse");
  expect(__testing.normalizeUserRole(undefined)).toBe("Nurse");
});

test("qr institution selection resolves institution data without patching the user", async () => {
  const unique = jest
    .fn()
    .mockResolvedValueOnce({
      _id: "user-1",
      displayName: "Akosua Mensah",
    })
    .mockResolvedValueOnce({
      _id: "institution-1",
      name: "Korle-Bu Teaching Hospital",
      district: "Ablekuma South",
      region: "Greater Accra",
    });
  const withIndex = jest.fn(() => ({
    unique,
  }));
  const query = jest.fn(() => ({
    withIndex,
  }));
  const patch = jest.fn();

  await expect(
    __testing.resolveInstitutionSelectionForQr(
      {
        db: {
          query,
          patch,
        },
      },
      {
        firebaseUid: "firebase-user-1",
        institutionCode: "korlebu-demo",
      },
    ),
  ).resolves.toEqual({
    institutionId: "institution-1",
    institutionName: "Korle-Bu Teaching Hospital",
    district: "Ablekuma South",
    region: "Greater Accra",
    displayName: "Akosua Mensah",
  });

  expect(patch).not.toHaveBeenCalled();
});
