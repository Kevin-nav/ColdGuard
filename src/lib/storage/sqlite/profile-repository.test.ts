import {
  clearProfileSnapshot,
  getProfileSnapshot,
  saveProfileSnapshot,
} from "./profile-repository";

const mockRunAsync: jest.Mock<any, any> = jest.fn(async () => undefined);
const mockGetFirstAsync: jest.Mock<any, any> = jest.fn(async () => null);

jest.mock("./client", () => ({
  getSQLiteDatabase: jest.fn(async () => ({
    runAsync: mockRunAsync,
  })),
  initializeSQLite: jest.fn(async () => ({
    runAsync: mockRunAsync,
    getFirstAsync: mockGetFirstAsync,
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("saves a profile snapshot with a default nurse role", async () => {
  const snapshot = await saveProfileSnapshot({
    firebaseUid: "u1",
    displayName: "Akosua Mensah",
    email: "akosua@example.com",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1001",
    role: "",
  });

  expect(mockRunAsync).toHaveBeenCalled();
  expect(snapshot.role).toBe("Nurse");
});

test("loads the cached profile snapshot", async () => {
  mockGetFirstAsync.mockResolvedValue({
    firebase_uid: "u1",
    display_name: "Akosua Mensah",
    email: "akosua@example.com",
    institution_name: "Korle-Bu Teaching Hospital",
    staff_id: "KB1001",
    role: "Supervisor",
    last_updated_at: 1234,
  });

  await expect(getProfileSnapshot()).resolves.toEqual({
    firebaseUid: "u1",
    displayName: "Akosua Mensah",
    email: "akosua@example.com",
    institutionName: "Korle-Bu Teaching Hospital",
    staffId: "KB1001",
    role: "Supervisor",
    lastUpdatedAt: 1234,
  });
});

test("clears the cached profile snapshot", async () => {
  await clearProfileSnapshot();
  expect(mockRunAsync).toHaveBeenCalledWith("DELETE FROM profile_cache WHERE id = 1");
});
