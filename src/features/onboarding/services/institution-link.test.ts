import * as Network from "expo-network";
import {
  linkInstitutionFromQr,
  linkInstitutionWithCredentials,
  listLinkableInstitutions,
  parseInstitutionCode,
} from "./institution-link";
import { mapInstitutionLinkError } from "./institution-link-errors";

const mockMutation = jest.fn();
const mockQuery = jest.fn();
const mockSaveClinicHandshakeToken = jest.fn();

jest.mock("expo-network", () => ({
  getNetworkStateAsync: jest.fn(),
}));

jest.mock("../../../lib/convex/client", () => ({
  getConvexClient: jest.fn(() => ({
    mutation: mockMutation,
    query: mockQuery,
  })),
}));

jest.mock("../../../lib/storage/secure-store", () => ({
  saveClinicHandshakeToken: (token: string) => mockSaveClinicHandshakeToken(token),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
    isConnected: true,
    isInternetReachable: true,
  });
});

test("parses clinic code from qr payload", () => {
  expect(parseInstitutionCode("coldguard://institution/abc123")).toBe("abc123");
});

test("rejects invalid qr payloads", async () => {
  await expect(
    linkInstitutionFromQr({
      qrPayload: "https://example.com/qr",
    }),
  ).rejects.toThrow("INVALID_QR_PAYLOAD");
});

test("lists institutions from convex", async () => {
  mockQuery.mockResolvedValue([
    { id: "i1", hasQr: true, name: "Korle-Bu Teaching Hospital", district: null, region: null },
  ]);

  await expect(listLinkableInstitutions()).resolves.toEqual([
    { id: "i1", hasQr: true, name: "Korle-Bu Teaching Hospital", district: null, region: null },
  ]);
});

test("uses qr linking only to select the institution", async () => {
  mockMutation.mockResolvedValue({
    institutionId: "i1",
    institutionName: "Korle-Bu Teaching Hospital",
    district: "Ablekuma South",
    region: "Greater Accra",
    displayName: null,
  });

  await expect(
    linkInstitutionFromQr({
      qrPayload: "coldguard://institution/korlebu-demo",
    }),
  ).resolves.toEqual({
    institutionId: "i1",
    institutionName: "Korle-Bu Teaching Hospital",
    district: "Ablekuma South",
    region: "Greater Accra",
    displayName: null,
  });

  expect(mockMutation).toHaveBeenCalledWith(expect.anything(), {
    institutionCode: "korlebu-demo",
  });
  expect(mockSaveClinicHandshakeToken).not.toHaveBeenCalled();
});

test("links institution by nurse credentials and stores handshake token", async () => {
  mockMutation.mockResolvedValue({
    institutionId: "i2",
    institutionName: "Tamale Central Hospital",
    handshakeToken: "token-2",
    role: "Supervisor",
    staffId: "TM2001",
    displayName: "Mariam Fuseini",
  });

  await expect(
    linkInstitutionWithCredentials({
      institutionId: "i2",
      staffId: "TM2001",
      passcode: "203844",
    }),
  ).resolves.toEqual({
    institutionId: "i2",
    institutionName: "Tamale Central Hospital",
    handshakeToken: "token-2",
    role: "Supervisor",
    staffId: "TM2001",
    displayName: "Mariam Fuseini",
  });

  expect(mockMutation).toHaveBeenCalledWith(expect.anything(), {
    institutionId: "i2",
    passcode: "203844",
    staffId: "TM2001",
  });
  expect(mockSaveClinicHandshakeToken).toHaveBeenCalledWith("token-2");
});

test("maps institution linking errors to user-facing copy", () => {
  expect(mapInstitutionLinkError(new Error("INVALID_QR_PAYLOAD"))).toBe(
    "This QR code is not a valid ColdGuard institution code.",
  );
  expect(mapInstitutionLinkError(new Error("INSTITUTION_CODE_NOT_RECOGNIZED"))).toBe(
    "This institution code was not recognized.",
  );
  expect(mapInstitutionLinkError(new Error("INVALID_INSTITUTION_CREDENTIALS"))).toBe(
    "Staff ID or passcode is incorrect.",
  );
  expect(mapInstitutionLinkError(new Error("INSTITUTION_CREDENTIAL_LOCKED"))).toBe(
    "Too many attempts. Wait a moment and try again.",
  );
  expect(mapInstitutionLinkError(new Error("INACTIVE_INSTITUTION_CREDENTIAL"))).toBe(
    "This nurse credential has been disabled. Contact your supervisor.",
  );
  expect(mapInstitutionLinkError(new Error("OFFLINE"))).toBe(
    "You are offline. Reconnect to link your institution.",
  );
});
