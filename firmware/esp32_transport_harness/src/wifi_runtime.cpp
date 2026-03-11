#include "wifi_runtime.h"

#include <WiFi.h>

namespace coldguard {

void stopSoftAp(WebServer& webServer, DeviceState* state) {
  if (!state->accessPointStarted) {
    state->wifiTicketExpiryMs = 0;
    return;
  }

  webServer.stop();
  WiFi.softAPdisconnect(true);
  state->accessPointStarted = false;
  state->wifiTicketExpiryMs = 0;
}

bool ensureSoftApStarted(WebServer& webServer, DeviceState* state, const char* firmwareVersion) {
  if (state->accessPointStarted && state->wifiTicketExpiryMs != 0 && static_cast<long>(millis() - state->wifiTicketExpiryMs) > 0) {
    stopSoftAp(webServer, state);
  }

  if (state->accessPointStarted) {
    return true;
  }

  state->wifiSsid = state->bleName;

  WiFi.mode(WIFI_AP);
  state->accessPointStarted = WiFi.softAP(state->wifiSsid.c_str(), state->wifiPassword.c_str());
  if (!state->accessPointStarted) {
    return false;
  }

  webServer.stop();
  webServer.on("/api/v1/connection-test", HTTP_GET, [state, firmwareVersion, &webServer]() {
    if (state->wifiTicketExpiryMs == 0 || static_cast<long>(millis() - state->wifiTicketExpiryMs) > 0) {
      webServer.send(
        401,
        "application/json",
        "{\"ok\":false,\"errorCode\":\"WIFI_TICKET_EXPIRED\",\"message\":\"Wi-Fi ticket expired.\"}");
      return;
    }

    const unsigned long nowMs = millis();
    const float temp = 4.2f + static_cast<float>((nowMs / 1000UL) % 5) * 0.1f;
    const int batteryLevel = 87 + static_cast<int>((nowMs / 5000UL) % 7);
    const bool doorOpen = ((nowMs / 15000UL) % 2) == 1;
    const String payload = "{"
                           "\"deviceId\":\"" + escapeJson(state->deviceId) + "\","
                           "\"firmwareVersion\":\"" + escapeJson(firmwareVersion) + "\","
                           "\"macAddress\":\"" + escapeJson(state->macAddress) + "\","
                           "\"currentTempC\":" + String(temp, 2) + ","
                           "\"batteryLevel\":" + String(batteryLevel) + ","
                           "\"doorOpen\":" + String(doorOpen ? "true" : "false") + ","
                           "\"mktStatus\":\"safe\","
                           "\"statusText\":\"BLE authentication and Wi-Fi handover completed.\","
                           "\"lastSeenAgeMs\":0,"
                           "\"nickname\":\"" + escapeJson(state->deviceNickname.isEmpty() ? state->bleName : state->deviceNickname) + "\","
                           "\"institutionId\":\"" + escapeJson(state->institutionId) + "\""
                           "}";
    webServer.send(200, "application/json", payload);
  });
  webServer.begin();
  return true;
}

}  // namespace coldguard
