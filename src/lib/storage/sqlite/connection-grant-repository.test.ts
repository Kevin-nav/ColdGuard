import {
  deleteDeviceActionTicket,
  deleteConnectionGrant,
  getDeviceActionTicket,
  getConnectionGrant,
  saveDeviceActionTicket,
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

test("saves a device action ticket", async () => {
  const record = await saveDeviceActionTicket({
    action: "connect",
    scopeType: "device",
    scopeId: "device-1",
    payloadJson: "{\"ticket\":\"abc\"}",
    expiresAt: 7000,
  });

  expect(mockRunAsync).toHaveBeenCalled();
  expect(record.action).toBe("connect");
  expect(record.scopeType).toBe("device");
  expect(record.scopeId).toBe("device-1");
});

test("loads a cached device action ticket", async () => {
  mockGetFirstAsync.mockResolvedValue({
    action: "decommission",
    scope_type: "admin",
    scope_id: "device-1",
    payload_json: "{\"ticket\":\"admin\"}",
    expires_at: 9000,
    updated_at: 4500,
  });

  await expect(getDeviceActionTicket("admin", "device-1", "decommission")).resolves.toEqual({
    action: "decommission",
    scopeType: "admin",
    scopeId: "device-1",
    payloadJson: "{\"ticket\":\"admin\"}",
    expiresAt: 9000,
    updatedAt: 4500,
  });
});

test("deletes a cached device action ticket", async () => {
  await deleteDeviceActionTicket("device", "device-1", "connect");
  expect(mockRunAsync).toHaveBeenCalledWith(
    "DELETE FROM device_action_tickets WHERE scope_type = ? AND scope_id = ? AND action = ?",
    "device",
    "device-1",
    "connect",
  );
});
