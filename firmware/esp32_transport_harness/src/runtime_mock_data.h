#pragma once

#include <Arduino.h>

#include "device_state.h"

namespace coldguard {

struct RuntimeSnapshot {
  String accessMode;
  int batteryLevel;
  float currentTempC;
  bool doorOpen;
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
};

RuntimeSnapshot buildRuntimeSnapshot(const DeviceState& state, const String& runtimeBaseUrl);
String buildRuntimeAlertsJson(const RuntimeSnapshot& snapshot, unsigned long nowMs);

}  // namespace coldguard
