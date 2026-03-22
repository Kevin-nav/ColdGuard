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
  uint32_t grantVersion = 0;
  unsigned long verifiedSessionUntilMs = 0;
  unsigned long wifiTicketExpiryMs = 0;
  unsigned long lastHeartbeatAtMs = 0;
  unsigned long lastStationConnectAttemptMs = 0;
  uint64_t lastDeviceNonceIssuedAtMs = 0;
  bool accessPointStarted = false;
  bool runtimeServerStarted = false;
  bool stationConnected = false;
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
void clearEnrollmentState(DeviceState* state);
void prepareNewEnrollment(DeviceState* state);

}  // namespace coldguard
