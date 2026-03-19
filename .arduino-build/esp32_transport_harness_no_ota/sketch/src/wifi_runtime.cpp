#line 1 "C:\\Users\\Kevin\\Projects\\LabVIEW\\ColdGuard\\firmware\\esp32_transport_harness\\src\\wifi_runtime.cpp"
#include "wifi_runtime.h"

#include <WiFi.h>

namespace coldguard {

namespace {

constexpr unsigned long kMonitoringHeartbeatWindowMs = 90UL * 1000UL;

bool hasValidSoftApTicket(const DeviceState* state) {
  if (state->wifiTicketExpiryMs != 0 && static_cast<long>(millis() - state->wifiTicketExpiryMs) <= 0) {
    return true;
  }

  return state->lastHeartbeatAtMs != 0 &&
         static_cast<long>(millis() - state->lastHeartbeatAtMs) <= static_cast<long>(kMonitoringHeartbeatWindowMs);
}

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

String buildRuntimeBaseUrl(DeviceState* state) {
  if (state->stationConnected && WiFi.localIP()[0] != 0) {
    return "http://" + WiFi.localIP().toString();
  }
  return "http://" + WiFi.softAPIP().toString();
}

String buildAlertsJson() {
  const float temp = currentMockTemperature();
  const int batteryLevel = currentMockBatteryLevel();
  const bool doorOpen = currentMockDoorOpen();
  const unsigned long nowMs = millis();
  String alerts = "[";
  bool first = true;

  if (temp >= 4.5f) {
    alerts += "{"
              "\"cursor\":\"temperature-" + String(nowMs) + "\","
              "\"incidentType\":\"temperature\","
              "\"severity\":\"warning\","
              "\"status\":\"open\","
              "\"title\":\"Temperature excursion in progress\","
              "\"body\":\"Runtime polling detected a warming trend.\","
              "\"triggeredAt\":" + String(nowMs) +
              "}";
    first = false;
  }

  if (doorOpen) {
    if (!first) {
      alerts += ",";
    }
    alerts += "{"
              "\"cursor\":\"door-" + String(nowMs) + "\","
              "\"incidentType\":\"door_open\","
              "\"severity\":\"warning\","
              "\"status\":\"open\","
              "\"title\":\"Door is still open\","
              "\"body\":\"Runtime polling detected an open door state.\","
              "\"triggeredAt\":" + String(nowMs) +
              "}";
    first = false;
  }

  if (batteryLevel < 90) {
    if (!first) {
      alerts += ",";
    }
    alerts += "{"
              "\"cursor\":\"battery-" + String(nowMs) + "\","
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

String buildRuntimeStatusPayload(DeviceState* state, const char* firmwareVersion) {
  const unsigned long nowMs = millis();
  const float temp = currentMockTemperature();
  const int batteryLevel = currentMockBatteryLevel();
  const bool doorOpen = currentMockDoorOpen();

  return "{"
         "\"deviceId\":\"" + escapeJson(state->deviceId) + "\","
         "\"firmwareVersion\":\"" + escapeJson(firmwareVersion) + "\","
         "\"macAddress\":\"" + escapeJson(state->macAddress) + "\","
         "\"currentTempC\":" + String(temp, 2) + ","
         "\"batteryLevel\":" + String(batteryLevel) + ","
         "\"doorOpen\":" + String(doorOpen ? "true" : "false") + ","
         "\"mktStatus\":\"safe\","
         "\"statusText\":\"Runtime status available.\","
         "\"lastSeenAgeMs\":0,"
         "\"nickname\":\"" + escapeJson(state->deviceNickname.isEmpty() ? state->bleName : state->deviceNickname) + "\","
         "\"institutionId\":\"" + escapeJson(state->institutionId) + "\","
         "\"runtimeBaseUrl\":\"" + escapeJson(buildRuntimeBaseUrl(state)) + "\","
         "\"alerts\":" + buildAlertsJson() + ","
         "\"receivedAtMs\":" + String(nowMs) +
         "}";
}

void ensureRuntimeRoutesRegistered(WebServer& webServer, DeviceState* state, const char* firmwareVersion) {
  if (state->runtimeServerStarted) {
    return;
  }

  webServer.on("/api/v1/connection-test", HTTP_GET, [state, firmwareVersion, &webServer]() {
    if (!hasValidSoftApTicket(state) && !state->stationConnected) {
      webServer.send(
        401,
        "application/json",
        "{\"ok\":false,\"errorCode\":\"WIFI_TICKET_EXPIRED\",\"message\":\"Wi-Fi ticket expired.\"}");
      return;
    }

    webServer.send(200, "application/json", buildRuntimeStatusPayload(state, firmwareVersion));
  });

  webServer.on("/api/v1/runtime/status", HTTP_GET, [state, firmwareVersion, &webServer]() {
    if (!state->accessPointStarted && !state->stationConnected) {
      webServer.send(
        503,
        "application/json",
        "{\"ok\":false,\"errorCode\":\"RUNTIME_UNAVAILABLE\",\"message\":\"Runtime transport is unavailable.\"}");
      return;
    }

    webServer.send(200, "application/json", buildRuntimeStatusPayload(state, firmwareVersion));
  });

  webServer.on("/api/v1/runtime/alerts", HTTP_GET, [state, &webServer]() {
    if (!state->accessPointStarted && !state->stationConnected) {
      webServer.send(
        503,
        "application/json",
        "{\"ok\":false,\"errorCode\":\"RUNTIME_UNAVAILABLE\",\"message\":\"Runtime transport is unavailable.\"}");
      return;
    }

    webServer.send(
      200,
      "application/json",
      "{"
      "\"ok\":true,"
      "\"runtimeBaseUrl\":\"" + escapeJson(buildRuntimeBaseUrl(state)) + "\","
      "\"alerts\":" + buildAlertsJson() +
      "}");
  });

  webServer.on("/api/v1/runtime/ack", HTTP_POST, [state, &webServer]() {
    state->lastHeartbeatAtMs = millis();
    webServer.send(
      200,
      "application/json",
      "{"
      "\"ok\":true,"
      "\"runtimeBaseUrl\":\"" + escapeJson(buildRuntimeBaseUrl(state)) + "\""
      "}");
  });

  webServer.on("/api/v1/runtime/heartbeat", HTTP_POST, [state, &webServer]() {
    state->lastHeartbeatAtMs = millis();
    webServer.send(
      200,
      "application/json",
      "{"
      "\"ok\":true,"
      "\"receivedAtMs\":" + String(state->lastHeartbeatAtMs) + ","
      "\"runtimeBaseUrl\":\"" + escapeJson(buildRuntimeBaseUrl(state)) + "\""
      "}");
  });

  webServer.begin();
  state->runtimeServerStarted = true;
}

void maybeEnsureStationConnected(DeviceState* state) {
  if (state->facilityWifiSsid.isEmpty()) {
    state->stationConnected = false;
    return;
  }

  if (WiFi.status() == WL_CONNECTED) {
    state->stationConnected = true;
    return;
  }

  const unsigned long nowMs = millis();
  if (state->lastStationConnectAttemptMs != 0 &&
      static_cast<long>(nowMs - state->lastStationConnectAttemptMs) < 10000L) {
    state->stationConnected = false;
    return;
  }

  WiFi.mode(state->accessPointStarted ? WIFI_AP_STA : WIFI_STA);
  WiFi.begin(state->facilityWifiSsid.c_str(), state->facilityWifiPassword.c_str());
  state->lastStationConnectAttemptMs = nowMs;
  state->stationConnected = false;
}

}  // namespace

void stopSoftAp(WebServer& webServer, DeviceState* state) {
  if (!state->accessPointStarted) {
    state->wifiTicketExpiryMs = 0;
    return;
  }

  WiFi.softAPdisconnect(true);
  state->accessPointStarted = false;
  state->wifiTicketExpiryMs = 0;

  if (!state->stationConnected && state->runtimeServerStarted) {
    webServer.stop();
    state->runtimeServerStarted = false;
  }
}

bool ensureSoftApStarted(WebServer& webServer, DeviceState* state, const char* firmwareVersion) {
  if (state->accessPointStarted && !hasValidSoftApTicket(state)) {
    stopSoftAp(webServer, state);
  }

  maybeEnsureStationConnected(state);

  if (state->accessPointStarted) {
    if (!state->runtimeServerStarted) {
      ensureRuntimeRoutesRegistered(webServer, state, firmwareVersion);
    }
    return true;
  }

  state->wifiSsid = state->bleName;
  WiFi.mode(state->facilityWifiSsid.isEmpty() ? WIFI_AP : WIFI_AP_STA);
  state->accessPointStarted = WiFi.softAP(state->wifiSsid.c_str(), state->wifiPassword.c_str());
  if (!state->accessPointStarted) {
    return false;
  }

  ensureRuntimeRoutesRegistered(webServer, state, firmwareVersion);
  return true;
}

bool provisionFacilityWifi(
  WebServer& webServer,
  DeviceState* state,
  const char* firmwareVersion,
  const String& ssid,
  const String& password) {
  state->facilityWifiSsid = ssid;
  state->facilityWifiPassword = password;
  state->lastStationConnectAttemptMs = 0;
  maybeEnsureStationConnected(state);

  if (state->stationConnected && !state->runtimeServerStarted) {
    ensureRuntimeRoutesRegistered(webServer, state, firmwareVersion);
  }

  return !state->facilityWifiSsid.isEmpty();
}

String currentRuntimeBaseUrl(DeviceState* state) {
  return buildRuntimeBaseUrl(state);
}

void tickWifiRuntime(WebServer& webServer, DeviceState* state, const char* firmwareVersion) {
  if (state->accessPointStarted && !hasValidSoftApTicket(state)) {
    stopSoftAp(webServer, state);
  }

  maybeEnsureStationConnected(state);

  if ((state->accessPointStarted || state->stationConnected) && !state->runtimeServerStarted) {
    ensureRuntimeRoutesRegistered(webServer, state, firmwareVersion);
  }

  if (!state->accessPointStarted && !state->stationConnected && state->runtimeServerStarted) {
    webServer.stop();
    state->runtimeServerStarted = false;
  }
}

}  // namespace coldguard
