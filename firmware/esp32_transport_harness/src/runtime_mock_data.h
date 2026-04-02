#pragma once

#include <Arduino.h>
#include <Preferences.h>

namespace coldguard {

struct DeviceState;

struct RuntimeSnapshot {
  String accessMode;
  uint32_t latestSequence = 0;
  uint64_t recordedAtEpochMs = 0;
  String rtcIso;
  String timeSource;
  float currentTempC = 0.0f;
  String mktStatus;
  String primaryTransport;
  String runtimeBaseUrl;
  String secondaryTransport;
  bool softApAvailable = false;
  int softApClientCount = 0;
  unsigned long softApIdleTimeoutMs = 0;
  String statusText;
  bool stationConnected = false;
  String transport;
  bool temperatureSensorHealthy = false;
  bool rtcHealthy = false;
  unsigned long lastSampleAtMs = 0;
  String sensorHealth;
};

void initializeRuntimeTelemetry(DeviceState* state, Preferences& preferences);
void tickRuntimeTelemetry(DeviceState* state, Preferences& preferences);
RuntimeSnapshot buildRuntimeSnapshot(const DeviceState& state, const String& runtimeBaseUrl);
String buildRuntimeAlertsJson(const RuntimeSnapshot& snapshot, unsigned long nowMs);
String buildRuntimeHistoryJson(const DeviceState& state, uint32_t afterSequence, uint32_t limit);
bool acknowledgeRuntimeHistoryThroughSequence(uint32_t sequence);

}  // namespace coldguard
