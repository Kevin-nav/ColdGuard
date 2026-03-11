#pragma once

#include <WebServer.h>

#include "device_state.h"

namespace coldguard {

bool ensureSoftApStarted(WebServer& webServer, DeviceState* state, const char* firmwareVersion);
void stopSoftAp(WebServer& webServer, DeviceState* state);

}  // namespace coldguard
