import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  registerWithEmailPassword,
  signInWithEmailPassword,
} from "../../src/features/auth/services/email-auth";
import {
  hasGoogleClientConfig,
  signInWithGoogleIdToken,
} from "../../src/features/auth/services/google-auth";
import {
  buildEnrollmentRouteParams,
  consumePendingDeviceEnrollment,
} from "../../src/features/devices/services/device-linking";
import {
  getPasswordValidationScore,
  isPasswordFullyValid,
} from "../../src/features/auth/services/password-validation";
import { useTheme } from "../../src/theme/theme-provider";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { type ColorPalette } from "../../src/theme/tokens";

WebBrowser.maybeCompleteAuthSession();

type AuthMode = "sign_in" | "create_account";

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const localStyles = useMemo(() => createLocalStyles(colors), [colors]);

  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isCreateMode = mode === "create_account";
  const passwordScore = useMemo(() => getPasswordValidationScore(password), [password]);
  const isPasswordValid = useMemo(() => isPasswordFullyValid(password), [password]);
  const passwordRules = useMemo(
    () => ({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    }),
    [password],
  );

  const googleConfig = useMemo(
    () => ({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    }),
    [],
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: googleConfig.webClientId,
    androidClientId: googleConfig.androidClientId,
    iosClientId: googleConfig.iosClientId,
    selectAccount: true,
  });

  useEffect(() => {
    async function completeGoogleSignIn() {
      if (!response || response.type !== "success") return;

      const idToken = (response as any).params?.id_token as string | undefined;
      if (!idToken) {
        setMessage("Google sign-in returned no ID token.");
        return;
      }

      setIsBusy(true);
      setMessage(null);

      try {
        await signInWithGoogleIdToken(idToken);
        await routeAfterAuth();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Google sign-in failed.");
      } finally {
        setIsBusy(false);
      }
    }

    void completeGoogleSignIn();
  }, [response]);

  async function handleSignIn() {
    if (isBusy) return;
    setIsBusy(true);
    setMessage(null);
    try {
      await signInWithEmailPassword(email.trim(), password);
      await routeAfterAuth();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRegister() {
    if (isBusy) return;
    setIsBusy(true);
    setMessage(null);
    try {
      await registerWithEmailPassword(email.trim(), password);
      await routeAfterAuth();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setIsBusy(false);
    }
  }

  function toggleMode() {
    setMode((current) => (current === "sign_in" ? "create_account" : "sign_in"));
    setMessage(null);
  }

  async function handlePrimarySubmit() {
    if (isCreateMode) {
      await handleRegister();
      return;
    }

    await handleSignIn();
  }

  async function routeAfterAuth() {
    const pendingEnrollment = await consumePendingDeviceEnrollment();
    if (pendingEnrollment) {
      router.replace({
        pathname: "/device/enroll",
        params: buildEnrollmentRouteParams(pendingEnrollment),
      });
      return;
    }

    router.replace("/");
  }

  const primaryButtonText = isCreateMode ? "Create account" : "Sign in";
  const modeLinkText = isCreateMode
    ? "Already have an account? Sign in"
    : "Don't have an account? Create one";
  const isPrimaryDisabled = isBusy || (isCreateMode && !isPasswordValid);

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.heading}>ColdGuard</Text>
        <Text style={styles.subheading}>Secure access for cold-chain teams</Text>

        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
          value={email}
        />

        <View style={localStyles.passwordFieldRow}>
          <TextInput
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry={!isPasswordVisible}
            style={[styles.input, localStyles.passwordInput]}
            value={password}
          />
          <Pressable
            accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
            onPress={() => setIsPasswordVisible((current) => !current)}
            style={localStyles.passwordToggle}
          >
            <Ionicons
              color={colors.primary}
              name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={18}
            />
          </Pressable>
        </View>

        {isCreateMode ? (
          <View style={localStyles.passwordGuidance}>
            <Text style={styles.bodyText}>Password requirements</Text>
            <Text
              style={[
                localStyles.ruleText,
                passwordRules.minLength ? localStyles.rulePassed : localStyles.rulePending,
              ]}
            >
              At least 8 characters
            </Text>
            <Text
              style={[
                localStyles.ruleText,
                passwordRules.hasUppercase ? localStyles.rulePassed : localStyles.rulePending,
              ]}
            >
              One uppercase letter
            </Text>
            <Text
              style={[
                localStyles.ruleText,
                passwordRules.hasLowercase ? localStyles.rulePassed : localStyles.rulePending,
              ]}
            >
              One lowercase letter
            </Text>
            <Text
              style={[
                localStyles.ruleText,
                passwordRules.hasNumber ? localStyles.rulePassed : localStyles.rulePending,
              ]}
            >
              One number
            </Text>

            <View style={localStyles.strengthMeter} testID="password-strength-meter">
              {[0, 1, 2, 3].map((index) => (
                <View
                  key={index}
                  style={[
                    localStyles.strengthSegment,
                    index < passwordScore ? localStyles.segmentActive : localStyles.segmentInactive,
                  ]}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isPrimaryDisabled }}
          disabled={isPrimaryDisabled}
          onPress={() => void handlePrimarySubmit()}
          testID="primary-submit-button"
          style={({ pressed }) => [
            styles.primaryButton,
            pressed ? { backgroundColor: colors.primaryPressed } : null,
            isPrimaryDisabled ? styles.buttonDisabled : null,
          ]}
        >
          {isBusy ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>{primaryButtonText}</Text>
          )}
        </Pressable>

        <Pressable
          disabled={isBusy}
          onPress={toggleMode}
          style={({ pressed }) => [localStyles.modeLinkButton, pressed ? { opacity: 0.7 } : null, isBusy ? styles.buttonDisabled : null]}
        >
          <Text style={localStyles.modeLinkText}>{modeLinkText}</Text>
        </Pressable>

        <View style={localStyles.dividerRow}>
          <View style={localStyles.dividerLine} />
          <Text style={styles.bodyText}>or</Text>
          <View style={localStyles.dividerLine} />
        </View>

        <Pressable
          disabled={isBusy || !request || !hasGoogleClientConfig(googleConfig)}
          onPress={() => void promptAsync()}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed ? { backgroundColor: colors.primaryMuted } : null,
            isBusy || !request || !hasGoogleClientConfig(googleConfig) ? styles.buttonDisabled : null,
          ]}
        >
          <View style={localStyles.googleButtonContent}>
            <AntDesign color="#DB4437" name="google" size={16} />
            <Text style={styles.secondaryButtonText}>Continue with Google</Text>
          </View>
        </Pressable>

        {message ? <Text style={styles.helperText}>{message}</Text> : null}
      </View>
    </View>
  );
}

function createLocalStyles(colors: ColorPalette) {
  return StyleSheet.create({
    passwordFieldRow: {
      position: "relative",
    },
    passwordInput: {
      paddingRight: 72,
    },
    passwordToggle: {
      position: "absolute",
      right: 12,
      top: 11,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    modeLinkButton: {
      alignItems: "center",
      paddingVertical: 2,
    },
    modeLinkText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "600",
      textDecorationLine: "underline",
    },
    passwordGuidance: {
      gap: 4,
      marginTop: -2,
    },
    ruleText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    rulePassed: {
      color: colors.success,
    },
    rulePending: {
      color: colors.textSecondary,
    },
    strengthMeter: {
      flexDirection: "row",
      gap: 6,
      marginTop: 6,
    },
    strengthSegment: {
      flex: 1,
      borderRadius: 999,
      height: 6,
    },
    segmentActive: {
      backgroundColor: colors.success,
    },
    segmentInactive: {
      backgroundColor: colors.border,
    },
    dividerRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      marginVertical: 4,
    },
    dividerLine: {
      backgroundColor: colors.border,
      flex: 1,
      height: 1,
    },
    googleButtonContent: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
    },
  });
}
