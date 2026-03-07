import { Text } from "react-native";
import { useTheme } from "../../../theme/theme-provider";
import { AuthStage } from "../state/auth-state";

export function AuthGate({
  stage,
  children,
}: {
  stage: AuthStage;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();

  if (stage === "signed_out")
    return <Text style={{ color: colors.textPrimary }}>Sign in to continue</Text>;
  if (stage === "signed_in_unlinked")
    return <Text style={{ color: colors.textPrimary }}>Link your institution</Text>;
  return <>{children}</>;
}
