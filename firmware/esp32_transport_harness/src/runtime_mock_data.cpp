#include "runtime_mock_data.h"

namespace coldguard {

namespace {

struct RuntimeSimulationPhase {
  int batteryLevel;
  bool doorOpen;
  const char* doorSeverity;
  const char* statusLabel;
  float temperatureC;
  bool temperatureCritical;
};

constexpr unsigned long kPhaseDurationMs = 20UL * 1000UL;

RuntimeSimulationPhase currentSimulationPhase() {
  static const RuntimeSimulationPhase kPhases[] = {
      {98, false, "warning", "stable", 4.2f, false},
      {95, false, "warning", "warming", 4.7f, false},
      {92, true, "critical", "door-open", 4.4f, false},
      {88, false, "warning", "battery-low", 5.3f, true},
      {96, false, "warning", "recovering", 4.1f, false},
  };

  const size_t phaseIndex = (millis() / kPhaseDurationMs) % (sizeof(kPhases) / sizeof(kPhases[0]));
  return kPhases[phaseIndex];
}

float currentMockTemperature() {
  return currentSimulationPhase().temperatureC;
}

int currentMockBatteryLevel() {
  return currentSimulationPhase().batteryLevel;
}

bool currentMockDoorOpen() {
  return currentSimulationPhase().doorOpen;
}

String deriveMarketStatus(float temp, int batteryLevel, bool doorOpen) {
  if (temp >= 5.2f) {
    return "alert";
  }
  if (temp >= 4.5f || doorOpen || batteryLevel < 92) {
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
  const RuntimeSimulationPhase phase = currentSimulationPhase();

  if (accessMode == "bluetooth_primary") {
    return deviceLabel + " is paired for primary Bluetooth control and " + phase.statusLabel + " runtime checks.";
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
  const RuntimeSimulationPhase phase = currentSimulationPhase();
  String alerts = "[";
  bool first = true;

  if (snapshot.currentTempC >= 4.5f) {
    alerts += "{"
              "\"cursor\":\"temperature-runtime\","
              "\"incidentType\":\"temperature\","
              "\"severity\":\"" + String(phase.temperatureCritical ? "critical" : "warning") + "\","
              "\"status\":\"open\","
              "\"title\":\"Temperature excursion in progress\","
              "\"body\":\"Firmware runtime simulation reported a temperature drift.\","
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
              "\"severity\":\"" + String(phase.doorSeverity) + "\","
              "\"status\":\"open\","
              "\"title\":\"Door is still open\","
              "\"body\":\"Firmware runtime simulation reported an open door state.\","
              "\"triggeredAt\":" + String(nowMs) +
              "}";
    first = false;
  }

  if (snapshot.batteryLevel < 92) {
    if (!first) {
      alerts += ",";
    }
    alerts += "{"
              "\"cursor\":\"battery-low\","
              "\"incidentType\":\"battery_low\","
              "\"severity\":\"warning\","
              "\"status\":\"open\","
              "\"title\":\"Battery is trending low\","
              "\"body\":\"Firmware runtime simulation reported reduced battery headroom.\","
              "\"triggeredAt\":" + String(nowMs) +
              "}";
  }

  alerts += "]";
  return alerts;
}

}  // namespace coldguard
