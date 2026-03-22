import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { MetricRow } from "../../src/features/dashboard/components/metric-row";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { Badge } from "../../src/features/dashboard/components/badge";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";
import { spacing } from "../../src/theme/tokens";
import type { DeviceRecord } from "../../src/lib/storage/sqlite/device-repository";
import { listAssignableNurses } from "../../src/features/devices/services/device-directory";
import {
  assignColdGuardDevice,
  connectOrRecoverDevice,
  decommissionColdGuardDevice,
  getDeviceRuntimeSession,
  runColdGuardConnectionTest,
  provisionFacilityWifi,
  startDeviceMonitoring,
  stopDeviceMonitoring,
} from "../../src/features/devices/services/connection-service";
import { parseDeviceEnrollmentLink } from "../../src/features/devices/services/device-linking";
import { presentDeviceError, type PresentedDeviceError } from "../../src/features/devices/services/error-presenter";
import type { DeviceAssignmentCandidate, DeviceRuntimeConfig } from "../../src/features/devices/types";

function getStatusColor(status: DeviceRecord["mktStatus"], colors: ReturnType<typeof useTheme>["colors"]) {
  switch (status) {
    case "alert":
      return colors.danger;
    case "warning":
      return colors.warning;
    default:
      return colors.success;
  }
}

function getStatusIcon(status: DeviceRecord["mktStatus"]) {
  switch (status) {
    case "alert":
      return "alert-circle";
    case "warning":
      return "warning";
    default:
      return "checkmark-circle";
  }
}

