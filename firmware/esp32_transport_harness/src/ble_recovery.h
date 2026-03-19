#pragma once

#include <Arduino.h>
#include <Preferences.h>
#include <WebServer.h>

#include <BLEAdvertising.h>

#include "device_state.h"

namespace coldguard {

struct BleRecoveryConfig {
  const char* actionTicketMasterKey;
  const char* firmwareVersion;
  const char* serviceUuid;
  unsigned long proofWindowMs;
  unsigned long verifiedSessionWindowMs;
  uint8_t protocolVersion;
};

struct BleRecoveryDeferredActions {
  bool restartAdvertising = false;
};

String sanitizePayloadForLogging(const String& payload);
void restartAdvertising(BLEAdvertising* advertising, const DeviceState& state, const char* serviceUuid, uint8_t protocolVersion);
String dispatchCommand(
  const String& payload,
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising,
  const BleRecoveryConfig& config,
  BleRecoveryDeferredActions* deferredActions);

}  // namespace coldguard
