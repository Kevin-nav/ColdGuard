#include "ble_recovery.h"

#include <cctype>
#include <cstdlib>
#include <BLEAdvertising.h>

#include "action_ticket.h"
#include "wifi_runtime.h"

namespace coldguard {

namespace {

String getJsonString(const String& payload, const char* key) {
  const String needle = "\"" + String(key) + "\":";
  const int keyIndex = payload.indexOf(needle);
  if (keyIndex < 0) {
    return "";
  }

  int valueIndex = keyIndex + needle.length();
  while (valueIndex < static_cast<int>(payload.length()) && isspace(payload.charAt(valueIndex))) {
    valueIndex++;
  }
  if (valueIndex >= static_cast<int>(payload.length()) || payload.charAt(valueIndex) != '"') {
    return "";
  }

  valueIndex++;
  String value;
  bool escaping = false;
  while (valueIndex < static_cast<int>(payload.length())) {
    const char current = payload.charAt(valueIndex++);
    if (escaping) {
      value += current;
      escaping = false;
      continue;
    }
    if (current == '\\') {
      escaping = true;
      continue;
    }
    if (current == '"') {
      break;
    }
    value += current;
  }
  return value;
}

long long getJsonInt64(const String& payload, const char* key, long long fallbackValue = 0) {
  const String needle = "\"" + String(key) + "\":";
  const int keyIndex = payload.indexOf(needle);
  if (keyIndex < 0) {
    return fallbackValue;
  }

  int valueIndex = keyIndex + needle.length();
  while (valueIndex < static_cast<int>(payload.length()) && isspace(payload.charAt(valueIndex))) {
    valueIndex++;
  }

  int endIndex = valueIndex;
  while (endIndex < static_cast<int>(payload.length())) {
    const char current = payload.charAt(endIndex);
    if (!(isdigit(current) || current == '-')) {
      break;
    }
    endIndex++;
  }

  if (endIndex == valueIndex) {
    return fallbackValue;
  }
  return std::atoll(payload.substring(valueIndex, endIndex).c_str());
}

bool hasCommand(const String& payload, const char* command) {
  return getJsonString(payload, "command") == String(command);
}

String getJsonObject(const String& payload, const char* key) {
  const String needle = "\"" + String(key) + "\":";
  const int keyIndex = payload.indexOf(needle);
  if (keyIndex < 0) {
    return "";
  }

  int valueIndex = keyIndex + needle.length();
  while (valueIndex < static_cast<int>(payload.length()) && isspace(payload.charAt(valueIndex))) {
    valueIndex++;
  }
  if (valueIndex >= static_cast<int>(payload.length()) || payload.charAt(valueIndex) != '{') {
    return "";
  }

  const int objectStart = valueIndex;
  int depth = 0;
  bool inString = false;
  bool escaping = false;
  while (valueIndex < static_cast<int>(payload.length())) {
    const char current = payload.charAt(valueIndex);
    if (escaping) {
      escaping = false;
      valueIndex++;
      continue;
    }
    if (current == '\\') {
      escaping = true;
      valueIndex++;
      continue;
    }
    if (current == '"') {
      inString = !inString;
      valueIndex++;
      continue;
    }
    if (!inString) {
      if (current == '{') {
        depth++;
      } else if (current == '}') {
        depth--;
        if (depth == 0) {
          return payload.substring(objectStart, valueIndex + 1);
        }
      }
    }
    valueIndex++;
  }

  return "";
}

String redactJsonObjectField(const String& payload, const char* key) {
  const String objectValue = getJsonObject(payload, key);
  if (objectValue.isEmpty()) {
    return payload;
  }

  const String needle = "\"" + String(key) + "\":";
  const int keyIndex = payload.indexOf(needle);
  if (keyIndex < 0) {
    return payload;
  }

  const int objectIndex = payload.indexOf(objectValue, keyIndex + needle.length());
  if (objectIndex < 0) {
    return payload;
  }

  return payload.substring(0, objectIndex) + "\"<redacted>\"" + payload.substring(objectIndex + objectValue.length());
}

String redactJsonStringField(const String& payload, const char* key) {
  String redacted = payload;
  const String needle = "\"" + String(key) + "\":";
  int searchFrom = 0;

  while (searchFrom < static_cast<int>(redacted.length())) {
    const int keyIndex = redacted.indexOf(needle, searchFrom);
    if (keyIndex < 0) {
      break;
    }

    int valueIndex = keyIndex + needle.length();
    while (valueIndex < static_cast<int>(redacted.length()) && isspace(redacted.charAt(valueIndex))) {
      valueIndex++;
    }

    if (valueIndex >= static_cast<int>(redacted.length()) || redacted.charAt(valueIndex) != '"') {
      searchFrom = keyIndex + needle.length();
      continue;
    }

    const int valueStart = valueIndex + 1;
    valueIndex = valueStart;
    bool escaping = false;
    while (valueIndex < static_cast<int>(redacted.length())) {
      const char current = redacted.charAt(valueIndex);
      if (escaping) {
        escaping = false;
        valueIndex++;
        continue;
      }
      if (current == '\\') {
        escaping = true;
        valueIndex++;
        continue;
      }
      if (current == '"') {
        break;
      }
      valueIndex++;
    }

    if (valueIndex >= static_cast<int>(redacted.length())) {
      break;
    }

    redacted = redacted.substring(0, valueStart) + "<redacted>" + redacted.substring(valueIndex);
    searchFrom = valueStart + 10;
  }

  return redacted;
}

String buildErrorResponse(const String& command, const String& requestId, const String& errorCode, const String& message) {
  return "{"
         "\"ok\":false,"
         "\"command\":\"" + escapeJson(command) + "\","
         "\"requestId\":\"" + escapeJson(requestId) + "\","
         "\"errorCode\":\"" + escapeJson(errorCode) + "\","
         "\"message\":\"" + escapeJson(message) + "\""
         "}";
}

String buildHelloResponse(DeviceState* state, const String& requestId, const BleRecoveryConfig& config) {
  const uint64_t efuseMac = ESP.getEfuseMac();
  const uint64_t deviceTimeMs = currentDeviceTimeMs();
  state->lastDeviceNonceIssuedAtMs = deviceTimeMs;
  state->lastDeviceNonce = uint64ToString(efuseMac) + "-" + String(static_cast<uint32_t>(esp_random()), HEX);

  return "{"
         "\"ok\":true,"
         "\"command\":\"hello\","
         "\"requestId\":\"" + escapeJson(requestId) + "\","
         "\"deviceId\":\"" + escapeJson(state->deviceId) + "\","
         "\"bleName\":\"" + escapeJson(state->bleName) + "\","
         "\"deviceNonce\":\"" + escapeJson(state->lastDeviceNonce) + "\","
         "\"firmwareVersion\":\"" + escapeJson(config.firmwareVersion) + "\","
         "\"macAddress\":\"" + escapeJson(state->macAddress) + "\","
         "\"deviceTimeMs\":" + uint64ToString(deviceTimeMs) + ","
         "\"protocolVersion\":" + String(config.protocolVersion) + ","
         "\"state\":\"" + escapeJson(observableEnrollmentState(*state)) + "\""
         "}";
}

bool hasVerifiedSession(const DeviceState& state, const String& requiredPermission) {
  if (static_cast<long>(millis() - state.verifiedSessionUntilMs) > 0) {
    return false;
  }
  if (requiredPermission == "manage") {
    return state.lastVerifiedPermission == "manage";
  }
  return state.lastVerifiedPermission == "connect" || state.lastVerifiedPermission == "manage";
}

String handleEnrollBegin(
  const String& payload,
  const String& requestId,
  DeviceState* state,
  Preferences& preferences,
  BLEAdvertising* advertising,
  const BleRecoveryConfig& config) {
  if (state->pendingEnrollment.active) {
    return buildErrorResponse("enroll.begin", requestId, "ENROLLMENT_PENDING", "Enrollment is already pending.");
  }

  if (state->enrollmentState != "blank") {
    return buildErrorResponse("enroll.begin", requestId, "DEVICE_ALREADY_ENROLLED", "Device is already enrolled.");
  }

  const String incomingDeviceId = getJsonString(payload, "deviceId");
  const String incomingBootstrapToken = getJsonString(payload, "bootstrapToken");
  const String incomingInstitutionId = getJsonString(payload, "institutionId");
  const String incomingNickname = getJsonString(payload, "nickname");
  const String incomingHandshakeToken = getJsonString(payload, "handshakeToken");
  const String actionTicket = getJsonObject(payload, "actionTicket");
  const String handshakeProof = getJsonString(payload, "handshakeProof");
  const long long proofTimestamp = getJsonInt64(payload, "proofTimestamp", 0);

  if (incomingDeviceId != state->deviceId || incomingBootstrapToken != state->bootstrapToken) {
    return buildErrorResponse("enroll.begin", requestId, "ENROLLMENT_BOOTSTRAP_INVALID", "Bootstrap token or device id did not match.");
  }

  if (incomingInstitutionId.isEmpty()) {
    return buildErrorResponse("enroll.begin", requestId, "INSTITUTION_REQUIRED", "Institution id is required for enrollment.");
  }

  if (incomingHandshakeToken.isEmpty()) {
    return buildErrorResponse("enroll.begin", requestId, "HANDSHAKE_TOKEN_REQUIRED", "Handshake token is required for enrollment.");
  }

  if (!verifyHandshakeProofWithToken(incomingHandshakeToken, *state, handshakeProof, proofTimestamp, config.proofWindowMs)) {
    return buildErrorResponse("enroll.begin", requestId, "HANDSHAKE_PROOF_INVALID", "Handshake proof did not validate.");
  }

  uint32_t nextGrantVersion = 0;
  if (!verifyActionTicket(
        actionTicket,
        *state,
        incomingInstitutionId,
        "enroll",
        proofTimestamp,
        config.proofWindowMs,
        config.actionTicketMasterKey,
        &nextGrantVersion)) {
    return buildErrorResponse("enroll.begin", requestId, "ENROLLMENT_TICKET_INVALID", "Supervisor enrollment action ticket verification failed.");
  }

  state->pendingEnrollment.active = true;
  state->pendingEnrollment.institutionId = incomingInstitutionId;
  state->pendingEnrollment.nickname = incomingNickname;
  state->pendingEnrollment.handshakeToken = incomingHandshakeToken;
  state->pendingEnrollment.grantVersion = nextGrantVersion;
  saveDeviceState(preferences, *state);
  restartAdvertising(advertising, *state, config.serviceUuid, config.protocolVersion);

  return "{"
         "\"ok\":true,"
         "\"command\":\"enroll.begin\","
         "\"requestId\":\"" + escapeJson(requestId) + "\","
         "\"state\":\"pending\""
         "}";
}

String handleEnrollCommit(
  const String& requestId,
  DeviceState* state,
  Preferences& preferences,
  BLEAdvertising* advertising,
  const BleRecoveryConfig& config) {
  if (!state->pendingEnrollment.active) {
    return buildErrorResponse("enroll.commit", requestId, "NO_PENDING_ENROLLMENT", "Call enroll.begin before enroll.commit.");
  }

  state->enrollmentState = "enrolled";
  state->institutionId = state->pendingEnrollment.institutionId;
  state->deviceNickname = state->pendingEnrollment.nickname;
  state->handshakeToken = state->pendingEnrollment.handshakeToken;
  state->grantVersion = state->pendingEnrollment.grantVersion;
  state->pendingEnrollment = PendingEnrollment{};
  saveDeviceState(preferences, *state);
  restartAdvertising(advertising, *state, config.serviceUuid, config.protocolVersion);

  return "{"
         "\"ok\":true,"
         "\"command\":\"enroll.commit\","
         "\"requestId\":\"" + escapeJson(requestId) + "\","
         "\"state\":\"enrolled\","
         "\"deviceId\":\"" + escapeJson(state->deviceId) + "\","
         "\"bleName\":\"" + escapeJson(state->bleName) + "\""
         "}";
}

String handleGrantVerify(
  const String& payload,
  const String& requestId,
  DeviceState* state,
  Preferences& preferences,
  const BleRecoveryConfig& config) {
  if (state->enrollmentState != "enrolled") {
    return buildErrorResponse("grant.verify", requestId, "DEVICE_NOT_ENROLLED", "Device must be enrolled before grant verification.");
  }

  const String incomingDeviceId = getJsonString(payload, "deviceId");
  const String actionTicket = getJsonObject(payload, "actionTicket");
  const String handshakeProof = getJsonString(payload, "handshakeProof");
  const long long proofTimestamp = getJsonInt64(payload, "proofTimestamp", 0);

  if (incomingDeviceId != state->deviceId) {
    return buildErrorResponse("grant.verify", requestId, "DEVICE_ID_MISMATCH", "The grant was issued for a different device.");
  }

  uint32_t nextGrantVersion = 0;
  if (!verifyHandshakeProof(*state, handshakeProof, proofTimestamp, config.proofWindowMs)) {
    return buildErrorResponse("grant.verify", requestId, "HANDSHAKE_PROOF_INVALID", "Handshake proof did not validate.");
  }

  if (!verifyActionTicket(
        actionTicket,
        *state,
        state->institutionId,
        "connect",
        proofTimestamp,
        config.proofWindowMs,
        config.actionTicketMasterKey,
        &nextGrantVersion)) {
    return buildErrorResponse("grant.verify", requestId, "ACTION_TICKET_INVALID", "Action ticket verification failed.");
  }

  if (nextGrantVersion <= state->grantVersion) {
    return buildErrorResponse("grant.verify", requestId, "GRANT_VERSION_STALE", "Grant version is older than the enrolled version.");
  }

  state->grantVersion = nextGrantVersion;
  state->verifiedSessionUntilMs = millis() + config.verifiedSessionWindowMs;
  state->lastVerifiedPermission = "connect";
  saveDeviceState(preferences, *state);

  return "{"
         "\"ok\":true,"
         "\"command\":\"grant.verify\","
         "\"requestId\":\"" + escapeJson(requestId) + "\","
         "\"verifiedForMs\":" + String(config.verifiedSessionWindowMs)
         + "}";
}

String handleWifiTicketRequest(
  const String& requestId,
  DeviceState* state,
  WebServer& webServer,
  const BleRecoveryConfig& config) {
  if (!hasVerifiedSession(*state, "connect")) {
    return buildErrorResponse("wifi.ticket.request", requestId, "AUTH_REQUIRED", "Verify the BLE action ticket before requesting Wi-Fi handover.");
  }

  if (!ensureSoftApStarted(webServer, state, config.firmwareVersion)) {
    return buildErrorResponse("wifi.ticket.request", requestId, "SOFTAP_START_FAILED", "ESP32 could not start its Wi-Fi access point.");
  }

  state->wifiTicketExpiryMs = millis() + 60000UL;

  return "{"
         "\"ok\":true,"
         "\"command\":\"wifi.ticket.request\","
         "\"requestId\":\"" + escapeJson(requestId) + "\","
         "\"ssid\":\"" + escapeJson(state->wifiSsid) + "\","
         "\"password\":\"" + escapeJson(state->wifiPassword) + "\","
         "\"testUrl\":\"http://192.168.4.1/api/v1/connection-test\","
         "\"expiresInMs\":60000"
         "}";
}

String handleDecommission(
  const String& payload,
  const String& requestId,
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising,
  const BleRecoveryConfig& config) {
  if (state->enrollmentState != "enrolled") {
    return buildErrorResponse("device.decommission", requestId, "DEVICE_NOT_ENROLLED", "Device is already blank.");
  }

  const String actionTicket = getJsonObject(payload, "actionTicket");
  const String handshakeProof = getJsonString(payload, "handshakeProof");
  const long long proofTimestamp = getJsonInt64(payload, "proofTimestamp", 0);

  uint32_t nextGrantVersion = 0;
  if (!verifyHandshakeProof(*state, handshakeProof, proofTimestamp, config.proofWindowMs)) {
    return buildErrorResponse("device.decommission", requestId, "HANDSHAKE_PROOF_INVALID", "Handshake proof did not validate.");
  }

  if (!verifyActionTicket(
        actionTicket,
        *state,
        state->institutionId,
        "decommission",
        proofTimestamp,
        config.proofWindowMs,
        config.actionTicketMasterKey,
        &nextGrantVersion)) {
    return buildErrorResponse("device.decommission", requestId, "ACTION_TICKET_INVALID", "Supervisor decommission action ticket verification failed.");
  }

  if (nextGrantVersion <= state->grantVersion) {
    return buildErrorResponse("device.decommission", requestId, "GRANT_STALE", "Supervisor grant is stale or rotated.");
  }

  stopSoftAp(webServer, state);
  clearEnrollmentState(state);
  saveDeviceState(preferences, *state);
  restartAdvertising(advertising, *state, config.serviceUuid, config.protocolVersion);

  return "{"
         "\"ok\":true,"
         "\"command\":\"device.decommission\","
         "\"requestId\":\"" + escapeJson(requestId) + "\","
         "\"state\":\"blank\""
         "}";
}

}  // namespace

String sanitizePayloadForLogging(const String& payload) {
  String sanitized = payload;
  sanitized = redactJsonObjectField(sanitized, "actionTicket");
  sanitized = redactJsonStringField(sanitized, "bootstrapToken");
  sanitized = redactJsonStringField(sanitized, "handshakeToken");
  sanitized = redactJsonStringField(sanitized, "handshakeProof");
  sanitized = redactJsonStringField(sanitized, "password");
  return sanitized;
}

void restartAdvertising(BLEAdvertising* advertising, const DeviceState& state, const char* serviceUuid, uint8_t protocolVersion) {
  BLEAdvertisementData advertisingData;
  const String serviceData = buildAdvertisementPayload(state, protocolVersion);
  advertisingData.setName(state.bleName.c_str());
  advertisingData.setServiceData(BLEUUID(serviceUuid), serviceData);

  advertising->stop();
  advertising->setAdvertisementData(advertisingData);
  advertising->start();
}

String dispatchCommand(
  const String& payload,
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising,
  const BleRecoveryConfig& config) {
  const String requestId = getJsonString(payload, "requestId");

  if (hasCommand(payload, "hello")) {
    return buildHelloResponse(state, requestId, config);
  }
  if (hasCommand(payload, "enroll.begin")) {
    return handleEnrollBegin(payload, requestId, state, preferences, advertising, config);
  }
  if (hasCommand(payload, "enroll.commit")) {
    return handleEnrollCommit(requestId, state, preferences, advertising, config);
  }
  if (hasCommand(payload, "grant.verify")) {
    return handleGrantVerify(payload, requestId, state, preferences, config);
  }
  if (hasCommand(payload, "wifi.ticket.request")) {
    return handleWifiTicketRequest(requestId, state, webServer, config);
  }
  if (hasCommand(payload, "device.decommission")) {
    return handleDecommission(payload, requestId, state, preferences, webServer, advertising, config);
  }

  return buildErrorResponse("unknown", requestId, "UNKNOWN_COMMAND", "Command not recognized by the transport harness.");
}

}  // namespace coldguard
