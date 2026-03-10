import {
  deleteConnectionGrant,
  getConnectionGrant,
  saveConnectionGrant,
} from "./connection-grant-repository";

const mockRunAsync: jest.Mock<any, any> = jest.fn(async () => undefined);
const mockGetFirstAsync: jest.Mock<any, any> = jest.fn(async () => null);

jest.mock("./client", () => ({
  initializeSQLite: jest.fn(async () => ({
    runAsync: mockRunAsync,
    getFirstAsync: mockGetFirstAsync,
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("saves a connection grant", async () => {
  const record = await saveConnectionGrant({
    scopeType: "device",
    scopeId: "device-1",
    payloadJson: "{\"grant\":\"abc\"}",
    expiresAt: 5000,
  });

  expect(mockRunAsync).toHaveBeenCalled();
  expect(record.scopeType).toBe("device");
  expect(record.scopeId).toBe("device-1");
});

test("loads a cached connection grant", async () => {
  mockGetFirstAsync.mockResolvedValue({
    scope_type: "admin",
    scope_id: "institution-1",
    payload_json: "{\"grant\":\"admin\"}",
    expires_at: 6000,
    updated_at: 4000,
  });

  await expect(getConnectionGrant("admin", "institution-1")).resolves.toEqual({
    scopeType: "admin",
    scopeId: "institution-1",
    payloadJson: "{\"grant\":\"admin\"}",
    expiresAt: 6000,
    updatedAt: 4000,
  });
});

test("deletes a cached connection grant", async () => {
  await deleteConnectionGrant("device", "device-1");
  expect(mockRunAsync).toHaveBeenCalledWith(
    "DELETE FROM connection_grants WHERE scope_type = ? AND scope_id = ?",
    "device",
    "device-1",
  );
});
