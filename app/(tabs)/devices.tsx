import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { DeviceCard } from "../../src/features/dashboard/components/device-card";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { useRefreshOnTabFocus } from "../../src/features/dashboard/hooks/use-refresh-on-tab-focus";
import { quickConnectColdGuardDevice } from "../../src/features/devices/services/connection-service";
import { parseDeviceEnrollmentLink } from "../../src/features/devices/services/device-linking";
import { resolveDisplayMktC } from "../../src/features/devices/services/mkt";
import { getRecentReadingsForDevice } from "../../src/lib/storage/sqlite/reading-repository";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";

export default function DevicesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const { devices, error, isLoading, isRefreshing, profile, refreshDevices } = useDashboardContext();
  const [nickname, setNickname] = useState("");
  const [quickConnectCode, setQuickConnectCode] = useState("");
  const [quickConnectStatus, setQuickConnectStatus] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState("");
  const [displayMktByDeviceId, setDisplayMktByDeviceId] = useState<Record<string, number>>({});
  const [isQuickConnecting, setIsQuickConnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useRefreshOnTabFocus(refreshDevices);

  useEffect(() => {
    let isActive = true;

    async function loadDisplayMkt() {
      const entries = await Promise.all(
        devices.map(async (device) => {
          const readings = await getRecentReadingsForDevice(device.id, 24);
          const displayMktC = resolveDisplayMktC({
            fallbackTempC: device.currentTempC,
            readings,
          });
          return [device.id, displayMktC] as const;
        }),
      );

      if (!isActive) {
        return;
      }

      setDisplayMktByDeviceId(
        Object.fromEntries(
          entries.flatMap(([nextDeviceId, displayMktC]) =>
            typeof displayMktC === "number" ? [[nextDeviceId, displayMktC]] : [],
          ),
        ),
      );
    }

    void loadDisplayMkt();

    return () => {
      isActive = false;
    };
  }, [devices]);

  if (error) {
    return (
      <DashboardPage>
        <PanelCard>
          <Text style={styles.heading}>Devices</Text>
          <Text style={styles.helperText}>{error}</Text>
        </PanelCard>
      </DashboardPage>
    );
  }

  if (isLoading || !profile) {
    return (
      <DashboardPage>
        <ActivityIndicator color={colors.primary} />
      </DashboardPage>
    );
  }

  async function handleQuickConnect() {
    if (!profile) {
      return;
    }

    setIsQuickConnecting(true);
    setMessage(null);
    setQuickConnectStatus("Looking for nearby devices...");

    try {
      const result = await quickConnectColdGuardDevice({
        code: quickConnectCode,
        nickname,
        onProgress: setQuickConnectStatus,
        profile,
      });
      await refreshDevices();
      router.push(`/device/${result.deviceId}`);
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : "Quick connect failed.");
    } finally {
      setQuickConnectStatus(null);
      setIsQuickConnecting(false);
    }
  }

  const isQuickConnectDisabled = isQuickConnecting || quickConnectCode.length !== 8;

  function openEnrollmentFlow() {
    try {
      const payload = qrPayload.trim() ? parseDeviceEnrollmentLink(qrPayload) : null;
      router.push({
        pathname: "/device/enroll",
        params: payload
          ? {
            claim: payload.claim,
            deviceId: payload.deviceId,
            nickname,
            payload: payload.sourceUrl,
            v: payload.version,
          }
          : nickname.trim()
            ? { nickname }
            : {},
      });
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : "Device enrollment failed.");
    }
  }

  return (
    <DashboardPage
      refreshControl={<RefreshControl onRefresh={() => void refreshDevices()} refreshing={isRefreshing} />}
      scroll
      testID="devices-scroll-view"
    >
      <DashboardSection
        description={
          profile.role === "Supervisor"
            ? "Complete inventory of your facility's monitored equipment."
            : "Your assigned cold-chain devices in one focused view."
        }
        eyebrow="Device Workspace"
        title="Devices"
      >
        <PanelCard>
          <Text style={[styles.bodyText, { color: colors.textPrimary }]}>
            {profile.role === "Supervisor"
              ? "Use Quick Connect for demos and nearby checks. Advanced setup stays available when needed."
              : "Use Quick Connect to open a nearby device and review its latest readings."}
          </Text>
          {message ? <Text style={styles.helperText}>{message}</Text> : null}
        </PanelCard>
      </DashboardSection>

      <DashboardSection
        description="Enter the 8-digit code shown on the device screen. The app will find the nearby device for you."
        eyebrow="Quick Connect"
        title="Open nearby device"
      >
        <PanelCard>
          <Text style={styles.bodyText}>
            Enter the Quick Connect code from the device screen to open its live session.
          </Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={8}
            onChangeText={(value) => setQuickConnectCode(value.replace(/[^0-9]/g, "").slice(0, 8))}
            placeholder="8-digit code"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={quickConnectCode}
          />
          <TextInput
            onChangeText={setNickname}
            placeholder="Cold Room Alpha (optional)"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={nickname}
          />
          {isQuickConnecting && quickConnectStatus ? <Text style={styles.helperText}>{quickConnectStatus}</Text> : null}
          <Pressable
            disabled={isQuickConnectDisabled}
            onPress={() => void handleQuickConnect()}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isQuickConnectDisabled) && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isQuickConnecting ? "Connecting..." : "Connect nearby device"}
            </Text>
          </Pressable>
        </PanelCard>
      </DashboardSection>

      {profile.role === "Supervisor" ? (
        <DashboardSection
          description="Use the older BLE enrollment flow only for advanced setup, service work, or backend-managed pairing."
          eyebrow="Advanced Setup"
          title="Enroll device"
        >
          <PanelCard>
            <Text style={styles.bodyText}>
              The BLE enrollment path is still available, but it is no longer the default pairing workflow.
            </Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setQrPayload}
              placeholder="coldguard://device/CG-ESP32-A100?claim=claim-alpha-100&v=1"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              value={qrPayload}
            />
            <Pressable onPress={openEnrollmentFlow} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Open advanced BLE enrollment</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setQrPayload("");
                router.push("/device/enroll");
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Scan device QR</Text>
            </Pressable>
          </PanelCard>
        </DashboardSection>
      ) : null}

      <DashboardSection
        description="Current devices with their latest care-facing readings."
        eyebrow="Current Fleet"
        title={devices.length === 0 ? "No devices yet" : `${devices.length} active devices`}
      >
        {devices.length === 0 ? (
          <PanelCard>
            <Text style={styles.bodyText}>No ColdGuard devices available yet.</Text>
          </PanelCard>
        ) : (
          <View style={{ gap: 16 }}>
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                displayMktC={displayMktByDeviceId[device.id]}
                onPress={() => router.push(`/device/${device.id}`)}
              />
            ))}
          </View>
        )}
      </DashboardSection>
    </DashboardPage>
  );
}
