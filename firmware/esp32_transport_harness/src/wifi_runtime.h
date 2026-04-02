#pragma once

#include <WebServer.h>

namespace coldguard {

struct DeviceState;

bool ensureSoftApStarted(WebServer& webServer, DeviceState* state, const char* firmwareVersion);
bool provisionFacilityWifi(
  WebServer& webServer,
  DeviceState* state,
  const char* firmwareVersion,
  const String& ssid,
  const String& password);
String currentRuntimeBaseUrl(DeviceState* state);
void stopSoftAp(WebServer& webServer, DeviceState* state);
void tickWifiRuntime(WebServer& webServer, DeviceState* state, const char* firmwareVersion);

}  // namespace coldguard
