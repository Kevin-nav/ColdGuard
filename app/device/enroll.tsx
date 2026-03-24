import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ColdGuardEnrollmentProgressEvent } from "../../modules/coldguard-wifi-bridge";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { useAuthSession } from "../../src/features/auth/providers/auth-provider";
import { ensureLocalProfileForUser } from "../../src/features/dashboard/services/profile-hydration";
import {
  discardPendingDeviceEnrollment,
  parseDeviceEnrollmentLink,
  persistPendingDeviceEnrollment,
  type PendingDeviceEnrollment,
} from "../../src/features/devices/services/device-linking";
import { enrollColdGuardDevice } from "../../src/features/devices/services/connection-service";
import { presentDeviceError, type PresentedDeviceError } from "../../src/features/devices/services/error-presenter";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";

const INITIAL_ENROLLMENT_STAGE: ColdGuardEnrollmentProgressEvent = {
  attempt: 1,
  detail: "Preparing the pairing flow on this phone.",
  deviceId: null,
  elapsedMs: 0,
  stage: "validating_request",
  stageLabel: "Preparing setup",
};

function resolvePayloadFromParams(params: { claim?: string; deviceId?: string; payload?: string; v?: string }) {
  if (typeof params.payload === "string" && params.payload.trim()) {
    return parseDeviceEnrollmentLink(params.payload);
  }

  if (
    typeof params.deviceId === "string" &&
    typeof params.claim === "string" &&
    typeof params.v === "string"
  ) {
    return parseDeviceEnrollmentLink(
      `https://coldguard.org/device/${encodeURIComponent(params.deviceId)}?claim=${encodeURIComponent(params.claim)}&v=${encodeURIComponent(params.v)}`,
    );
  }

  return null;
}

