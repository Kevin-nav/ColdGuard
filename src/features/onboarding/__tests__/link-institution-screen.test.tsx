import { fireEvent, render, waitFor } from "@testing-library/react-native";
import LinkInstitutionScreen from "../../../../app/(onboarding)/link-institution";

const mockReplace = jest.fn();
const mockListLinkableInstitutions = jest.fn();
const mockLinkInstitutionFromQr = jest.fn();
const mockLinkInstitutionWithCredentials = jest.fn();
const mockSaveProfileSnapshot = jest.fn();
const mockSeedDashboardDataForInstitution = jest.fn();

jest.mock("expo-router", () => ({
  router: { replace: (path: string) => mockReplace(path) },
}));

jest.mock("../../../../src/features/auth/providers/auth-provider", () => ({
  useAuthSession: jest.fn(() => ({
    user: { uid: "firebase-user-1" },
  })),
}));

jest.mock("../../../../src/features/onboarding/services/institution-link", () => ({
  listLinkableInstitutions: () => mockListLinkableInstitutions(),
  linkInstitutionFromQr: (args: unknown) => mockLinkInstitutionFromQr(args),
  linkInstitutionWithCredentials: (args: unknown) => mockLinkInstitutionWithCredentials(args),
}));

jest.mock("../../../../src/lib/storage/sqlite/profile-repository", () => ({
  saveProfileSnapshot: (args: unknown) => mockSaveProfileSnapshot(args),
}));

jest.mock("../../../../src/features/dashboard/services/dashboard-seed", () => ({
  seedDashboardDataForInstitution: (institutionName: string) =>
    mockSeedDashboardDataForInstitution(institutionName),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockListLinkableInstitutions.mockResolvedValue([
    {
      id: "inst-1",
      code: "korlebu-demo",
      name: "Korle-Bu Teaching Hospital",
      district: "Ablekuma South",
      region: "Greater Accra",
    },
  ]);
  mockSaveProfileSnapshot.mockResolvedValue(undefined);
  mockSeedDashboardDataForInstitution.mockResolvedValue(undefined);
});

test("renders both institution link methods", async () => {
  const ui = render(<LinkInstitutionScreen />);

  await waitFor(() => expect(mockListLinkableInstitutions).toHaveBeenCalled());
  expect(ui.getByTestId("link-method-qr")).toBeTruthy();
  expect(ui.getByTestId("link-method-credentials")).toBeTruthy();
  expect(ui.queryByPlaceholderText("coldguard://institution/...")).toBeNull();
});

test("switches to credential mode and validates empty fields", async () => {
  const ui = render(<LinkInstitutionScreen />);

  await waitFor(() => expect(mockListLinkableInstitutions).toHaveBeenCalled());
  fireEvent.press(ui.getByTestId("link-method-credentials"));
  fireEvent.press(ui.getByText("Link with credentials"));

  expect(ui.getByText("Select an institution first.")).toBeTruthy();
});

test("submits qr linking path", async () => {
  mockLinkInstitutionFromQr.mockResolvedValue({
    institutionId: "inst-1",
    institutionName: "Korle-Bu Teaching Hospital",
    handshakeToken: "token-1",
    role: "Nurse",
    staffId: null,
    displayName: null,
  });

  const ui = render(<LinkInstitutionScreen />);
  await waitFor(() => expect(mockListLinkableInstitutions).toHaveBeenCalled());

  fireEvent.press(ui.getByTestId("link-method-qr"));
  fireEvent.changeText(ui.getByPlaceholderText("coldguard://institution/..."), "coldguard://institution/korlebu-demo");
  fireEvent.press(ui.getByText("Link with QR code"));

  await waitFor(() =>
    expect(mockLinkInstitutionFromQr).toHaveBeenCalledWith({
      firebaseUid: "firebase-user-1",
      qrPayload: "coldguard://institution/korlebu-demo",
    }),
  );
  expect(mockSaveProfileSnapshot).toHaveBeenCalled();
  expect(mockSeedDashboardDataForInstitution).toHaveBeenCalledWith("Korle-Bu Teaching Hospital");
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: "/(onboarding)/profile",
    params: {
      displayName: "",
      institutionName: "Korle-Bu Teaching Hospital",
      role: "Nurse",
      staffId: "",
    },
  });
});

test("submits credential linking path", async () => {
  mockLinkInstitutionWithCredentials.mockResolvedValue({
    institutionId: "inst-1",
    institutionName: "Korle-Bu Teaching Hospital",
    handshakeToken: "token-1",
    role: "Supervisor",
    staffId: "KB1001",
    displayName: "Yaw Boateng",
  });

  const ui = render(<LinkInstitutionScreen />);
  await waitFor(() => expect(mockListLinkableInstitutions).toHaveBeenCalled());

  fireEvent.press(ui.getByTestId("link-method-credentials"));
  fireEvent.press(ui.getByText("Korle-Bu Teaching Hospital"));
  fireEvent.changeText(ui.getByPlaceholderText("Staff ID"), "KB1001");
  fireEvent.changeText(ui.getByPlaceholderText("Passcode"), "482913");
  fireEvent.press(ui.getByText("Link with credentials"));

  await waitFor(() =>
    expect(mockLinkInstitutionWithCredentials).toHaveBeenCalledWith({
      firebaseUid: "firebase-user-1",
      institutionId: "inst-1",
      passcode: "482913",
      staffId: "KB1001",
    }),
  );
  expect(mockSaveProfileSnapshot).toHaveBeenCalled();
  expect(mockSeedDashboardDataForInstitution).toHaveBeenCalledWith("Korle-Bu Teaching Hospital");
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: "/(onboarding)/profile",
    params: {
      displayName: "Yaw Boateng",
      institutionName: "Korle-Bu Teaching Hospital",
      role: "Supervisor",
      staffId: "KB1001",
    },
  });
});

test("shows only the credential flow after selecting credential mode", async () => {
  const ui = render(<LinkInstitutionScreen />);
  await waitFor(() => expect(mockListLinkableInstitutions).toHaveBeenCalled());

  fireEvent.press(ui.getByTestId("link-method-credentials"));

  expect(ui.getByText("Choose your institution before entering staff ID and passcode.")).toBeTruthy();
  expect(ui.getByPlaceholderText("Staff ID")).toBeTruthy();
  expect(ui.getByPlaceholderText("Passcode")).toBeTruthy();
  expect(ui.queryByPlaceholderText("coldguard://institution/...")).toBeNull();
  expect(ui.getByTestId("link-method-back")).toBeTruthy();
});
