import { ensureLocalProfileForUser } from "./profile-hydration";

const mockQuery = jest.fn();
const mockGetProfileSnapshot = jest.fn();
const mockSaveProfileSnapshot = jest.fn();
const mockClearProfileSnapshot = jest.fn();

jest.mock("../../../lib/convex/client", () => ({
  getConvexClient: jest.fn(() => ({
    query: mockQuery,
  })),
}));

jest.mock("../../../lib/storage/sqlite/profile-repository", () => ({
  clearProfileSnapshot: () => mockClearProfileSnapshot(),
  getProfileSnapshot: () => mockGetProfileSnapshot(),
  saveProfileSnapshot: (snapshot: unknown) => mockSaveProfileSnapshot(snapshot),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("returns the cached snapshot when it belongs to the active firebase user", async () => {
  const cachedProfile = {
    firebaseUid: "firebase-user-1",
    displayName: "Cached User",
    email: "cached@example.com",
    institutionId: "institution-1",
    institutionName: "Korle-Bu",
    staffId: "KB-1",
    role: "Supervisor",
    lastUpdatedAt: 100,
  };

  mockGetProfileSnapshot.mockResolvedValue(cachedProfile);

  await expect(
    ensureLocalProfileForUser({
      firebaseUid: "firebase-user-1",
      email: "fresh@example.com",
      displayName: "Fresh User",
    }),
  ).resolves.toEqual(cachedProfile);

  expect(mockClearProfileSnapshot).not.toHaveBeenCalled();
  expect(mockQuery).not.toHaveBeenCalled();
  expect(mockSaveProfileSnapshot).not.toHaveBeenCalled();
});

test("evicts a mismatched cached snapshot and reloads the requested firebase user", async () => {
  mockGetProfileSnapshot.mockResolvedValue({
    firebaseUid: "firebase-user-1",
    displayName: "Wrong User",
    email: "wrong@example.com",
    institutionName: "Korle-Bu",
    staffId: "KB-1",
    role: "Supervisor",
    lastUpdatedAt: 100,
  });
  mockQuery.mockResolvedValue({
    firebaseUid: "firebase-user-2",
    displayName: null,
    email: null,
    institutionId: "institution-2",
    institutionName: "Tamale Central",
    staffId: "TM-2",
    role: null,
  });
  mockSaveProfileSnapshot.mockImplementation(async (snapshot) => ({
    ...((snapshot as object) ?? {}),
    lastUpdatedAt: 200,
  }));

  await expect(
    ensureLocalProfileForUser({
      firebaseUid: "firebase-user-2",
      email: "fresh@example.com",
      displayName: "Fresh User",
    }),
  ).resolves.toEqual({
    firebaseUid: "firebase-user-2",
    displayName: "Fresh User",
    email: "fresh@example.com",
    institutionId: "institution-2",
    institutionName: "Tamale Central",
    staffId: "TM-2",
    role: "Nurse",
    lastUpdatedAt: 200,
  });

  expect(mockClearProfileSnapshot).toHaveBeenCalledTimes(1);
  expect(mockQuery).toHaveBeenCalledWith(expect.anything());
  expect(mockSaveProfileSnapshot).toHaveBeenCalledWith({
    firebaseUid: "firebase-user-2",
    displayName: "Fresh User",
    email: "fresh@example.com",
    institutionId: "institution-2",
    institutionName: "Tamale Central",
    staffId: "TM-2",
    role: "Nurse",
  });
});

test("evicts a same-user cached snapshot when the migrated institution id is blank", async () => {
  mockGetProfileSnapshot.mockResolvedValue({
    firebaseUid: "firebase-user-1",
    displayName: "Cached User",
    email: "cached@example.com",
    institutionId: "",
    institutionName: "Korle-Bu",
    staffId: "KB-1",
    role: "Supervisor",
    lastUpdatedAt: 100,
  });
  mockQuery.mockResolvedValue({
    firebaseUid: "firebase-user-1",
    displayName: "Fresh User",
    email: "fresh@example.com",
    institutionId: "institution-1",
    institutionName: "Korle-Bu",
    staffId: "KB-1",
    role: "Supervisor",
  });
  mockSaveProfileSnapshot.mockImplementation(async (snapshot) => ({
    ...((snapshot as object) ?? {}),
    lastUpdatedAt: 300,
  }));

  await expect(
    ensureLocalProfileForUser({
      firebaseUid: "firebase-user-1",
      email: "fresh@example.com",
      displayName: "Fresh User",
    }),
  ).resolves.toEqual({
    firebaseUid: "firebase-user-1",
    displayName: "Fresh User",
    email: "fresh@example.com",
    institutionId: "institution-1",
    institutionName: "Korle-Bu",
    staffId: "KB-1",
    role: "Supervisor",
    lastUpdatedAt: 300,
  });

  expect(mockClearProfileSnapshot).toHaveBeenCalledTimes(1);
  expect(mockQuery).toHaveBeenCalledWith(expect.anything());
});
