import { render } from "@testing-library/react-native";
import Index from "../../../app/index";

jest.mock("expo-router", () => ({
  Redirect: () => null,
}));

jest.mock("../../../src/features/auth/providers/auth-provider", () => ({
  useAuthSession: jest.fn(() => ({
    isLoading: false,
    user: null,
  })),
}));

jest.mock("../../../src/lib/storage/sqlite/profile-repository", () => ({
  getProfileSnapshot: jest.fn(),
}));

jest.mock("../../../src/features/dashboard/services/profile-hydration", () => ({
  ensureLocalProfileForUser: jest.fn(),
}));

jest.mock("../../../src/theme/theme-provider", () => ({
  useTheme: jest.fn(() => ({
    colors: {
      background: "#fff",
      primary: "#000",
    },
  })),
}));

test("root index screen renders", () => {
  const { toJSON } = render(<Index />);
  expect(toJSON()).toBeNull();
});
