#pragma once

#include <Arduino.h>
#include <Preferences.h>
#include <WebServer.h>

#include <BLEAdvertising.h>

#include "device_state.h"

namespace coldguard {

struct DeviceUiConfig {
  uint8_t navTouchPin;
  uint8_t selectTouchPin;
  uint8_t ledPin;
  uint8_t lcdAddress;
  uint8_t lcdColumns;
  uint8_t lcdRows;
  float touchThresholdFactor;
  unsigned long touchDebounceMs;
  unsigned long longPressMs;
  const char* firmwareVersion;
  uint8_t protocolVersion;
  const char* serviceUuid;
};

void initializeDeviceUi(const DeviceUiConfig& config);
void tickDeviceUi(
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising);

}  // namespace coldguard
