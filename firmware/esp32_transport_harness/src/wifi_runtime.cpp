#include "wifi_runtime.h"

#include <WiFi.h>

#include "runtime_mock_data.h"

namespace coldguard {

namespace {

constexpr unsigned long kMonitoringHeartbeatWindowMs = 90UL * 1000UL;
constexpr unsigned long kStationConnectRetryMs = 10000UL;
constexpr unsigned long kStationConnectTimeoutMs = 15000UL;

void logRuntimeEvent(const String& message) {
  Serial.println(String("[UI] Runtime -> ") + message);
}

void setRuntimePhase(DeviceState* state, const String& phase) {
  if (state->runtimePhase == phase) {
    return;
  }

  state->runtimePhase = phase;
  state->runtimePhaseChangedAtMs = millis();
  logRuntimeEvent(phase);
}

void resetStationConnectState(DeviceState* state) {
  state->stationConnectInProgress = false;
  state->stationConnectDeadlineMs = 0;
}

bool hasValidSoftApTicket(const DeviceState* state) {
  if (state->wifiTicketExpiryMs != 0 && static_cast<long>(millis() - state->wifiTicketExpiryMs) <= 0) {
    return true;
  }

  return state->lastHeartbeatAtMs != 0 &&
         static_cast<long>(millis() - state->lastHeartbeatAtMs) <= static_cast<long>(kMonitoringHeartbeatWindowMs);
}

String buildRuntimeBaseUrl(DeviceState* state) {
  if (state->stationConnected && WiFi.localIP()[0] != 0) {
    return "http://" + WiFi.localIP().toString();
  }
  return "http://" + WiFi.softAPIP().toString();
}

String buildRuntimeStatusPayload(DeviceState* state, const char* firmwareVersion) {
  const unsigned long nowMs = millis();
  const String runtimeBaseUrl = buildRuntimeBaseUrl(state);
  const RuntimeSnapshot snapshot = buildRuntimeSnapshot(*state, runtimeBaseUrl);
  const String alerts = buildRuntimeAlertsJson(snapshot, nowMs);

  return "{"
         "\"deviceId\":\"" + escapeJson(state->deviceId) + "\","
         "\"firmwareVersion\":\"" + escapeJson(firmwareVersion) + "\","
         "\"macAddress\":\"" + escapeJson(state->macAddress) + "\","
         "\"currentTempC\":" + String(snapshot.currentTempC, 2) + ","
         "\"batteryLevel\":" + String(snapshot.batteryLevel) + ","
         "\"doorOpen\":" + String(snapshot.doorOpen ? "true" : "false") + ","
         "\"mktStatus\":\"" + snapshot.mktStatus + "\","
         "\"statusText\":\"" + escapeJson(snapshot.statusText) + "\","
         "\"lastSeenAgeMs\":0,"
         "\"nickname\":\"" + escapeJson(state->deviceNickname.isEmpty() ? state->bleName : state->deviceNickname) + "\","
         "\"institutionId\":\"" + escapeJson(state->institutionId) + "\","
         "\"primaryTransport\":\"" + snapshot.primaryTransport + "\","
         "\"secondaryTransport\":" + (snapshot.secondaryTransport.isEmpty() ? String("null") : "\"" + snapshot.secondaryTransport + "\"") + ","
         "\"accessMode\":\"" + snapshot.accessMode + "\","
         "\"softApAvailable\":" + String(snapshot.softApAvailable ? "true" : "false") + ","
         "\"softApClientCount\":" + String(snapshot.softApClientCount) + ","
         "\"softApIdleTimeoutMs\":" + String(snapshot.softApIdleTimeoutMs) + ","
         "\"stationConnected\":" + String(snapshot.stationConnected ? "true" : "false") + ","
         "\"transport\":\"" + snapshot.transport + "\","
         "\"runtimeBaseUrl\":\"" + escapeJson(snapshot.runtimeBaseUrl) + "\","
         "\"alerts\":" + alerts + ","
         "\"receivedAtMs\":" + String(nowMs) +
         "}";
}

void ensureRuntimeRoutesRegistered(WebServer& webServer, DeviceState* state, const char* firmwareVersion) {
  if (state->runtimeServerStarted) {
    return;
  }

  webServer.on("/api/v1/connection-test", HTTP_GET, [state, firmwareVersion, &webServer]() {
    // For enrolled devices the SoftAP password itself serves as layer-1 auth.
    // Only block unenrolled (blank) devices that lack a ticket.
    if (state->enrollmentState != "enrolled" && !hasValidSoftApTicket(state) && !state->stationConnected) {
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

    const RuntimeSnapshot snapshot = buildRuntimeSnapshot(*state, buildRuntimeBaseUrl(state));
    webServer.send(
      200,
      "application/json",
      "{"
      "\"ok\":true,"
      "\"runtimeBaseUrl\":\"" + escapeJson(buildRuntimeBaseUrl(state)) + "\","
      "\"alerts\":" + buildRuntimeAlertsJson(snapshot, millis()) +
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
  if (state->stationConnected) {
    setRuntimePhase(state, "facility-wifi-ready");
  } else if (state->accessPointStarted) {
    setRuntimePhase(state, "softap-ready");
  }
}

void maybeEnsureStationConnected(DeviceState* state) {
  if (state->facilityWifiSsid.isEmpty()) {
    state->stationConnected = false;
    resetStationConnectState(state);
    if (state->accessPointStarted) {
      setRuntimePhase(state, "softap-ready");
    } else {
      setRuntimePhase(state, "idle");
    }
    return;
  }

  if (WiFi.status() == WL_CONNECTED) {
    state->stationConnected = true;
    if (!state->stationConnectInProgress) {
      state->stationConnectDeadlineMs = 0;
    }
    resetStationConnectState(state);
    state->facilityWifiProvisioning = false;
    setRuntimePhase(state, "facility-wifi-ready");
    return;
  }

  const unsigned long nowMs = millis();
  if (state->stationConnectInProgress) {
    if (state->stationConnectDeadlineMs != 0 &&
        static_cast<long>(nowMs - state->stationConnectDeadlineMs) >= 0) {
      resetStationConnectState(state);
      state->stationConnected = false;
      setRuntimePhase(state, "facility-wifi-failed");
      return;
    }

    state->stationConnected = false;
    setRuntimePhase(
      state,
      state->facilityWifiProvisioning ? "facility-wifi-provisioning" : "facility-wifi-connecting");
    return;
  }

  if (state->lastStationConnectAttemptMs != 0 &&
      static_cast<long>(nowMs - state->lastStationConnectAttemptMs) < static_cast<long>(kStationConnectRetryMs)) {
    state->stationConnected = false;
    setRuntimePhase(state, "facility-wifi-retrying");
    return;
  }

  WiFi.mode(state->accessPointStarted ? WIFI_AP_STA : WIFI_STA);
  WiFi.begin(state->facilityWifiSsid.c_str(), state->facilityWifiPassword.c_str());
  state->lastStationConnectAttemptMs = nowMs;
  state->stationConnectDeadlineMs = nowMs + kStationConnectTimeoutMs;
  state->stationConnectInProgress = true;
  state->stationConnected = false;
  setRuntimePhase(
    state,
    state->facilityWifiProvisioning ? "facility-wifi-provisioning" : "facility-wifi-connecting");
}

}  // namespace

void stopSoftAp(WebServer& webServer, DeviceState* state) {
  if (!state->accessPointStarted) {
    state->wifiTicketExpiryMs = 0;
    return;
  }

  WiFi.softAPdisconnect(true);
  state->accessPointStarted = false;
  state->softApStartInProgress = false;
  state->wifiTicketExpiryMs = 0;

  if (!state->stationConnected && state->runtimeServerStarted) {
    webServer.stop();
    state->runtimeServerStarted = false;
  }

  if (state->stationConnected) {
    setRuntimePhase(state, "facility-wifi-ready");
  } else if (state->facilityWifiSsid.isEmpty()) {
    setRuntimePhase(state, "idle");
  }
}

bool ensureSoftApStarted(WebServer& webServer, DeviceState* state, const char* firmwareVersion) {
  // For enrolled devices, keep the SoftAP running even when the ticket expires.
  // The WiFi password itself provides sufficient auth for reconnection.
  // Only stop the AP for blank/unenrolled devices when the ticket expires.
  if (state->accessPointStarted && !hasValidSoftApTicket(state) && state->enrollmentState != "enrolled") {
    stopSoftAp(webServer, state);
  }

  maybeEnsureStationConnected(state);

  if (state->accessPointStarted) {
    if (!state->runtimeServerStarted) {
      ensureRuntimeRoutesRegistered(webServer, state, firmwareVersion);
    }
    if (!state->stationConnectInProgress && !state->stationConnected) {
      setRuntimePhase(state, "softap-ready");
    }
    return true;
  }

  state->wifiSsid = state->bleName;
  state->softApStartInProgress = true;
  setRuntimePhase(state, "softap-starting");
  WiFi.mode(state->facilityWifiSsid.isEmpty() ? WIFI_AP : WIFI_AP_STA);
  state->accessPointStarted = WiFi.softAP(state->wifiSsid.c_str(), state->wifiPassword.c_str());
  state->softApStartInProgress = false;
  if (!state->accessPointStarted) {
    setRuntimePhase(state, "softap-failed");
    return false;
  }

  ensureRuntimeRoutesRegistered(webServer, state, firmwareVersion);
  if (!state->stationConnectInProgress && !state->stationConnected) {
    setRuntimePhase(state, "softap-ready");
  }
  return true;
}

bool provisionFacilityWifi(
  WebServer& webServer,
  DeviceState* state,
  const char* firmwareVersion,
  const String& ssid,
  const String& password) {
  if (WiFi.status() == WL_CONNECTED && WiFi.SSID() != ssid) {
    WiFi.disconnect(false, false);
    state->stationConnected = false;
    state->lastStationConnectAttemptMs = 0;
    resetStationConnectState(state);
  }
  state->facilityWifiSsid = ssid;
  state->facilityWifiPassword = password;
  state->lastStationConnectAttemptMs = 0;
  state->facilityWifiProvisioning = true;
  resetStationConnectState(state);
  maybeEnsureStationConnected(state);
  const unsigned long startedAtMs = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAtMs < kStationConnectTimeoutMs) {
    maybeEnsureStationConnected(state);
    delay(20);
    yield();
  }
  state->stationConnected = WiFi.status() == WL_CONNECTED;
  state->facilityWifiProvisioning = false;
  if (!state->stationConnected) {
    resetStationConnectState(state);
    setRuntimePhase(state, "facility-wifi-failed");
  }

  if (state->stationConnected && !state->runtimeServerStarted) {
    ensureRuntimeRoutesRegistered(webServer, state, firmwareVersion);
  }

  return state->stationConnected;
}

String currentRuntimeBaseUrl(DeviceState* state) {
  return buildRuntimeBaseUrl(state);
}

void tickWifiRuntime(WebServer& webServer, DeviceState* state, const char* firmwareVersion) {
  // For enrolled devices, keep the SoftAP running continuously for reconnection.
  // Only clear the ticket expiry so ticket-gated endpoints return 401 when needed.
  if (state->accessPointStarted && !hasValidSoftApTicket(state) && state->enrollmentState != "enrolled") {
    stopSoftAp(webServer, state);
  } else if (state->accessPointStarted && !hasValidSoftApTicket(state)) {
    // Let the AP keep running but clear the ticket so fresh BLE auth is needed for new tickets.
    state->wifiTicketExpiryMs = 0;
  }

  maybeEnsureStationConnected(state);

  // Auto-start the SoftAP for enrolled devices so stored-credential reconnection always works.
  if (!state->accessPointStarted && state->enrollmentState == "enrolled" && state->wifiPassword.length() >= 8) {
    ensureSoftApStarted(webServer, state, firmwareVersion);
  }

  if ((state->accessPointStarted || state->stationConnected) && !state->runtimeServerStarted) {
    ensureRuntimeRoutesRegistered(webServer, state, firmwareVersion);
  }

  if (!state->accessPointStarted && !state->stationConnected && state->runtimeServerStarted) {
    webServer.stop();
    state->runtimeServerStarted = false;
    if (state->facilityWifiSsid.isEmpty()) {
      setRuntimePhase(state, "idle");
    }
  }
}

}  // namespace coldguard
