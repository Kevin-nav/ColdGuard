import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { DeviceCard } from "../../src/features/dashboard/components/device-card";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { useRefreshOnTabFocus } from "../../src/features/dashboard/hooks/use-refresh-on-tab-focus";
import { parseDeviceEnrollmentLink } from "../../src/features/devices/services/device-linking";
import { quickConnectColdGuardDevice } from "../../src/features/devices/services/quick-connect";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";

export default function DevicesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const { devices, error, isLoading, isRefreshing, profile, refreshDevices } = useDashboardContext();
  const [deviceId, setDeviceId] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [qrPayload, setQrPayload] = useState("");
  const [softApSsid, setSoftApSsid] = useState("");
  const [isQuickConnecting, setIsQuickConnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useRefreshOnTabFocus(refreshDevices);

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

    try {
      const result = await quickConnectColdGuardDevice({
        deviceId,
        nickname,
        password,
        profile,
        ssid: softApSsid,
      });
      await refreshDevices();
      router.push(`/device/${result.deviceId}`);
    } catch (nextError) {
      setMessage(nextError instanceof Error ? nextError.message : "Quick connect failed.");
    } finally {
      setIsQuickConnecting(false);
    }
  }

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
              ? "Supervisor access: enroll, assign, reconnect, and remove facility units."
              : "Nurse access: reconnect only to devices assigned to you."}
          </Text>
          {message ? <Text style={styles.helperText}>{message}</Text> : null}
        </PanelCard>
      </DashboardSection>

      <DashboardSection
        description="Join a nearby device directly with the SoftAP credentials shown on its OLED screen."
        eyebrow="Quick Connect"
        title="Open nearby device"
      >
        <PanelCard>
          <Text style={styles.bodyText}>
            Enter the device ID, SoftAP name, and password shown on the device to open its live local session.
          </Text>
          <TextInput
            autoCapitalize="characters"
            onChangeText={setDeviceId}
            placeholder="CG-ESP32-A100"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={deviceId}
          />
          <TextInput
            onChangeText={setNickname}
            placeholder="Cold Room Alpha (optional)"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={nickname}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setSoftApSsid}
            placeholder="ColdGuard_A100"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
            value={softApSsid}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setPassword}
            placeholder="SoftAP password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <Pressable
            disabled={isQuickConnecting}
            onPress={() => void handleQuickConnect()}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isQuickConnecting) && styles.buttonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isQuickConnecting ? "Connecting..." : "Quick connect"}
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
        description="All active and monitored units."
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
                onPress={() => router.push(`/device/${device.id}`)}
              />
            ))}
          </View>
        )}
      </DashboardSection>
    </DashboardPage>
  );
}
