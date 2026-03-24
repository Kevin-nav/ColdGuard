#include "runtime_mock_data.h"

namespace coldguard {

namespace {

float currentMockTemperature() {
  const unsigned long nowMs = millis();
  return 4.2f + static_cast<float>((nowMs / 1000UL) % 5) * 0.1f;
}

int currentMockBatteryLevel() {
  const unsigned long nowMs = millis();
  return 87 + static_cast<int>((nowMs / 5000UL) % 7);
}

bool currentMockDoorOpen() {
  const unsigned long nowMs = millis();
  return ((nowMs / 15000UL) % 2) == 1;
}

String deriveMarketStatus(float temp, int batteryLevel, bool doorOpen) {
  if (temp >= 5.0f) {
    return "alert";
  }
  if (temp >= 4.5f || doorOpen || batteryLevel < 90) {
    return "warning";
  }
  return "safe";
}

String deriveAccessMode(const DeviceState& state) {
  if (state.stationConnected) {
    return "facility_runtime";
  }
  if (state.accessPointStarted) {
    return state.enrollmentState == "enrolled" ? "temporary_shared_access" : "runtime_recovery";
  }
  return "bluetooth_primary";
}

String buildStatusText(const DeviceState& state, const String& accessMode, const String& mktStatus) {
  const String deviceLabel = state.deviceNickname.isEmpty() ? state.bleName : state.deviceNickname;

  if (accessMode == "bluetooth_primary") {
    return deviceLabel + " is paired for primary Bluetooth control.";
  }
  if (accessMode == "temporary_shared_access") {
    return deviceLabel +
           " is exposing temporary SoftAP access for short-lived secondary viewers. Leave the shared-access flow when finished.";
  }
  if (accessMode == "facility_runtime") {
    return deviceLabel + " is serving runtime data over facility Wi-Fi.";
  }
  if (mktStatus == "alert") {
    return deviceLabel + " has an active runtime alert and is exposing recovery access.";
  }
  return deviceLabel + " is exposing SoftAP runtime recovery access.";
}

}  // namespace

RuntimeSnapshot buildRuntimeSnapshot(const DeviceState& state, const String& runtimeBaseUrl) {
  const float temp = currentMockTemperature();
  const int batteryLevel = currentMockBatteryLevel();
  const bool doorOpen = currentMockDoorOpen();
  const String mktStatus = deriveMarketStatus(temp, batteryLevel, doorOpen);
  const String accessMode = deriveAccessMode(state);

  return RuntimeSnapshot{
    .accessMode = accessMode,
    .batteryLevel = batteryLevel,
    .currentTempC = temp,
    .doorOpen = doorOpen,
    .mktStatus = mktStatus,
    .primaryTransport = "bluetooth",
    .runtimeBaseUrl = runtimeBaseUrl,
    .secondaryTransport = state.accessPointStarted ? "softap" : "",
    .softApAvailable = state.accessPointStarted,
    .softApClientCount = state.accessPointStarted ? 1 : 0,
    .softApIdleTimeoutMs = state.accessPointStarted ? 60000UL : 0UL,
    .statusText = buildStatusText(state, accessMode, mktStatus),
    .stationConnected = state.stationConnected,
    .transport = state.stationConnected ? "facility_wifi" : "softap",
  };
}

String buildRuntimeAlertsJson(const RuntimeSnapshot& snapshot, unsigned long nowMs) {
  String alerts = "[";
  bool first = true;

  if (snapshot.currentTempC >= 4.5f) {
    alerts += "{"
              "\"cursor\":\"temperature-warning\","
              "\"incidentType\":\"temperature\","
              "\"severity\":\"warning\","
              "\"status\":\"open\","
              "\"title\":\"Temperature excursion in progress\","
              "\"body\":\"Runtime polling detected a warming trend.\","
              "\"triggeredAt\":" + String(nowMs) +
              "}";
    first = false;
  }

  if (snapshot.doorOpen) {
    if (!first) {
      alerts += ",";
    }
    alerts += "{"
              "\"cursor\":\"door-open\","
              "\"incidentType\":\"door_open\","
              "\"severity\":\"warning\","
              "\"status\":\"open\","
              "\"title\":\"Door is still open\","
              "\"body\":\"Runtime polling detected an open door state.\","
              "\"triggeredAt\":" + String(nowMs) +
              "}";
    first = false;
  }

  if (snapshot.batteryLevel < 90) {
    if (!first) {
      alerts += ",";
    }
    alerts += "{"
              "\"cursor\":\"battery-low\","
              "\"incidentType\":\"battery_low\","
              "\"severity\":\"warning\","
              "\"status\":\"open\","
              "\"title\":\"Battery is trending low\","
              "\"body\":\"Runtime polling detected reduced battery headroom.\","
              "\"triggeredAt\":" + String(nowMs) +
              "}";
  }

  alerts += "]";
  return alerts;
}

}  // namespace coldguard