export default function DeviceEnrollmentScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const { user, isLoading: isAuthLoading } = useAuthSession();
  const params = useLocalSearchParams<{
    claim?: string;
    deviceId?: string;
    nickname?: string;
    payload?: string;
    v?: string;
  }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [profileState, setProfileState] = useState<{
    error: string | null;
    isLoading: boolean;
    profile: Awaited<ReturnType<typeof ensureLocalProfileForUser>> | null;
  }>({
    error: null,
    isLoading: true,
    profile: null,
  });
  const [nickname, setNickname] = useState("");
  const [feedback, setFeedback] = useState<PresentedDeviceError | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [developerDetails, setDeveloperDetails] = useState<string | null>(null);
  const [enrollmentStage, setEnrollmentStage] = useState<ColdGuardEnrollmentProgressEvent | null>(null);
  const enrollmentStageRef = useRef<ColdGuardEnrollmentProgressEvent | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isEnrollmentModalVisible, setIsEnrollmentModalVisible] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const initialPayload = useMemo(
    () =>
      resolvePayloadFromParams({
        claim: params.claim,
        deviceId: params.deviceId,
        payload: params.payload,
        v: params.v,
      }),
    [params.claim, params.deviceId, params.payload, params.v],
  );
  const [payload, setPayload] = useState<PendingDeviceEnrollment | null>(initialPayload);
  const [payloadInput, setPayloadInput] = useState(() => initialPayload?.sourceUrl ?? "");

  useEffect(() => {
    const nextPayload = initialPayload;
    if (nextPayload) {
      setPayload((current) => (current?.sourceUrl === nextPayload.sourceUrl ? current : nextPayload));
      setPayloadInput((current) => (current === nextPayload.sourceUrl ? current : nextPayload.sourceUrl));
      void persistPendingDeviceEnrollment(nextPayload);
    }
    if (!nextPayload) {
      setPayload((current) => (current === null ? current : null));
      setPayloadInput((current) => (current === "" ? current : ""));
    }
    if (typeof params.nickname === "string" && params.nickname.trim()) {
      const nextNickname = params.nickname.trim();
      setNickname((current) => (current === nextNickname ? current : nextNickname));
    }
  }, [initialPayload, params.nickname]);

  useEffect(() => {
    let isMounted = true;

    async function prepare() {
      if (isAuthLoading) {
        return;
      }

      if (!user?.uid) {
        if (payload) {
          await persistPendingDeviceEnrollment(payload);
        }
        router.replace("/(auth)/login");
        return;
      }

      try {
        const profile = await ensureLocalProfileForUser({
          firebaseUid: user.uid,
          email: user.email,
          displayName: user.displayName,
        });

        if (!isMounted) return;

        setProfileState({
          error: profile?.institutionId ? null : "Link your institution before enrolling a device.",
          isLoading: false,
          profile,
        });
      } catch (error) {
        if (!isMounted) return;
        setProfileState({
          error: error instanceof Error ? error.message : "Profile could not be loaded.",
          isLoading: false,
          profile: null,
        });
      }
    }

    void prepare();

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, payload, user?.uid, user?.email, user?.displayName]);

  async function handleScannerOpen() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setFeedback({ developerCode: null, userMessage: "Camera permission is required to scan a device QR code." });
        return;
      }
    }

    setShowScanner(true);
    setFeedback(null);
    setCopyMessage(null);
  }

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    try {
      const parsed = parseDeviceEnrollmentLink(result.data);
      setPayload(parsed);
      setPayloadInput(parsed.sourceUrl);
      setShowScanner(false);
      setFeedback({ developerCode: null, userMessage: `Scanned ${parsed.deviceId}.` });
      void persistPendingDeviceEnrollment(parsed);
    } catch (error) {
      setFeedback(presentDeviceError(error, "Invalid device QR payload."));
    }
  }

  async function handleEnroll() {
    if (!profileState.profile || profileState.profile.role !== "Supervisor" || !payload) {
      return;
    }

    setIsBusy(true);
    setFeedback(null);
    setCopyMessage(null);
    setDeveloperDetails(null);
    enrollmentStageRef.current = INITIAL_ENROLLMENT_STAGE;
    setEnrollmentStage(INITIAL_ENROLLMENT_STAGE);
    setIsEnrollmentModalVisible(true);

    try {
      const result = await enrollColdGuardDevice({
        nickname: nickname.trim() || `ColdGuard ${payload.deviceId.slice(-4).toUpperCase()}`,
        onProgress: (event) => {
          enrollmentStageRef.current = event;
          setEnrollmentStage(event);
        },
        profile: profileState.profile,
        qrPayload: payload.qrPayload,
      });
      await discardPendingDeviceEnrollment();
      router.replace(`/device/${result.deviceId}`);
    } catch (error) {
      if (error instanceof Error && error.message === "CLINIC_HANDSHAKE_TOKEN_MISSING") {
        await persistPendingDeviceEnrollment(payload);
        router.replace("/(onboarding)/link-institution");
        return;
      }
      const nextFeedback = presentDeviceError(error, "Device enrollment failed.");
      setFeedback(nextFeedback);
      setDeveloperDetails(
        [
          `deviceId: ${payload.deviceId}`,
          `stage: ${enrollmentStageRef.current?.stage ?? enrollmentStage?.stage ?? "unknown"}`,
          `stageLabel: ${enrollmentStageRef.current?.stageLabel ?? enrollmentStage?.stageLabel ?? "Unknown stage"}`,
          `stageDetail: ${enrollmentStageRef.current?.detail ?? enrollmentStage?.detail ?? "n/a"}`,
          `elapsedMs: ${enrollmentStageRef.current?.elapsedMs ?? enrollmentStage?.elapsedMs ?? 0}`,
          `developerCode: ${nextFeedback.developerCode ?? "n/a"}`,
          `error: ${error instanceof Error ? error.message : "Unknown enrollment error"}`,
        ].join("\n"),
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCopyDeveloperCode() {
    const value = developerDetails ?? feedback?.developerCode;
    if (!value) {
      return;
    }

    await Clipboard.setStringAsync(value);
    setCopyMessage(developerDetails ? "Developer details copied." : "Developer code copied.");
  }

  function handleDismissEnrollmentModal() {
    if (isBusy) {
      return;
    }
    setIsEnrollmentModalVisible(false);
  }

  function renderBackButton() {
    return (
      <Pressable onPress={() => router.replace("/(tabs)/devices")} style={localStyles.backButton}>
        <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
        <Text style={[styles.secondaryButtonText, localStyles.backButtonText]}>Back to devices</Text>
      </Pressable>
    );
  }

  function renderEnrollmentModal() {
    const stageLabel = enrollmentStage?.stageLabel ?? "Preparing setup";
    const stageDetail =
      enrollmentStage?.detail ??
      "ColdGuard will pair over Bluetooth, briefly verify the device Wi-Fi link, then return to the app.";

    return (
      <Modal animationType="fade" onRequestClose={handleDismissEnrollmentModal} transparent visible={isEnrollmentModalVisible}>
        <View style={localStyles.modalBackdrop}>
          <View style={[localStyles.modalCard, { backgroundColor: colors.surface }]}>
            {isBusy ? <ActivityIndicator color={colors.primary} size="large" /> : <Ionicons color={colors.primary} name="alert-circle" size={28} />}
            <Text style={localStyles.modalTitle}>{isBusy ? stageLabel : "Enrollment paused"}</Text>
            <Text style={[styles.bodyText, localStyles.modalBody]}>{isBusy ? stageDetail : feedback?.userMessage ?? "Device enrollment failed."}</Text>
            {isBusy ? (
              <Text style={styles.helperText}>
                The phone may briefly switch to the ColdGuard device Wi-Fi to verify setup before finishing.
              </Text>
            ) : null}
            {!isBusy && enrollmentStage ? (
              <Text style={styles.helperText}>
                Last stage: {enrollmentStage.stageLabel}
                {enrollmentStage.detail ? ` - ${enrollmentStage.detail}` : ""}
              </Text>
            ) : null}
            {!isBusy && (developerDetails || feedback?.developerCode) ? (
              <View style={localStyles.modalActions}>
                <Pressable onPress={() => void handleCopyDeveloperCode()} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Copy developer details</Text>
                </Pressable>
                <Pressable onPress={handleDismissEnrollmentModal} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Close</Text>
                </Pressable>
              </View>
            ) : null}
            {!isBusy && !(developerDetails || feedback?.developerCode) ? (
              <Pressable onPress={handleDismissEnrollmentModal} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Close</Text>
              </Pressable>
            ) : null}
            {copyMessage ? <Text style={styles.helperText}>{copyMessage}</Text> : null}
          </View>
        </View>
      </Modal>
    );
  }

  if (isAuthLoading || profileState.isLoading) {
    return (
      <DashboardPage>
        <View style={localStyles.centerContent}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </DashboardPage>
    );
  }

  if (showScanner) {
    return (
      <DashboardPage>
        {renderBackButton()}
        <DashboardSection title="Scan Device QR" eyebrow="Camera" description="Point the camera at the ColdGuard device QR label.">
          <PanelCard>
            <View style={localStyles.cameraContainer}>
              <CameraView
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={handleBarcodeScanned}
                style={localStyles.camera}
              />
            </View>
            <Pressable onPress={() => setShowScanner(false)} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel scanning</Text>
            </Pressable>
          </PanelCard>
        </DashboardSection>
      </DashboardPage>
    );
  }

  if (profileState.error && !profileState.profile?.institutionId) {
    return (
      <DashboardPage>
        {renderBackButton()}
        <DashboardSection title="Institution Required" eyebrow="Blocked" description="Complete your facility setup before enrolling a device.">
          <PanelCard>
            <Text style={styles.bodyText}>{profileState.error}</Text>
            <Pressable onPress={() => router.replace("/(onboarding)/link-institution")} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Link institution</Text>
            </Pressable>
          </PanelCard>
        </DashboardSection>
      </DashboardPage>
    );
  }

  if (profileState.profile?.role !== "Supervisor") {
    return (
      <DashboardPage>
        {renderBackButton()}
        <DashboardSection title="Supervisor Required" eyebrow="Access denied" description="Only supervisors can enroll ColdGuard devices.">
          <PanelCard>
            <Text style={styles.bodyText}>
              This QR opened the enrollment flow for {payload?.deviceId ?? "a device"}, but your role does not allow provisioning.
            </Text>
          </PanelCard>
        </DashboardSection>
      </DashboardPage>
    );
  }

  return (
    <DashboardPage contentContainerStyle={localStyles.pageContent} scroll>
      {renderEnrollmentModal()}
      {renderBackButton()}
      <DashboardSection title="Enroll Device" eyebrow="Supervisor setup" description="Complete real BLE enrollment for the scanned ColdGuard unit.">
        <PanelCard>
          <Text style={styles.bodyText}>Device: {payload?.deviceId ?? "Scan or paste a QR payload"}</Text>
          <TextInput
            onChangeText={setNickname}
            placeholder="Cold Room Alpha"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={nickname}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={(value) => {
              setPayloadInput(value);
              if (!value.trim()) {
                setPayload(null);
                return;
              }

              try {
                const parsed = parseDeviceEnrollmentLink(value);
                setPayload(parsed);
                void persistPendingDeviceEnrollment(parsed);
              } catch {
                setPayload(null);
              }
            }}
            placeholder="https://coldguard.org/device/CG-ESP32-A100?claim=claim-alpha-100&v=1"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={payloadInput}
          />
          <View style={localStyles.buttonRow}>
            <Pressable onPress={() => void handleScannerOpen()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Scan QR</Text>
            </Pressable>
            <Pressable
              disabled={isBusy || !payload}
              onPress={() => void handleEnroll()}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || isBusy || !payload) && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>{isBusy ? "Enrolling..." : "Start enrollment"}</Text>
            </Pressable>
          </View>
          {feedback ? <Text style={styles.helperText}>{feedback.userMessage}</Text> : null}
          {feedback?.developerCode || developerDetails ? (
            <View style={localStyles.developerCodeBlock}>
              <Text selectable style={styles.helperText}>
                Developer details available for debugging.
              </Text>
              <Pressable onPress={() => void handleCopyDeveloperCode()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Copy developer details</Text>
              </Pressable>
            </View>
          ) : null}
          {copyMessage ? <Text style={styles.helperText}>{copyMessage}</Text> : null}
        </PanelCard>
      </DashboardSection>
    </DashboardPage>
  );
}

const localStyles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  backButtonText: {
    fontSize: 16,
  },
  buttonRow: {
    gap: 12,
  },
  developerCodeBlock: {
    gap: 12,
    marginTop: 12,
  },
  modalActions: {
    gap: 12,
    width: "100%",
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(10, 15, 20, 0.5)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  modalBody: {
    textAlign: "center",
  },
  modalCard: {
    alignItems: "center",
    borderRadius: 20,
    gap: 12,
    maxWidth: 420,
    padding: 24,
    width: "100%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  camera: {
    flex: 1,
  },
  cameraContainer: {
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  centerContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  pageContent: {
    paddingTop: 56,
  },
});
