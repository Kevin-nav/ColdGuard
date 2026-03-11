import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuthSession } from "../../src/features/auth/providers/auth-provider";
import { seedDashboardDataForInstitution } from "../../src/features/dashboard/services/dashboard-seed";
import { InstitutionCredentialForm } from "../../src/features/onboarding/components/institution-credential-form";
import { InstitutionList } from "../../src/features/onboarding/components/institution-list";
import {
  type LinkableInstitution,
  type InstitutionSelectionResult,
  linkInstitutionFromQr,
  linkInstitutionWithCredentials,
  listLinkableInstitutions,
} from "../../src/features/onboarding/services/institution-link";
import { mapInstitutionLinkError } from "../../src/features/onboarding/services/institution-link-errors";
import { saveProfileSnapshot } from "../../src/lib/storage/sqlite/profile-repository";
import { useTheme } from "../../src/theme/theme-provider";
import { createSharedStyles } from "../../src/theme/shared-styles";

type LinkMethod = "qr" | "credentials" | null;

export default function LinkInstitutionScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const localStyles = useMemo(() => createLocalStyles(), []);

  const { user } = useAuthSession();
  const [method, setMethod] = useState<LinkMethod>(null);
  const [institutions, setInstitutions] = useState<LinkableInstitution[]>([]);
  const [isLoadingInstitutions, setIsLoadingInstitutions] = useState(false);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [qrPayload, setQrPayload] = useState("coldguard://institution/");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadInstitutions();
  }, []);

  async function loadInstitutions() {
    setIsLoadingInstitutions(true);
    try {
      const nextInstitutions = await listLinkableInstitutions();
      setInstitutions(nextInstitutions);
      setMessage(null);
    } catch (error) {
      setMessage(mapInstitutionLinkError(error));
    } finally {
      setIsLoadingInstitutions(false);
    }
  }

  function setLinkMethod(nextMethod: LinkMethod) {
    setMethod(nextMethod);
    setMessage(null);
    setValidationMessage(null);
  }

  function upsertInstitutionSelection(selection: InstitutionSelectionResult) {
    setInstitutions((current) => {
      const existing = current.find((institution) => institution.id === selection.institutionId);
      if (existing) {
        return current;
      }

      return [...current, {
        id: selection.institutionId,
        hasQr: true,
        name: selection.institutionName,
        district: selection.district,
        region: selection.region,
      }].sort((left, right) => left.name.localeCompare(right.name));
    });
  }

  async function handleLinkInstitution() {
    if (isSaving) return;
    if (!user?.uid) {
      setMessage("Sign in first before linking an institution.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const result = await linkInstitutionFromQr({
        qrPayload: qrPayload.trim(),
      });
      upsertInstitutionSelection(result);
      setSelectedInstitutionId(result.institutionId);
      setMethod("credentials");
      setValidationMessage(null);
      setMessage(`Selected ${result.institutionName}. Enter your staff ID and passcode to continue.`);
    } catch (error) {
      setMessage(mapInstitutionLinkError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCredentialLink() {
    if (isSaving) return;
    if (!user?.uid) {
      setMessage("Sign in first before linking an institution.");
      return;
    }

    if (!selectedInstitutionId) {
      setValidationMessage("Select an institution first.");
      return;
    }

    if (!staffId.trim() || !passcode.trim()) {
      setValidationMessage("Enter both staff ID and passcode.");
      return;
    }

    setValidationMessage(null);
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await linkInstitutionWithCredentials({
        institutionId: selectedInstitutionId,
        staffId,
        passcode,
      });

      try {
        await saveProfileSnapshot({
          firebaseUid: user.uid,
          displayName: result.displayName ?? user.displayName ?? "ColdGuard User",
          email: user.email ?? "No email available",
          institutionId: result.institutionId,
          institutionName: result.institutionName,
          staffId: result.staffId ?? staffId.trim(),
          role: result.role,
        });
        await seedDashboardDataForInstitution({
          institutionId: result.institutionId,
          institutionName: result.institutionName,
        });
      } catch (storageError) {
        console.error("Local dashboard setup failed after credential link.", storageError);
      }

      setMessage(`Linked to ${result.institutionName}.`);
      router.replace({
        pathname: "/(onboarding)/profile",
        params: {
          displayName: result.displayName ?? user.displayName ?? "",
          institutionName: result.institutionName,
          role: result.role,
          staffId: result.staffId ?? staffId.trim(),
        },
      });
    } catch (error) {
      setMessage(mapInstitutionLinkError(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.page}
    >
      <ScrollView
        contentContainerStyle={localStyles.pageContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {method ? (
            <Pressable
              onPress={() => setLinkMethod(null)}
              style={localStyles.backButton}
              testID="link-method-back"
            >
              <Text style={[localStyles.backButtonText, { color: colors.primary }]}>
                Back to linking options
              </Text>
            </Pressable>
          ) : null}

          <Text style={styles.heading}>Link your clinic</Text>
          <Text style={styles.subheading}>
            {method === null
              ? "Choose how you want to connect your ColdGuard account to the correct institution."
              : method === "qr"
                ? "Paste the ColdGuard QR payload provided by your facility to select the institution, then continue with staff credentials."
                : "Select your institution and enter the nurse credentials assigned to you."}
          </Text>

          {method === null ? (
            <View style={localStyles.methodRow}>
              <Pressable
                onPress={() => setLinkMethod("qr")}
                style={[
                  localStyles.methodButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                testID="link-method-qr"
              >
                <Text style={[localStyles.methodTitle, { color: colors.textPrimary }]}>
                  Scan QR code
                </Text>
                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                  Use the institution QR payload to preselect your facility.
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setLinkMethod("credentials")}
                style={[
                  localStyles.methodButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                testID="link-method-credentials"
              >
                <Text style={[localStyles.methodTitle, { color: colors.textPrimary }]}>
                  Enter institution credentials
                </Text>
                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                  Choose your facility and sign in with your nurse-issued staff ID and passcode.
                </Text>
              </Pressable>
            </View>
          ) : null}

          {method === "qr" ? (
            <View style={localStyles.section}>
              <TextInput
                autoCapitalize="none"
                onChangeText={setQrPayload}
                placeholder="coldguard://institution/..."
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={qrPayload}
              />

              <Pressable
                disabled={isSaving}
                onPress={handleLinkInstitution}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed ? { backgroundColor: colors.primaryPressed } : null,
                  isSaving ? styles.buttonDisabled : null,
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.primaryButtonText}>Continue with QR code</Text>
                )}
              </Pressable>
            </View>
          ) : null}

          {method === "credentials" ? (
            <View style={localStyles.section}>
              {isLoadingInstitutions ? (
                <View style={localStyles.loadingState}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.bodyText}>Loading institutions...</Text>
                </View>
              ) : institutions.length === 0 ? (
                <View style={localStyles.emptyState}>
                  <Text style={styles.bodyText}>No institutions are available yet.</Text>
                  <Pressable
                    onPress={() => void loadInstitutions()}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Retry</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={styles.bodyText}>
                    {selectedInstitutionId
                      ? `Selected institution: ${
                          institutions.find((institution) => institution.id === selectedInstitutionId)?.name ?? ""
                        }`
                      : "Choose your institution before entering staff ID and passcode."}
                  </Text>

                  <InstitutionList
                    colors={colors}
                    institutions={institutions}
                    onSelectInstitution={(institutionId) => {
                      setSelectedInstitutionId(institutionId);
                      setValidationMessage(null);
                    }}
                    selectedInstitutionId={selectedInstitutionId}
                  />

                  <InstitutionCredentialForm
                    colors={colors}
                    isSaving={isSaving}
                    onChangePasscode={setPasscode}
                    onChangeStaffId={setStaffId}
                    onSubmit={() => void handleCredentialLink()}
                    passcode={passcode}
                    staffId={staffId}
                    validationMessage={validationMessage}
                  />
                </>
              )}
            </View>
          ) : null}

          {message ? <Text style={styles.helperText}>{message}</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createLocalStyles() {
  return StyleSheet.create({
    pageContent: {
      flexGrow: 1,
      justifyContent: "center",
    },
    backButton: {
      alignSelf: "flex-start",
      paddingVertical: 2,
    },
    backButtonText: {
      fontSize: 13,
      fontWeight: "600",
    },
    methodRow: {
      gap: 10,
    },
    methodButton: {
      borderRadius: 12,
      borderWidth: 1,
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    methodTitle: {
      fontSize: 15,
      fontWeight: "700",
    },
    section: {
      gap: 12,
    },
    loadingState: {
      alignItems: "center",
      gap: 10,
      paddingVertical: 16,
    },
    emptyState: {
      gap: 12,
    },
  });
}