function formatExactDate(timestamp: number | null) {
  if (!timestamp) return "Not tested yet";
  return new Date(timestamp).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLastSeenRelative(lastSeenAt: number) {
  const minutes = Math.max(1, Math.round((Date.now() - lastSeenAt) / 60_000));
  if (minutes > 60) {
    const hours = Math.round(minutes / 60);
    if (hours > 24) {
      return `${Math.round(hours / 24)} days ago`;
    }
    return `${hours} hr ago`;
  }
  return `${minutes} min ago`;
}

function formatAccessLabel(accessRole: DeviceRecord["accessRole"]) {
  switch (accessRole) {
    case "manager":
      return "Supervisor access";
    case "primary":
      return "Primary nurse";
    default:
      return "Viewer nurse";
  }
}

function formatConnectionStatus(status: DeviceRecord["lastConnectionTestStatus"]) {
  if (!status || status === "idle") {
    return "Pending";
  }

  if (status === "running") {
    return "Running";
  }

  return status === "success" ? "Success" : "Failed";
}

function formatRuntimeTransportLabel(transport: DeviceRuntimeConfig["activeTransport"]) {
  switch (transport) {
    case "facility_wifi":
      return "Facility Wi-Fi";
    case "softap":
      return "Local SoftAP";
    case "ble_fallback":
      return "BLE recovery";
    default:
      return "Not connected";
  }
}

function formatRuntimeSessionLabel(status: DeviceRuntimeConfig["sessionStatus"] | undefined) {
  switch (status) {
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "recovering":
      return "Recovering";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

export default function DeviceDetailsScreen() {
  const { claim, id, v } = useLocalSearchParams<{ claim?: string; id: string; v?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const { devices, error, isLoading, profile, refreshDevices } = useDashboardContext();
  const [assignableNurses, setAssignableNurses] = useState<DeviceAssignmentCandidate[]>([]);
  const [actionFeedback, setActionFeedback] = useState<PresentedDeviceError | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [isRunningConnectionTest, setIsRunningConnectionTest] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isProvisioningWifi, setIsProvisioningWifi] = useState(false);
  const [isTogglingMonitoring, setIsTogglingMonitoring] = useState(false);
  const [isRemovingDevice, setIsRemovingDevice] = useState(false);
  const [primaryStaffId, setPrimaryStaffId] = useState<string | null>(null);
  const [runtimeSession, setRuntimeSession] = useState<DeviceRuntimeConfig | null>(null);
  const [facilityWifiPassword, setFacilityWifiPassword] = useState("");
  const [facilityWifiSsid, setFacilityWifiSsid] = useState("");
  const [viewerStaffIds, setViewerStaffIds] = useState<string[]>([]);

  const device = devices.find((entry) => entry.id === id);
  let enrollmentLink = null;
  if (typeof claim === "string" && typeof v === "string") {
    try {
      enrollmentLink = parseDeviceEnrollmentLink(
        `https://coldguard.org/device/${encodeURIComponent(id)}?claim=${encodeURIComponent(claim)}&v=${encodeURIComponent(v)}`,
      );
    } catch {
      enrollmentLink = null;
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadAssignmentOptions() {
      if (!device || profile?.role !== "Supervisor") {
        if (isMounted) {
          setAssignableNurses([]);
          setPrimaryStaffId(device?.primaryAssigneeStaffId ?? null);
          setViewerStaffIds([]);
        }
        return;
      }

      try {
        setPrimaryStaffId(device.primaryAssigneeStaffId ?? null);
        const nurses = await listAssignableNurses();
        if (!isMounted) return;

        setAssignableNurses(nurses);
        setPrimaryStaffId(device.primaryAssigneeStaffId ?? nurses[0]?.staffId ?? null);
        setViewerStaffIds(
          nurses
            .filter((nurse) => device.viewerNames.includes(nurse.displayName))
            .map((nurse) => nurse.staffId),
        );
      } catch (nextError) {
        if (!isMounted) return;
        setAssignableNurses([]);
          setActionFeedback(presentDeviceError(nextError, "Assignment options could not be loaded."));
      }
    }

    void loadAssignmentOptions();

    return () => {
      isMounted = false;
    };
  }, [device, profile?.role]);

  useEffect(() => {
    let isMounted = true;
    const deviceId = device?.id;

    async function loadRuntimeSession() {
      if (!deviceId) {
        if (isMounted) setRuntimeSession(null);
        return;
      }

      const nextSession = await getDeviceRuntimeSession(deviceId);
      if (!isMounted) return;

      setRuntimeSession(nextSession);
      if (nextSession?.facilityWifiSsid) {
        setFacilityWifiSsid(nextSession.facilityWifiSsid);
      }
      if (nextSession?.facilityWifiPassword) {
        setFacilityWifiPassword(nextSession.facilityWifiPassword);
      }
    }

    void loadRuntimeSession();

    return () => {
      isMounted = false;
    };
  }, [device?.id]);

  if (enrollmentLink) {
    if (Platform.OS === "web") {
      return (
        <DashboardPage>
          <DashboardSection title="Open In ColdGuard" eyebrow="Device setup" description="Continue enrollment in the ColdGuard Android app.">
            <PanelCard>
              <Text style={styles.bodyText}>Device: {enrollmentLink.deviceId}</Text>
              <Text style={styles.bodyText}>
                Install the Android build if needed, then return here and tap Open app.
              </Text>
              <Pressable
                onPress={() => void Linking.openURL(enrollmentLink.qrPayload)}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Open app</Text>
              </Pressable>
            </PanelCard>
          </DashboardSection>
        </DashboardPage>
      );
    }

    return (
      <Redirect
        href={{
          pathname: "/device/enroll",
          params: {
            claim: enrollmentLink.claim,
            deviceId: enrollmentLink.deviceId,
            payload: enrollmentLink.sourceUrl,
            v: enrollmentLink.version,
          },
        }}
      />
    );
  }

  if (isLoading || !profile) {
    return (
      <DashboardPage>
        <View style={localStyles.centerContent}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </DashboardPage>
    );
  }

  if (error || !device) {
    return (
      <DashboardPage>
        <DashboardSection title="Device Not Found" eyebrow="Error" description="Unable to locate device details.">
          <PanelCard>
            <Text style={styles.bodyText}>
              {error || "The requested device could not be found or you do not have permission to view it."}
            </Text>
            <Pressable
              testID="device-back-button"
              style={({ pressed }) => [
                localStyles.backButton,
                { backgroundColor: colors.surfaceMuted },
                pressed && styles.buttonDisabled,
              ]}
              onPress={handleBackNavigation}
            >
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
              <Text style={[styles.bodyText, { color: colors.textPrimary }]}>Go Back</Text>
            </Pressable>
          </PanelCard>
        </DashboardSection>
      </DashboardPage>
    );
  }

  const activeDevice = device;
  const activeProfile = profile;
  const statusColor = getStatusColor(activeDevice.mktStatus, colors);
  const statusIcon = getStatusIcon(activeDevice.mktStatus);

  function handleBackNavigation() {
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/devices");
  }

  async function handleSaveAssignments() {
    setIsSavingAssignments(true);
    setActionFeedback(null);
    setCopyMessage(null);

    try {
      await assignColdGuardDevice({
        deviceId: activeDevice.id,
        primaryStaffId,
        viewerStaffIds: viewerStaffIds.filter((staffId) => staffId !== primaryStaffId),
      });
      await refreshDevices();
      setActionFeedback({ developerCode: null, userMessage: "Assignments saved." });
    } catch (nextError) {
      setActionFeedback(presentDeviceError(nextError, "Assignments could not be saved."));
    } finally {
      setIsSavingAssignments(false);
    }
  }

  async function handleRunConnectionTest() {
    setIsRunningConnectionTest(true);
    setActionFeedback(null);
    setCopyMessage(null);

    try {
      const result = await runColdGuardConnectionTest({ deviceId: activeDevice.id });
      await refreshDevices();
      setRuntimeSession(await getDeviceRuntimeSession(activeDevice.id));
      setActionFeedback({ developerCode: null, userMessage: result.statusText || "Connection test completed." });
    } catch (nextError) {
      setRuntimeSession(await getDeviceRuntimeSession(activeDevice.id));
      setActionFeedback(presentDeviceError(nextError, "Connection test failed."));
    } finally {
      setIsRunningConnectionTest(false);
    }
  }

  async function handleReconnect() {
    setIsReconnecting(true);
    setActionFeedback(null);
    setCopyMessage(null);

    try {
      const result = await connectOrRecoverDevice({ deviceId: activeDevice.id });
      await refreshDevices();
      setRuntimeSession(await getDeviceRuntimeSession(activeDevice.id));
      setActionFeedback({ developerCode: null, userMessage: `Connected over ${formatRuntimeTransportLabel(result.transport)}.` });
    } catch (nextError) {
      setRuntimeSession(await getDeviceRuntimeSession(activeDevice.id));
      setActionFeedback(presentDeviceError(nextError, "Reconnect failed."));
    } finally {
      setIsReconnecting(false);
    }
  }

  async function handleProvisionFacilityWifi() {
    if (!facilityWifiSsid.trim() || !facilityWifiPassword.trim()) {
      setActionFeedback({ developerCode: null, userMessage: "Enter both the facility Wi-Fi name and password." });
      return;
    }

    setIsProvisioningWifi(true);
    setActionFeedback(null);
    setCopyMessage(null);

    try {
      const result = await provisionFacilityWifi({
        deviceId: activeDevice.id,
        password: facilityWifiPassword.trim(),
        ssid: facilityWifiSsid.trim(),
      });
      setRuntimeSession(await getDeviceRuntimeSession(activeDevice.id));
      setActionFeedback({ developerCode: null, userMessage: `Saved facility Wi-Fi. Runtime URL: ${result.runtimeBaseUrl}` });
    } catch (nextError) {
      setRuntimeSession(await getDeviceRuntimeSession(activeDevice.id));
      setActionFeedback(presentDeviceError(nextError, "Facility Wi-Fi setup failed."));
    } finally {
      setIsProvisioningWifi(false);
    }
  }

  async function handleToggleMonitoring() {
    setIsTogglingMonitoring(true);
    setActionFeedback(null);
    setCopyMessage(null);

    try {
      const nextSession =
        runtimeSession?.monitoringMode === "foreground_service"
          ? await stopDeviceMonitoring(activeDevice.id)
          : await startDeviceMonitoring(activeDevice.id);
      setRuntimeSession(nextSession);
      setActionFeedback({
        developerCode: null,
        userMessage:
          nextSession.monitoringMode === "foreground_service"
            ? "Background monitoring armed."
            : "Background monitoring paused.",
      });
    } catch (nextError) {
      setActionFeedback(presentDeviceError(nextError, "Monitoring could not be updated."));
    } finally {
      setIsTogglingMonitoring(false);
    }
  }

  async function handleDiagnostics() {
    const latestSession = await getDeviceRuntimeSession(activeDevice.id);
    setRuntimeSession(latestSession);
    if (!latestSession) {
      setActionFeedback({ developerCode: null, userMessage: "No runtime session has been established yet." });
      return;
    }
    setActionFeedback({
      developerCode: latestSession.lastRuntimeError ?? null,
      userMessage:
        `Transport: ${formatRuntimeTransportLabel(latestSession.activeTransport)} | Session: ${formatRuntimeSessionLabel(latestSession.sessionStatus)}` +
        (latestSession.lastRuntimeError ? " | Review developer code for the last transport error." : ""),
    });
  }

  async function handleRemoveDevice() {
    setIsRemovingDevice(true);
    setActionFeedback(null);
    setCopyMessage(null);

    try {
      await decommissionColdGuardDevice({
        deviceId: activeDevice.id,
        profile: activeProfile,
      });
      await refreshDevices();
      router.replace("/(tabs)/devices");
    } catch (nextError) {
      setActionFeedback(presentDeviceError(nextError, "Device removal failed."));
    } finally {
      setIsRemovingDevice(false);
    }
  }

  async function handleCopyDeveloperCode() {
    if (!actionFeedback?.developerCode) {
      return;
    }

    await Clipboard.setStringAsync(actionFeedback.developerCode);
    setCopyMessage("Developer code copied.");
  }

  return (
    <DashboardPage scroll>
      <View style={localStyles.headerRow}>
        <Pressable testID="device-back-button" style={localStyles.iconButton} onPress={handleBackNavigation}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.heading, { flex: 1 }]} numberOfLines={1}>
          {activeDevice.nickname}
        </Text>
      </View>

      <DashboardSection title="Status Overview" eyebrow="Current State" description="Real-time device tracking and health indicators.">
        <PanelCard>
          <View style={localStyles.statusHeader}>
            <View style={localStyles.statusLabelGroup}>
              <Ionicons name="pulse" size={24} color={statusColor} />
              <Text style={[styles.subheading, { color: statusColor }]}>System Status</Text>
            </View>
            <Badge
              backgroundColor={statusColor}
              iconName={statusIcon}
              label={activeDevice.mktStatus.toUpperCase()}
              textColor={colors.textOnPrimary}
            />
          </View>
          <View style={localStyles.divider} />
          <View style={localStyles.metricsGrid}>
            <MetricRow iconName="timer-outline" label="Last Sync" value={formatLastSeenRelative(activeDevice.lastSeenAt)} />
            <MetricRow iconName="calendar-outline" label="Exact Time" value={formatExactDate(activeDevice.lastSeenAt)} />
            <MetricRow iconName="shield-checkmark-outline" label="Access" value={formatAccessLabel(activeDevice.accessRole)} />
          </View>
        </PanelCard>
      </DashboardSection>

      <DashboardSection title="Connection Tools" eyebrow="Transport" description="Validate the BLE authentication and Wi-Fi handover path.">
        <PanelCard>
          <View style={localStyles.metricsGrid}>
            <MetricRow iconName="radio-outline" label="Firmware" value={activeDevice.firmwareVersion} />
            <MetricRow
              iconName="wifi-outline"
              label="Last test"
              value={formatExactDate(activeDevice.lastConnectionTestAt)}
            />
            <MetricRow
              iconName="checkmark-done-outline"
              label="Test status"
              value={formatConnectionStatus(activeDevice.lastConnectionTestStatus)}
            />
            <MetricRow
              iconName="swap-horizontal-outline"
              label="Runtime transport"
              value={formatRuntimeTransportLabel(runtimeSession?.activeTransport ?? null)}
            />
            <MetricRow
              iconName="pulse-outline"
              label="Session"
              value={formatRuntimeSessionLabel(runtimeSession?.sessionStatus)}
            />
          </View>
          <View style={localStyles.actionButtons}>
            <Pressable
              disabled={isRunningConnectionTest}
              onPress={() => void handleRunConnectionTest()}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || isRunningConnectionTest) && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isRunningConnectionTest ? "Running connection test..." : "Run connection test"}
              </Text>
            </Pressable>
            <Pressable
              disabled={isReconnecting}
              onPress={() => void handleReconnect()}
              style={({ pressed }) => [
                styles.secondaryButton,
                (pressed || isReconnecting) && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>{isReconnecting ? "Reconnecting..." : "Reconnect"}</Text>
            </Pressable>
            <Pressable onPress={() => void handleDiagnostics()} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Diagnostics</Text>
            </Pressable>
            <Pressable
              disabled={isTogglingMonitoring}
              onPress={() => void handleToggleMonitoring()}
              style={({ pressed }) => [
                styles.secondaryButton,
                (pressed || isTogglingMonitoring) && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {isTogglingMonitoring
                  ? "Updating monitoring..."
                  : runtimeSession?.monitoringMode === "foreground_service"
                    ? "Disable monitoring"
                    : "Enable monitoring"}
              </Text>
            </Pressable>
          </View>
          <View style={localStyles.divider} />
          <TextInput
            autoCapitalize="none"
            onChangeText={setFacilityWifiSsid}
            placeholder="Facility Wi-Fi SSID"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={facilityWifiSsid}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setFacilityWifiPassword}
            placeholder="Facility Wi-Fi password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            style={styles.input}
            value={facilityWifiPassword}
          />
          <Pressable
            disabled={isProvisioningWifi}
            onPress={() => void handleProvisionFacilityWifi()}
            style={({ pressed }) => [
              styles.secondaryButton,
              (pressed || isProvisioningWifi) && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {isProvisioningWifi ? "Saving Wi-Fi..." : "Save facility Wi-Fi"}
            </Text>
          </Pressable>
          {actionFeedback ? <Text style={styles.helperText}>{actionFeedback.userMessage}</Text> : null}
          {actionFeedback?.developerCode ? (
            <View style={localStyles.developerCodeBlock}>
              <Text selectable style={styles.helperText}>
                Developer code: {actionFeedback.developerCode}
              </Text>
              <Pressable onPress={() => void handleCopyDeveloperCode()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Copy developer code</Text>
              </Pressable>
            </View>
          ) : null}
          {copyMessage ? <Text style={styles.helperText}>{copyMessage}</Text> : null}
        </PanelCard>
      </DashboardSection>

      <DashboardSection title="Hardware Readings" eyebrow="Telemetry" description="Current sensor measurements.">
        <PanelCard>
          <View style={localStyles.metricsGrid}>
            <MetricRow
              iconName="thermometer-outline"
              label="Internal Temperature"
              value={`${activeDevice.currentTempC.toFixed(2)} C`}
              valueColor={
                activeDevice.mktStatus === "alert"
                  ? colors.danger
                  : activeDevice.mktStatus === "warning"
                    ? colors.warning
                    : colors.success
              }
            />
            <View style={localStyles.divider} />
            <MetricRow
              iconName="battery-half"
              label="Battery Level"
              value={`${activeDevice.batteryLevel}%`}
              valueColor={activeDevice.batteryLevel < 20 ? colors.danger : undefined}
            />
            <View style={localStyles.divider} />
            <MetricRow
              iconName={activeDevice.doorOpen ? "lock-open-outline" : "lock-closed-outline"}
              label="Door Sensor"
              value={activeDevice.doorOpen ? "Door Open" : "Door Closed"}
              valueColor={activeDevice.doorOpen ? colors.warning : undefined}
            />
          </View>
        </PanelCard>
      </DashboardSection>

      <DashboardSection title="Assignment" eyebrow="Accountability" description="Primary responsibility and additional viewers for this unit.">
        <PanelCard>
          <View style={localStyles.metricsGrid}>
            <MetricRow iconName="person-outline" label="Primary nurse" value={activeDevice.primaryAssigneeName ?? "Not assigned"} />
            <MetricRow
              iconName="people-outline"
              label="Additional viewers"
              value={activeDevice.viewerNames.length ? activeDevice.viewerNames.join(", ") : "None"}
            />
          </View>
          {profile.role === "Supervisor" ? (
            <View style={localStyles.assignmentStack}>
              <Text style={styles.eyebrowText}>Choose primary nurse</Text>
              <View style={localStyles.assignmentButtons}>
                {assignableNurses.map((nurse) => (
                  <Pressable
                    key={`primary-${nurse.staffId}`}
                    onPress={() => setPrimaryStaffId(nurse.staffId)}
                    style={({ pressed }) => [
                      localStyles.assignmentChip,
                      {
                        backgroundColor:
                          primaryStaffId === nurse.staffId ? colors.primary : colors.surfaceMuted,
                      },
                      pressed && styles.buttonDisabled,
                    ]}
                  >
                    <Text
                      style={{
                        color: primaryStaffId === nurse.staffId ? colors.textOnPrimary : colors.textPrimary,
                      }}
                    >
                      {nurse.displayName}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.eyebrowText}>Add viewer nurses</Text>
              <View style={localStyles.assignmentButtons}>
                {assignableNurses.map((nurse) => {
                  const selected = viewerStaffIds.includes(nurse.staffId);
                  return (
                    <Pressable
                      key={`viewer-${nurse.staffId}`}
                      onPress={() =>
                        setViewerStaffIds((current) =>
                          selected
                            ? current.filter((staffId) => staffId !== nurse.staffId)
                            : [...current, nurse.staffId],
                        )
                      }
                      style={({ pressed }) => [
                        localStyles.assignmentChip,
                        {
                          backgroundColor: selected ? colors.primaryMuted : colors.surfaceMuted,
                        },
                        pressed && styles.buttonDisabled,
                      ]}
                    >
                      <Text style={{ color: colors.textPrimary }}>{nurse.displayName}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                disabled={isSavingAssignments || !primaryStaffId}
                onPress={() => void handleSaveAssignments()}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  (pressed || isSavingAssignments || !primaryStaffId) && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  {isSavingAssignments ? "Saving..." : "Save assignments"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </PanelCard>
      </DashboardSection>

      {profile.role === "Supervisor" ? (
        <DashboardSection title="Supervisor Actions" eyebrow="Lifecycle" description="Decommissioning wipes the enrolled device and invalidates cached grants.">
          <PanelCard>
            <Pressable
              disabled={isRemovingDevice}
              onPress={() => void handleRemoveDevice()}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: colors.danger },
                (pressed || isRemovingDevice) && styles.buttonDisabled,
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>
                {isRemovingDevice ? "Removing device..." : "Remove device"}
              </Text>
            </Pressable>
          </PanelCard>
        </DashboardSection>
      ) : null}

      <DashboardSection title="Device Details" eyebrow="Information" description="Specific hardware and facility allocation.">
        <PanelCard>
          <View style={localStyles.metricsGrid}>
            <MetricRow iconName="hardware-chip-outline" label="Device ID" value={activeDevice.id} />
            <View style={localStyles.divider} />
            <MetricRow iconName="barcode-outline" label="MAC Address" value={activeDevice.macAddress} />
            <View style={localStyles.divider} />
            <MetricRow iconName="business-outline" label="Facility" value={activeDevice.institutionName} />
          </View>
        </PanelCard>
      </DashboardSection>
    </DashboardPage>
  );
}

const localStyles = StyleSheet.create({
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  iconButton: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  statusLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(150, 150, 150, 0.1)",
    marginVertical: spacing.sm,
  },
  metricsGrid: {
    gap: spacing.sm,
  },
  assignmentStack: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  assignmentButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionButtons: {
    gap: spacing.sm,
  },
  developerCodeBlock: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  assignmentChip: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
