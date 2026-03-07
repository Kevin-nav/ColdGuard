import { Stack } from "expo-router";
import { View } from "react-native";
import { AuthProvider } from "../src/features/auth/providers/auth-provider";
import { DashboardBootstrapProvider } from "../src/features/dashboard/providers/dashboard-bootstrap";
import { NetworkBanner } from "../src/features/network/components/network-banner";
import { ThemeProvider, useTheme } from "../src/theme/theme-provider";

function ThemedShell() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NetworkBanner />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <DashboardBootstrapProvider>
        <AuthProvider>
          <ThemedShell />
        </AuthProvider>
      </DashboardBootstrapProvider>
    </ThemeProvider>
  );
}
