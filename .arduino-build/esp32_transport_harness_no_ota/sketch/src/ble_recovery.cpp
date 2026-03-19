#line 1 "C:\\Users\\Kevin\\Projects\\LabVIEW\\ColdGuard\\firmware\\esp32_transport_harness\\src\\ble_recovery.cpp"
#include "ble_recovery.h"

#include <cctype>
#include <cstdlib>
#include <mbedtls/base64.h>
#include <BLEAdvertising.h>

#include "action_ticket.h"
#include "wifi_runtime.h"

namespace coldguard {

namespace {

void debugBleRecovery(const String& message) {
  Serial.println("[BLE_DEBUG] " + message);
}

constexpr size_t kMaxPendingTransportPayloadSize = 8192;

String pendingTransportId;
String pendingTransportPayload;

void resetPendingTransport() {
  pendingTransportId = "";
  pendingTransportPayload = "";
}

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

bool getJsonBool(const String& payload, const char* key, bool fallbackValue = false) {
  const String needle = "\"" + String(key) + "\":";
  const int keyIndex = payload.indexOf(needle);
  if (keyIndex < 0) {
    return fallbackValue;
  }

  int valueIndex = keyIndex + needle.length();
  while (valueIndex < static_cast<int>(payload.length()) && isspace(payload.charAt(valueIndex))) {
    valueIndex++;
  }

  if (payload.startsWith("true", valueIndex)) {
    return true;
  }
  if (payload.startsWith("false", valueIndex)) {
    return false;
  }
  return fallbackValue;
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

String decodeBase64Payload(const String& encodedValue) {
  size_t outputLength = 0;
  int result = mbedtls_base64_decode(
    nullptr,
    0,
    &outputLength,
    reinterpret_cast<const unsigned char*>(encodedValue.c_str()),
    encodedValue.length());

  if (result != MBEDTLS_ERR_BASE64_BUFFER_TOO_SMALL && result != 0) {
    return "";
  }

  unsigned char* buffer = new unsigned char[outputLength + 1];
  result = mbedtls_base64_decode(
    buffer,
    outputLength,
    &outputLength,
    reinterpret_cast<const unsigned char*>(encodedValue.c_str()),
    encodedValue.length());
  if (result != 0) {
    delete[] buffer;
    return "";
  }

  buffer[outputLength] = '\0';
  const String decoded(reinterpret_cast<char*>(buffer));
  delete[] buffer;
  return decoded;
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
  debugBleRecovery("enter enroll.begin requestId=" + requestId);
  if (state->pendingEnrollment.active) {
    debugBleRecovery("enroll.begin rejected: pending enrollment already active");
    return buildErrorResponse("enroll.begin", requestId, "ENROLLMENT_PENDING", "Enrollment is already pending.");
  }

  if (state->enrollmentState != "blank") {
    debugBleRecovery("enroll.begin rejected: device already enrolled");
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
    debugBleRecovery("enroll.begin rejected: bootstrap/device mismatch");
    return buildErrorResponse("enroll.begin", requestId, "ENROLLMENT_BOOTSTRAP_INVALID", "Bootstrap token or device id did not match.");
  }

  if (incomingInstitutionId.isEmpty()) {
    debugBleRecovery("enroll.begin rejected: institution missing");
    return buildErrorResponse("enroll.begin", requestId, "INSTITUTION_REQUIRED", "Institution id is required for enrollment.");
  }

  if (incomingHandshakeToken.isEmpty()) {
    debugBleRecovery("enroll.begin rejected: handshake token missing");
    return buildErrorResponse("enroll.begin", requestId, "HANDSHAKE_TOKEN_REQUIRED", "Handshake token is required for enrollment.");
  }

  if (!verifyHandshakeProofWithToken(incomingHandshakeToken, *state, handshakeProof, proofTimestamp, config.proofWindowMs)) {
    debugBleRecovery("enroll.begin rejected: handshake proof invalid");
    return buildErrorResponse("enroll.begin", requestId, "HANDSHAKE_PROOF_INVALID", "Handshake proof did not validate.");
  }
  debugBleRecovery("enroll.begin handshake proof passed");

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
    debugBleRecovery("enroll.begin rejected: action ticket invalid");
    return buildErrorResponse("enroll.begin", requestId, "ENROLLMENT_TICKET_INVALID", "Supervisor enrollment action ticket verification failed.");
  }
  debugBleRecovery("enroll.begin action ticket passed");

  state->pendingEnrollment.active = true;
  state->pendingEnrollment.institutionId = incomingInstitutionId;
  state->pendingEnrollment.nickname = incomingNickname;
  state->pendingEnrollment.handshakeToken = incomingHandshakeToken;
  state->pendingEnrollment.grantVersion = nextGrantVersion;
  debugBleRecovery("enroll.begin completed: pending state staged");

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
  const BleRecoveryConfig& config,
  BleRecoveryDeferredActions* deferredActions) {
  debugBleRecovery("enter enroll.commit requestId=" + requestId);
  if (!state->pendingEnrollment.active) {
    debugBleRecovery("enroll.commit rejected: no pending enrollment");
    return buildErrorResponse("enroll.commit", requestId, "NO_PENDING_ENROLLMENT", "Call enroll.begin before enroll.commit.");
  }

  state->enrollmentState = "enrolled";
  state->institutionId = state->pendingEnrollment.institutionId;
  state->deviceNickname = state->pendingEnrollment.nickname;
  state->handshakeToken = state->pendingEnrollment.handshakeToken;
  state->grantVersion = state->pendingEnrollment.grantVersion;
  state->pendingEnrollment = PendingEnrollment{};
  debugBleRecovery("enroll.commit persisting enrolled state");
  saveDeviceState(preferences, *state);
  if (deferredActions != nullptr) {
    deferredActions->restartAdvertising = true;
  }
  debugBleRecovery("enroll.commit completed: advertising restart deferred until after response");

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

String handleWifiProvision(
  const String& payload,
  const String& requestId,
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  const BleRecoveryConfig& config) {
  if (state->enrollmentState != "enrolled") {
    return buildErrorResponse("wifi.provision", requestId, "DEVICE_NOT_ENROLLED", "Device must be enrolled before Wi-Fi provisioning.");
  }

  const String actionTicket = getJsonObject(payload, "actionTicket");
  const String handshakeProof = getJsonString(payload, "handshakeProof");
  const String ssid = getJsonString(payload, "ssid");
  const String password = getJsonString(payload, "password");
  const long long proofTimestamp = getJsonInt64(payload, "proofTimestamp", 0);

  if (ssid.isEmpty() || password.length() < 8) {
    return buildErrorResponse("wifi.provision", requestId, "WIFI_PROVISION_INPUT_INVALID", "Facility Wi-Fi credentials are incomplete.");
  }

  uint32_t nextGrantVersion = 0;
  if (!verifyHandshakeProof(*state, handshakeProof, proofTimestamp, config.proofWindowMs)) {
    return buildErrorResponse("wifi.provision", requestId, "HANDSHAKE_PROOF_INVALID", "Handshake proof did not validate.");
  }

  if (!verifyActionTicket(
        actionTicket,
        *state,
        state->institutionId,
        "wifi_provision",
        proofTimestamp,
        config.proofWindowMs,
        config.actionTicketMasterKey,
        &nextGrantVersion)) {
    return buildErrorResponse("wifi.provision", requestId, "ACTION_TICKET_INVALID", "Wi-Fi provisioning action ticket verification failed.");
  }

  if (!provisionFacilityWifi(webServer, state, config.firmwareVersion, ssid, password)) {
    return buildErrorResponse("wifi.provision", requestId, "FACILITY_WIFI_CONNECT_FAILED", "ESP32 could not join the provisioned Wi-Fi network.");
  }

  saveDeviceState(preferences, *state);

  return "{"
         "\"ok\":true,"
         "\"command\":\"wifi.provision\","
         "\"requestId\":\"" + escapeJson(requestId) + "\","
         "\"ssid\":\"" + escapeJson(state->facilityWifiSsid) + "\","
         "\"password\":\"" + escapeJson(state->facilityWifiPassword) + "\","
         "\"runtimeBaseUrl\":\"" + escapeJson(currentRuntimeBaseUrl(state)) + "\""
         "}";
}

String handleDecommission(
  const String& payload,
  const String& requestId,
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising,
  const BleRecoveryConfig& config,
  BleRecoveryDeferredActions* deferredActions) {
  debugBleRecovery("enter device.decommission requestId=" + requestId);
  if (state->enrollmentState != "enrolled") {
    debugBleRecovery("device.decommission rejected: device not enrolled");
    return buildErrorResponse("device.decommission", requestId, "DEVICE_NOT_ENROLLED", "Device is already blank.");
  }

  const String actionTicket = getJsonObject(payload, "actionTicket");
  const String handshakeProof = getJsonString(payload, "handshakeProof");
  const long long proofTimestamp = getJsonInt64(payload, "proofTimestamp", 0);

  uint32_t nextGrantVersion = 0;
  if (!verifyHandshakeProof(*state, handshakeProof, proofTimestamp, config.proofWindowMs)) {
    debugBleRecovery("device.decommission rejected: handshake proof invalid");
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
    debugBleRecovery("device.decommission rejected: action ticket invalid");
    return buildErrorResponse("device.decommission", requestId, "ACTION_TICKET_INVALID", "Supervisor decommission action ticket verification failed.");
  }

  if (nextGrantVersion <= state->grantVersion) {
    debugBleRecovery("device.decommission rejected: stale grant");
    return buildErrorResponse("device.decommission", requestId, "GRANT_STALE", "Supervisor grant is stale or rotated.");
  }

  debugBleRecovery("device.decommission clearing enrollment state");
  stopSoftAp(webServer, state);
  clearEnrollmentState(state);
  saveDeviceState(preferences, *state);
  if (deferredActions != nullptr) {
    deferredActions->restartAdvertising = true;
  }
  debugBleRecovery("device.decommission completed: advertising restart deferred until after response");

  return "{"
         "\"ok\":true,"
         "\"command\":\"device.decommission\","
         "\"requestId\":\"" + escapeJson(requestId) + "\","
         "\"state\":\"blank\""
         "}";
}

String handleTransportChunk(
  const String& payload,
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising,
  const BleRecoveryConfig& config,
  BleRecoveryDeferredActions* deferredActions) {
  const String transportId = getJsonString(payload, "transportId");
  const String data = getJsonString(payload, "data");
  const bool isFinal = getJsonBool(payload, "final", false);
  const String requestId = getJsonString(payload, "requestId");

  if (transportId.isEmpty() || data.isEmpty()) {
    return buildErrorResponse("transport.chunk", requestId, "TRANSPORT_CHUNK_INVALID", "Chunk transport payload is missing required fields.");
  }

  if (pendingTransportId != transportId) {
    pendingTransportId = transportId;
    pendingTransportPayload = "";
    debugBleRecovery("transport reset for transportId=" + transportId);
  }

  if (pendingTransportPayload.length() + data.length() > kMaxPendingTransportPayloadSize) {
    debugBleRecovery("transport payload too large transportId=" + transportId);
    resetPendingTransport();
    return buildErrorResponse(
      "transport.chunk",
      requestId,
      "TRANSPORT_CHUNK_TOO_LARGE",
      "Chunk transport payload exceeds maximum allowed size.");
  }

  pendingTransportPayload += data;

  if (!isFinal) {
    return "";
  }

  if (pendingTransportPayload.length() > kMaxPendingTransportPayloadSize) {
    debugBleRecovery("transport payload too large before decode transportId=" + transportId);
    resetPendingTransport();
    return buildErrorResponse(
      "transport.chunk",
      requestId,
      "TRANSPORT_CHUNK_TOO_LARGE",
      "Chunk transport payload exceeds maximum allowed size.");
  }

  debugBleRecovery("transport final chunk received transportId=" + transportId + " encodedLength=" + String(pendingTransportPayload.length()));
  const String decodedPayload = decodeBase64Payload(pendingTransportPayload);
  resetPendingTransport();

  if (decodedPayload.isEmpty()) {
    debugBleRecovery("transport decode failed transportId=" + transportId);
    return buildErrorResponse("transport.chunk", requestId, "TRANSPORT_CHUNK_DECODE_FAILED", "Chunk transport payload could not be decoded.");
  }

  debugBleRecovery("transport decode ok command=" + getJsonString(decodedPayload, "command") + " requestId=" + getJsonString(decodedPayload, "requestId"));

  return dispatchCommand(decodedPayload, state, preferences, webServer, advertising, config, deferredActions);
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
  const BleRecoveryConfig& config,
  BleRecoveryDeferredActions* deferredActions) {
  const String requestId = getJsonString(payload, "requestId");
  debugBleRecovery("dispatch command=" + getJsonString(payload, "command") + " requestId=" + requestId);

  if (hasCommand(payload, "hello")) {
    return buildHelloResponse(state, requestId, config);
  }
  if (hasCommand(payload, "enroll.begin")) {
    return handleEnrollBegin(payload, requestId, state, preferences, advertising, config);
  }
  if (hasCommand(payload, "enroll.commit")) {
    return handleEnrollCommit(requestId, state, preferences, advertising, config, deferredActions);
  }
  if (hasCommand(payload, "grant.verify")) {
    return handleGrantVerify(payload, requestId, state, preferences, config);
  }
  if (hasCommand(payload, "wifi.ticket.request")) {
    return handleWifiTicketRequest(requestId, state, webServer, config);
  }
  if (hasCommand(payload, "wifi.provision")) {
    return handleWifiProvision(payload, requestId, state, preferences, webServer, config);
  }
  if (hasCommand(payload, "device.decommission")) {
    return handleDecommission(payload, requestId, state, preferences, webServer, advertising, config, deferredActions);
  }
  if (hasCommand(payload, "transport.chunk")) {
    return handleTransportChunk(payload, state, preferences, webServer, advertising, config, deferredActions);
  }

  return buildErrorResponse("unknown", requestId, "UNKNOWN_COMMAND", "Command not recognized by the transport harness.");
}

}  // namespace coldguard
