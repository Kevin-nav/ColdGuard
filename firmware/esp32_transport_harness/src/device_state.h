#pragma once

#include <Arduino.h>
#include <Preferences.h>

namespace coldguard {

struct PendingEnrollment {
  bool active = false;
  String institutionId;
  String nickname;
  String handshakeToken;
  uint32_t grantVersion = 0;
};

struct DeviceState {
  String deviceId;
  String bleName;
  String macAddress;
  String bootstrapToken;
  String enrollmentState = "blank";
  bool enrollmentReady = false;
  String institutionId;
  String deviceNickname;
  String handshakeToken;
  String lastErrorCode;
  String lastDeviceNonce;
  String wifiSsid;
  String wifiPassword;
  String facilityWifiSsid;
  String facilityWifiPassword;
  String lastVerifiedPermission;
  String runtimePhase = "idle";
  String uiWorkflowState = "blank_idle";
  String uiWorkflowDetail;
  String uiWorkflowErrorCode;
  String primaryControllerUserId;
  String primaryControllerClientId;
  String primaryLeaseSessionId;
  uint32_t grantVersion = 0;
  uint32_t telemetrySequence = 0;
  uint64_t telemetryRecordedAtEpochMs = 0;
  String telemetryRtcIso;
  String telemetryTimeSource = "fallback";
  String telemetrySensorHealth = "uninitialized";
  String telemetryStatusText;
  String telemetryMktStatus = "safe";
  double telemetryMktExponentialSum = 0.0;
  uint32_t telemetryMktSampleCount = 0;
  float telemetryMktC = 0.0f;
  float telemetryTemperatureC = 4.0f;
  bool telemetryTemperatureSensorHealthy = false;
  bool telemetryRtcHealthy = false;
  bool telemetrySdCardMounted = false;
  bool telemetryInitialized = false;
  bool telemetryTemperatureCritical = false;
  unsigned long telemetryLastSampleAtMs = 0;
  unsigned long primaryLeaseExpiresAtMs = 0;
  unsigned long primaryLeaseHeartbeatIntervalMs = 10000UL;
  unsigned long primaryLeaseTimeoutMs = 35000UL;
  unsigned long verifiedSessionUntilMs = 0;
  unsigned long wifiTicketExpiryMs = 0;
  unsigned long lastHeartbeatAtMs = 0;
  unsigned long lastStationConnectAttemptMs = 0;
  unsigned long runtimePhaseChangedAtMs = 0;
  unsigned long uiWorkflowChangedAtMs = 0;
  unsigned long uiWorkflowVisibleUntilMs = 0;
  unsigned long stationConnectDeadlineMs = 0;
  uint64_t lastDeviceNonceIssuedAtMs = 0;
  bool accessPointStarted = false;
  bool runtimeServerStarted = false;
  bool stationConnected = false;
  bool stationConnectInProgress = false;
  bool softApStartInProgress = false;
  bool facilityWifiProvisioning = false;
  PendingEnrollment pendingEnrollment;
};

String formatMacAddress(uint64_t mac);
String buildDeviceId(uint64_t mac);
String buildEnrollmentLink(const DeviceState& state);
String escapeJson(const String& value);
String uint64ToString(uint64_t value);
String observableEnrollmentState(const DeviceState& state);
uint64_t currentDeviceTimeMs();
String buildAdvertisementPayload(const DeviceState& state, uint8_t protocolVersion);
void loadDeviceState(Preferences& preferences, const char* preferencesNamespace, DeviceState* state);
void saveDeviceState(Preferences& preferences, const DeviceState& state);
void setDeviceUiWorkflow(
  DeviceState* state,
  const String& workflowState,
  const String& detail = "",
  const String& errorCode = "",
  unsigned long visibleForMs = 0);
void syncDeviceUiWorkflow(DeviceState* state);
void clearEnrollmentState(DeviceState* state);
void clearPrimaryLeaseState(DeviceState* state);
void prepareNewEnrollment(DeviceState* state);

}  // namespace coldguard
