import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { DashboardPage } from "../../src/features/dashboard/components/dashboard-page";
import { DashboardSection } from "../../src/features/dashboard/components/dashboard-section";
import { DeviceCard } from "../../src/features/dashboard/components/device-card";
import { PanelCard } from "../../src/features/dashboard/components/panel-card";
import { useDashboardContext } from "../../src/features/dashboard/hooks/use-dashboard-context";
import { parseDeviceEnrollmentLink } from "../../src/features/devices/services/device-linking";
import { createSharedStyles } from "../../src/theme/shared-styles";
import { useTheme } from "../../src/theme/theme-provider";

export default function DevicesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createSharedStyles(colors), [colors]);
  const { devices, error, isLoading, profile } = useDashboardContext();
  const [nickname, setNickname] = useState("");
  const [qrPayload, setQrPayload] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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
    <DashboardPage scroll testID="devices-scroll-view">
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

      {profile.role === "Supervisor" ? (
        <DashboardSection
          description="Use the printed device QR or camera scanner to start the real BLE setup and Wi-Fi handover test."
          eyebrow="Enrollment"
          title="Add device"
        >
          <PanelCard>
            <Text style={styles.bodyText}>
              Open the supervisor enrollment flow to scan the printed QR or continue from a deep link.
            </Text>
            <TextInput
              onChangeText={setNickname}
              placeholder="Cold Room Alpha"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              value={nickname}
            />
            <TextInput
              autoCapitalize="none"
              onChangeText={setQrPayload}
              placeholder="coldguard://device/CG-ESP32-A100?claim=claim-alpha-100&v=1"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              value={qrPayload}
            />
            <Pressable
              onPress={openEnrollmentFlow}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>Open enrollment flow</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setNickname("");
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
