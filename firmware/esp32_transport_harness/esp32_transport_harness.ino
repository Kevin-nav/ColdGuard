#include <BLE2902.h>
#include <cctype>
#include <cstdio>
#include <cstdlib>
#include <BLEAdvertising.h>
#include <BLECharacteristic.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <mbedtls/base64.h>
#include <mbedtls/bignum.h>
#include <mbedtls/ecdsa.h>
#include <mbedtls/md.h>
#include <mbedtls/pk.h>
#include <mbedtls/sha256.h>

namespace {

constexpr char kFirmwareVersion[] = "cg-transport-0.1.0";
constexpr uint8_t kProtocolVersion = 1;
constexpr unsigned long kProofWindowMs = 5UL * 60UL * 1000UL;
constexpr unsigned long kVerifiedSessionWindowMs = 60UL * 1000UL;
constexpr uint64_t kEpochBaseMs = 1700000000000ULL;
constexpr char kPreferencesNamespace[] = "coldguard";
constexpr char kGrantIssuer[] = "coldguard-api";
constexpr char kGrantKeyId[] = "coldguard-esp32-transport-v1";
constexpr bool kVerboseSecretLogging = false;
constexpr char kGrantVerificationPublicKeyPem[] = R"pem(
-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEqqIw2AFP/jM9uD4cAFBChK5xlACp
ZMQELbS6Nf0VP+go0RPhh6dgbZbGKZ7dt+CQjoGIjGrqjkBUJhcTHOnBwg==
-----END PUBLIC KEY-----
)pem";

constexpr char kServiceUuid[] = "6B8F7B61-8B30-4A70-BD9A-44B4C1D7C110";
constexpr char kCommandCharacteristicUuid[] = "6B8F7B61-8B30-4A70-BD9A-44B4C1D7C111";
constexpr char kResponseCharacteristicUuid[] = "6B8F7B61-8B30-4A70-BD9A-44B4C1D7C112";

Preferences preferences;
WebServer webServer(80);
BLEServer* bleServer = nullptr;
BLECharacteristic* commandCharacteristic = nullptr;
BLECharacteristic* responseCharacteristic = nullptr;
BLEAdvertising* advertising = nullptr;

String deviceId;
String bleName;
String macAddress;
String bootstrapToken;
String enrollmentState = "blank";
String institutionId;
String deviceNickname;
String handshakeToken;
String lastDeviceNonce;
String wifiSsid;
String wifiPassword;
String lastVerifiedPermission;
uint32_t grantVersion = 0;
unsigned long verifiedSessionUntilMs = 0;
unsigned long wifiTicketExpiryMs = 0;
bool accessPointStarted = false;

struct PendingEnrollment {
  bool active = false;
  String institutionId;
  String nickname;
  String handshakeToken;
  uint32_t grantVersion = 0;
};

PendingEnrollment pendingEnrollment;
String generateBootstrapToken();
String generateWifiPassword();
String redactJsonStringField(const String& payload, const char* key);
String sanitizePayloadForLogging(const String& payload);

void logSecretValue(const String& label, const String& value) {
  if (kVerboseSecretLogging) {
    Serial.println(label + value);
    return;
  }
  Serial.println(label + "<redacted>");
}

void logBlePayload(const String& label, const String& payload) {
  if (kVerboseSecretLogging) {
    Serial.println(label + payload);
    return;
  }

  Serial.println(label + sanitizePayloadForLogging(payload));
}

String formatMacAddress(uint64_t mac) {
  char buffer[18];
  std::snprintf(
    buffer,
    sizeof(buffer),
    "%02X:%02X:%02X:%02X:%02X:%02X",
    static_cast<uint8_t>(mac >> 40),
    static_cast<uint8_t>(mac >> 32),
    static_cast<uint8_t>(mac >> 24),
    static_cast<uint8_t>(mac >> 16),
    static_cast<uint8_t>(mac >> 8),
    static_cast<uint8_t>(mac));
  return String(buffer);
}

String buildDeviceId(uint64_t mac) {
  char buffer[20];
  std::snprintf(buffer, sizeof(buffer), "CG-ESP32-%06llX", mac & 0xFFFFFFULL);
  return String(buffer);
}

String escapeJson(const String& value) {
  String escaped;
  escaped.reserve(value.length() + 8);
  for (size_t index = 0; index < value.length(); index++) {
    const char current = value.charAt(index);
    if (current == '\\' || current == '"') {
      escaped += '\\';
    }
    escaped += current;
  }
  return escaped;
}

String uint64ToString(uint64_t value) {
  char buffer[24];
  std::snprintf(buffer, sizeof(buffer), "%llu", static_cast<unsigned long long>(value));
  return String(buffer);
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

String trimBase64Padding(const String& value) {
  int endIndex = value.length();
  while (endIndex > 0 && value.charAt(endIndex - 1) == '=') {
    endIndex--;
  }
  return value.substring(0, endIndex);
}

String base64UrlEncode(const uint8_t* bytes, size_t length) {
  size_t outputLength = 0;
  mbedtls_base64_encode(nullptr, 0, &outputLength, bytes, length);
  unsigned char* output = static_cast<unsigned char*>(malloc(outputLength + 1));
  if (output == nullptr) {
    return "";
  }

  if (mbedtls_base64_encode(output, outputLength + 1, &outputLength, bytes, length) != 0) {
    free(output);
    return "";
  }

  output[outputLength] = '\0';
  String encoded(reinterpret_cast<char*>(output));
  free(output);

  encoded.replace("+", "-");
  encoded.replace("/", "_");
  return trimBase64Padding(encoded);
}

String base64UrlDecode(const String& value) {
  String normalized = value;
  normalized.replace("-", "+");
  normalized.replace("_", "/");
  while (normalized.length() % 4 != 0) {
    normalized += '=';
  }

  size_t outputLength = 0;
  mbedtls_base64_decode(nullptr, 0, &outputLength, reinterpret_cast<const unsigned char*>(normalized.c_str()), normalized.length());
  unsigned char* output = static_cast<unsigned char*>(malloc(outputLength + 1));
  if (output == nullptr) {
    return "";
  }

  if (mbedtls_base64_decode(output, outputLength + 1, &outputLength, reinterpret_cast<const unsigned char*>(normalized.c_str()), normalized.length()) != 0) {
    free(output);
    return "";
  }

  output[outputLength] = '\0';
  String decoded(reinterpret_cast<char*>(output));
  free(output);
  return decoded;
}

bool base64UrlDecodeBytes(const String& value, uint8_t* output, size_t outputCapacity, size_t* outputLength) {
  String normalized = value;
  normalized.replace("-", "+");
  normalized.replace("_", "/");
  while (normalized.length() % 4 != 0) {
    normalized += '=';
  }

  size_t decodedLength = 0;
  const int result = mbedtls_base64_decode(
    output,
    outputCapacity,
    &decodedLength,
    reinterpret_cast<const unsigned char*>(normalized.c_str()),
    normalized.length());
  if (result != 0) {
    return false;
  }

  if (outputLength != nullptr) {
    *outputLength = decodedLength;
  }
  return true;
}

String hmacSha256Hex(const String& key, const String& payload) {
  uint8_t hmac[32];
  const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (info == nullptr) {
    return "";
  }

  if (mbedtls_md_hmac(info,
                      reinterpret_cast<const unsigned char*>(key.c_str()),
                      key.length(),
                      reinterpret_cast<const unsigned char*>(payload.c_str()),
                      payload.length(),
                      hmac) != 0) {
    return "";
  }

  static const char kHexDigits[] = "0123456789abcdef";
  String hex;
  hex.reserve(sizeof(hmac) * 2);
  for (uint8_t byte : hmac) {
    hex += kHexDigits[(byte >> 4) & 0x0F];
    hex += kHexDigits[byte & 0x0F];
  }
  return hex;
}

bool constantTimeEquals(const String& left, const String& right) {
  if (left.length() != right.length()) {
    return false;
  }

  uint8_t diff = 0;
  for (size_t index = 0; index < left.length(); index++) {
    diff |= left.charAt(index) ^ right.charAt(index);
  }
  return diff == 0;
}

void writePreferences() {
  preferences.putString("deviceId", deviceId);
  preferences.putString("bootstrap", bootstrapToken);
  preferences.putString("wifi_pw", wifiPassword);
  preferences.putString("state", enrollmentState);
  preferences.putString("institution", institutionId);
  preferences.putString("nickname", deviceNickname);
  preferences.putString("handshake", handshakeToken);
  preferences.putUInt("grantVer", grantVersion);
}

void resetEnrollment() {
  enrollmentState = "blank";
  institutionId = "";
  deviceNickname = "";
  handshakeToken = "";
  grantVersion = 0;
  pendingEnrollment = PendingEnrollment{};
  verifiedSessionUntilMs = 0;
  wifiTicketExpiryMs = 0;
  lastVerifiedPermission = "";
  bootstrapToken = generateBootstrapToken();
  if (accessPointStarted) {
    webServer.stop();
    WiFi.softAPdisconnect(true);
    accessPointStarted = false;
  }
  writePreferences();
}

String generateBootstrapToken() {
  static const char kHexDigits[] = "0123456789abcdef";
  uint8_t randomBytes[16];
  for (size_t index = 0; index < sizeof(randomBytes); index++) {
    randomBytes[index] = static_cast<uint8_t>(esp_random() & 0xFF);
  }

  String token = "claim-";
  token.reserve(6 + sizeof(randomBytes) * 2);
  for (uint8_t byte : randomBytes) {
    token += kHexDigits[(byte >> 4) & 0x0F];
    token += kHexDigits[byte & 0x0F];
  }
  return token;
}

String generateWifiPassword() {
  static const char kHexDigits[] = "0123456789abcdef";
  uint8_t randomBytes[16];
  for (size_t index = 0; index < sizeof(randomBytes); index++) {
    randomBytes[index] = static_cast<uint8_t>(esp_random() & 0xFF);
  }

  String password;
  password.reserve(sizeof(randomBytes) * 2);
  for (uint8_t byte : randomBytes) {
    password += kHexDigits[(byte >> 4) & 0x0F];
    password += kHexDigits[byte & 0x0F];
  }

  if (password.length() < 8) {
    password += "12345678";
  }
  return password;
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

String sanitizePayloadForLogging(const String& payload) {
  String sanitized = payload;
  sanitized = redactJsonStringField(sanitized, "bootstrapToken");
  sanitized = redactJsonStringField(sanitized, "grantToken");
  sanitized = redactJsonStringField(sanitized, "handshakeToken");
  sanitized = redactJsonStringField(sanitized, "handshakeProof");
  sanitized = redactJsonStringField(sanitized, "password");
  return sanitized;
}

void loadPreferences() {
  preferences.begin(kPreferencesNamespace, false);

  const uint64_t efuseMac = ESP.getEfuseMac();
  macAddress = formatMacAddress(efuseMac);
  deviceId = preferences.getString("deviceId", buildDeviceId(efuseMac));
  bleName = "ColdGuard_" + deviceId.substring(deviceId.length() - 4);
  bootstrapToken = preferences.getString("bootstrap", "");
  if (bootstrapToken.isEmpty()) {
    bootstrapToken = generateBootstrapToken();
    preferences.putString("bootstrap", bootstrapToken);
  }
  wifiPassword = preferences.getString("wifi_pw", "");
  if (wifiPassword.length() < 8) {
    wifiPassword = generateWifiPassword();
    preferences.putString("wifi_pw", wifiPassword);
  }
  enrollmentState = preferences.getString("state", "blank");
  institutionId = preferences.getString("institution", "");
  deviceNickname = preferences.getString("nickname", "");
  handshakeToken = preferences.getString("handshake", "");
  grantVersion = preferences.getUInt("grantVer", 0);
}

String buildAdvertisementPayload() {
  return "id=" + deviceId + ";state=" + enrollmentState + ";pv=" + String(kProtocolVersion);
}

void restartAdvertising() {
  BLEAdvertisementData advertisingData;
  const String serviceData = buildAdvertisementPayload();
  advertisingData.setName(bleName.c_str());
  advertisingData.setServiceData(BLEUUID(kServiceUuid), std::string(serviceData.c_str()));

  advertising->stop();
  advertising->setAdvertisementData(advertisingData);
  advertising->start();
}

String buildHelloResponse(const String& requestId) {
  const uint64_t efuseMac = ESP.getEfuseMac();
  lastDeviceNonce = uint64ToString(efuseMac) + "-" + String(static_cast<uint32_t>(esp_random()), HEX);

  return "{"
         "\"ok\":true,"
         "\"command\":\"hello\","
         "\"requestId\":\"" + escapeJson(requestId) + "\","
         "\"deviceId\":\"" + escapeJson(deviceId) + "\","
         "\"bleName\":\"" + escapeJson(bleName) + "\","
         "\"deviceNonce\":\"" + escapeJson(lastDeviceNonce) + "\","
         "\"firmwareVersion\":\"" + escapeJson(kFirmwareVersion) + "\","
         "\"macAddress\":\"" + escapeJson(macAddress) + "\","
         "\"protocolVersion\":" + String(kProtocolVersion) + ","
         "\"state\":\"" + escapeJson(enrollmentState) + "\""
         "}";
}

bool validateGrantClaims(
  const String& payloadJson,
  const String& expectedInstitutionId,
  const String& requiredPermission,
  long long currentEpochMs) {
  if (getJsonString(payloadJson, "iss") != kGrantIssuer) {
    return false;
  }

  if (getJsonString(payloadJson, "kid") != kGrantKeyId) {
    return false;
  }

  if (getJsonString(payloadJson, "deviceId") != deviceId) {
    return false;
  }

  if (!expectedInstitutionId.isEmpty() && getJsonString(payloadJson, "institutionId") != expectedInstitutionId) {
    return false;
  }

  const long long exp = getJsonInt64(payloadJson, "exp", 0);
  if (exp <= currentEpochMs) {
    return false;
  }

  const String permission = getJsonString(payloadJson, "permission");
  if (requiredPermission == "manage") {
    return permission == "manage";
  }
  return permission == "connect" || permission == "manage";
}

bool verifySignedGrant(
  const String& grantToken,
  const String& expectedInstitutionId,
  const String& requiredPermission,
  long long currentEpochMs,
  uint32_t* nextGrantVersion) {
  const int firstDot = grantToken.indexOf('.');
  const int secondDot = grantToken.indexOf('.', firstDot + 1);
  if (firstDot <= 0 || secondDot <= firstDot + 1) {
    return false;
  }

  const String headerSegment = grantToken.substring(0, firstDot);
  const String payloadSegment = grantToken.substring(firstDot + 1, secondDot);
  const String signatureSegment = grantToken.substring(secondDot + 1);
  const String decodedHeader = base64UrlDecode(headerSegment);
  const String decodedPayload = base64UrlDecode(payloadSegment);
  if (decodedHeader.isEmpty() || decodedPayload.isEmpty()) {
    return false;
  }

  if (getJsonString(decodedHeader, "alg") != "ES256" || getJsonString(decodedHeader, "kid") != kGrantKeyId) {
    return false;
  }

  if (!validateGrantClaims(decodedPayload, expectedInstitutionId, requiredPermission, currentEpochMs)) {
    return false;
  }

  uint8_t signatureBytes[64];
  size_t signatureLength = 0;
  if (!base64UrlDecodeBytes(signatureSegment, signatureBytes, sizeof(signatureBytes), &signatureLength) || signatureLength != 64) {
    return false;
  }

  uint8_t digest[32];
  if (mbedtls_sha256_ret(
        reinterpret_cast<const unsigned char*>((headerSegment + "." + payloadSegment).c_str()),
        headerSegment.length() + 1 + payloadSegment.length(),
        digest,
        0) != 0) {
    return false;
  }

  mbedtls_pk_context publicKey;
  mbedtls_pk_init(&publicKey);
  if (mbedtls_pk_parse_public_key(
        &publicKey,
        reinterpret_cast<const unsigned char*>(kGrantVerificationPublicKeyPem),
        strlen(kGrantVerificationPublicKeyPem) + 1) != 0) {
    mbedtls_pk_free(&publicKey);
    return false;
  }

  if (mbedtls_pk_get_type(&publicKey) != MBEDTLS_PK_ECKEY) {
    mbedtls_pk_free(&publicKey);
    return false;
  }

  mbedtls_mpi signatureR;
  mbedtls_mpi signatureS;
  mbedtls_mpi_init(&signatureR);
  mbedtls_mpi_init(&signatureS);
  const int readR = mbedtls_mpi_read_binary(&signatureR, signatureBytes, 32);
  const int readS = mbedtls_mpi_read_binary(&signatureS, signatureBytes + 32, 32);
  const auto* ecKey = mbedtls_pk_ec(publicKey);
  const int verifyResult = (readR == 0 && readS == 0)
    ? mbedtls_ecdsa_verify(&ecKey->grp, digest, sizeof(digest), &ecKey->Q, &signatureR, &signatureS)
    : -1;
  mbedtls_mpi_free(&signatureR);
  mbedtls_mpi_free(&signatureS);
  mbedtls_pk_free(&publicKey);

  if (verifyResult != 0) {
    return false;
  }

  if (nextGrantVersion != nullptr) {
    *nextGrantVersion = static_cast<uint32_t>(getJsonInt64(decodedPayload, "grantVersion", 0));
  }
  return true;
}

bool verifyHandshakeProofWithToken(const String& sessionHandshakeToken, const String& proof, long long timestampMs) {
  if (sessionHandshakeToken.isEmpty() || lastDeviceNonce.isEmpty()) {
    return false;
  }

  if (timestampMs <= 0) {
    return false;
  }

  const String canonical = lastDeviceNonce + "|" + deviceId + "|" + String(timestampMs);
  const String expectedProof = hmacSha256Hex(sessionHandshakeToken, canonical);
  return !expectedProof.isEmpty() && constantTimeEquals(expectedProof, proof);
}

bool verifyHandshakeProof(const String& proof, long long timestampMs) {
  return verifyHandshakeProofWithToken(handshakeToken, proof, timestampMs);
}

bool hasVerifiedSession(const String& requiredPermission) {
  if (static_cast<long>(millis() - verifiedSessionUntilMs) > 0) {
    return false;
  }
  if (requiredPermission == "manage") {
    return lastVerifiedPermission == "manage";
  }
  return lastVerifiedPermission == "connect" || lastVerifiedPermission == "manage";
}

void sendBleResponse(const String& payload) {
  responseCharacteristic->setValue(payload.c_str());
  responseCharacteristic->notify();
  logBlePayload("[BLE] ", payload);
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

bool ensureSoftApStarted() {
  if (accessPointStarted && wifiTicketExpiryMs != 0 && static_cast<long>(millis() - wifiTicketExpiryMs) > 0) {
    webServer.stop();
    WiFi.softAPdisconnect(true);
    accessPointStarted = false;
    wifiTicketExpiryMs = 0;
  }

  if (accessPointStarted) {
    return true;
  }

  wifiSsid = bleName;

  WiFi.mode(WIFI_AP);
  accessPointStarted = WiFi.softAP(wifiSsid.c_str(), wifiPassword.c_str());
  if (!accessPointStarted) {
    return false;
  }

  webServer.stop();
  webServer.on("/api/v1/connection-test", HTTP_GET, []() {
    if (wifiTicketExpiryMs == 0 || static_cast<long>(millis() - wifiTicketExpiryMs) > 0) {
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
                           "\"deviceId\":\"" + escapeJson(deviceId) + "\","
                           "\"firmwareVersion\":\"" + escapeJson(kFirmwareVersion) + "\","
                           "\"macAddress\":\"" + escapeJson(macAddress) + "\","
                           "\"currentTempC\":" + String(temp, 2) + ","
                           "\"batteryLevel\":" + String(batteryLevel) + ","
                           "\"doorOpen\":" + String(doorOpen ? "true" : "false") + ","
                           "\"mktStatus\":\"safe\","
                           "\"statusText\":\"BLE authentication and Wi-Fi handover completed.\","
                           "\"lastSeenAt\":" + uint64ToString(kEpochBaseMs + nowMs) + ","
                           "\"nickname\":\"" + escapeJson(deviceNickname.isEmpty() ? bleName : deviceNickname) + "\","
                           "\"institutionId\":\"" + escapeJson(institutionId) + "\""
                           "}";
    webServer.send(200, "application/json", payload);
  });
  webServer.begin();

  if (kVerboseSecretLogging) {
    Serial.println("[WiFi] SoftAP started: " + wifiSsid + " password=" + wifiPassword);
  } else {
    Serial.println("[WiFi] SoftAP started: " + wifiSsid + " password=<redacted>");
  }
  return true;
}

void handleHello(const String& requestId) {
  sendBleResponse(buildHelloResponse(requestId));
}

void handleEnrollBegin(const String& payload, const String& requestId) {
  if (enrollmentState != "blank") {
    sendBleResponse(buildErrorResponse("enroll.begin", requestId, "DEVICE_ALREADY_ENROLLED", "Device is already enrolled."));
    return;
  }

  const String incomingDeviceId = getJsonString(payload, "deviceId");
  const String incomingBootstrapToken = getJsonString(payload, "bootstrapToken");
  const String incomingInstitutionId = getJsonString(payload, "institutionId");
  const String incomingNickname = getJsonString(payload, "nickname");
  const String incomingHandshakeToken = getJsonString(payload, "handshakeToken");
  const String handshakeProof = getJsonString(payload, "handshakeProof");
  const String grantToken = getJsonString(payload, "grantToken");
  const long long proofTimestamp = getJsonInt64(payload, "proofTimestamp", 0);

  if (incomingDeviceId != deviceId || incomingBootstrapToken != bootstrapToken) {
    sendBleResponse(buildErrorResponse("enroll.begin", requestId, "ENROLLMENT_BOOTSTRAP_INVALID", "Bootstrap token or device id did not match."));
    return;
  }

  if (incomingInstitutionId.isEmpty()) {
    sendBleResponse(buildErrorResponse("enroll.begin", requestId, "INSTITUTION_REQUIRED", "Institution id is required for enrollment."));
    return;
  }

  if (incomingHandshakeToken.isEmpty()) {
    sendBleResponse(buildErrorResponse("enroll.begin", requestId, "HANDSHAKE_TOKEN_REQUIRED", "Handshake token is required for enrollment."));
    return;
  }

  if (!verifyHandshakeProofWithToken(incomingHandshakeToken, handshakeProof, proofTimestamp)) {
    sendBleResponse(buildErrorResponse("enroll.begin", requestId, "HANDSHAKE_PROOF_INVALID", "Handshake proof did not validate."));
    return;
  }

  uint32_t nextGrantVersion = 0;
  if (!verifySignedGrant(grantToken, incomingInstitutionId, "manage", proofTimestamp, &nextGrantVersion)) {
    sendBleResponse(buildErrorResponse("enroll.begin", requestId, "ENROLLMENT_GRANT_INVALID", "Supervisor enrollment grant verification failed."));
    return;
  }

  pendingEnrollment.active = true;
  pendingEnrollment.institutionId = incomingInstitutionId;
  pendingEnrollment.nickname = incomingNickname;
  pendingEnrollment.handshakeToken = incomingHandshakeToken;
  pendingEnrollment.grantVersion = nextGrantVersion;

  sendBleResponse("{"
                  "\"ok\":true,"
                  "\"command\":\"enroll.begin\","
                  "\"requestId\":\"" + escapeJson(requestId) + "\","
                  "\"state\":\"pending\""
                  "}");
}

void handleEnrollCommit(const String& requestId) {
  if (!pendingEnrollment.active) {
    sendBleResponse(buildErrorResponse("enroll.commit", requestId, "NO_PENDING_ENROLLMENT", "Call enroll.begin before enroll.commit."));
    return;
  }

  enrollmentState = "enrolled";
  institutionId = pendingEnrollment.institutionId;
  deviceNickname = pendingEnrollment.nickname;
  handshakeToken = pendingEnrollment.handshakeToken;
  grantVersion = pendingEnrollment.grantVersion;
  pendingEnrollment = PendingEnrollment{};
  writePreferences();
  restartAdvertising();

  sendBleResponse("{"
                  "\"ok\":true,"
                  "\"command\":\"enroll.commit\","
                  "\"requestId\":\"" + escapeJson(requestId) + "\","
                  "\"state\":\"enrolled\","
                  "\"deviceId\":\"" + escapeJson(deviceId) + "\","
                  "\"bleName\":\"" + escapeJson(bleName) + "\""
                  "}");
}

void handleGrantVerify(const String& payload, const String& requestId) {
  if (enrollmentState != "enrolled") {
    sendBleResponse(buildErrorResponse("grant.verify", requestId, "DEVICE_NOT_ENROLLED", "Device must be enrolled before grant verification."));
    return;
  }

  const String incomingDeviceId = getJsonString(payload, "deviceId");
  const String grantToken = getJsonString(payload, "grantToken");
  const String handshakeProof = getJsonString(payload, "handshakeProof");
  const long long proofTimestamp = getJsonInt64(payload, "proofTimestamp", 0);

  if (incomingDeviceId != deviceId) {
    sendBleResponse(buildErrorResponse("grant.verify", requestId, "DEVICE_ID_MISMATCH", "The grant was issued for a different device."));
    return;
  }

  uint32_t nextGrantVersion = 0;
  if (!verifyHandshakeProof(handshakeProof, proofTimestamp)) {
    sendBleResponse(buildErrorResponse("grant.verify", requestId, "HANDSHAKE_PROOF_INVALID", "Handshake proof did not validate."));
    return;
  }

  if (!verifySignedGrant(grantToken, institutionId, "connect", proofTimestamp, &nextGrantVersion)) {
    sendBleResponse(buildErrorResponse("grant.verify", requestId, "GRANT_INVALID", "Signed grant verification failed."));
    return;
  }

  if (nextGrantVersion < grantVersion) {
    sendBleResponse(buildErrorResponse("grant.verify", requestId, "GRANT_VERSION_STALE", "Grant version is older than the enrolled version."));
    return;
  }

  grantVersion = nextGrantVersion;
  verifiedSessionUntilMs = millis() + kVerifiedSessionWindowMs;
  lastVerifiedPermission = "connect";
  writePreferences();

  sendBleResponse("{"
                  "\"ok\":true,"
                  "\"command\":\"grant.verify\","
                  "\"requestId\":\"" + escapeJson(requestId) + "\","
                  "\"verifiedUntilMs\":" + uint64ToString(kEpochBaseMs + verifiedSessionUntilMs)
                  + "}");
}

void handleWifiTicketRequest(const String& requestId) {
  if (!hasVerifiedSession("connect")) {
    sendBleResponse(buildErrorResponse("wifi.ticket.request", requestId, "AUTH_REQUIRED", "Verify the BLE grant before requesting Wi-Fi handover."));
    return;
  }

  if (!ensureSoftApStarted()) {
    sendBleResponse(buildErrorResponse("wifi.ticket.request", requestId, "SOFTAP_START_FAILED", "ESP32 could not start its Wi-Fi access point."));
    return;
  }

  wifiTicketExpiryMs = millis() + 60000UL;

  sendBleResponse("{"
                  "\"ok\":true,"
                  "\"command\":\"wifi.ticket.request\","
                  "\"requestId\":\"" + escapeJson(requestId) + "\","
                  "\"ssid\":\"" + escapeJson(wifiSsid) + "\","
                  "\"password\":\"" + escapeJson(wifiPassword) + "\","
                  "\"testUrl\":\"http://192.168.4.1/api/v1/connection-test\","
                  "\"expiresAt\":" + uint64ToString(kEpochBaseMs + wifiTicketExpiryMs)
                  + "}");
}

void handleDecommission(const String& payload, const String& requestId) {
  if (enrollmentState != "enrolled") {
    sendBleResponse(buildErrorResponse("device.decommission", requestId, "DEVICE_NOT_ENROLLED", "Device is already blank."));
    return;
  }

  const String grantToken = getJsonString(payload, "grantToken");
  const String handshakeProof = getJsonString(payload, "handshakeProof");
  const long long proofTimestamp = getJsonInt64(payload, "proofTimestamp", 0);

  uint32_t nextGrantVersion = 0;
  if (!verifyHandshakeProof(handshakeProof, proofTimestamp)) {
    sendBleResponse(buildErrorResponse("device.decommission", requestId, "HANDSHAKE_PROOF_INVALID", "Handshake proof did not validate."));
    return;
  }

  if (!verifySignedGrant(grantToken, institutionId, "manage", proofTimestamp, &nextGrantVersion)) {
    sendBleResponse(buildErrorResponse("device.decommission", requestId, "GRANT_INVALID", "Supervisor decommission grant verification failed."));
    return;
  }

  if (nextGrantVersion <= grantVersion) {
    sendBleResponse(buildErrorResponse("device.decommission", requestId, "GRANT_STALE", "Supervisor grant is stale or rotated."));
    return;
  }

  resetEnrollment();
  restartAdvertising();

  sendBleResponse("{"
                  "\"ok\":true,"
                  "\"command\":\"device.decommission\","
                  "\"requestId\":\"" + escapeJson(requestId) + "\","
                  "\"state\":\"blank\""
                  "}");
}

void dispatchCommand(const String& payload) {
  const String requestId = getJsonString(payload, "requestId");

  if (hasCommand(payload, "hello")) {
    handleHello(requestId);
    return;
  }
  if (hasCommand(payload, "enroll.begin")) {
    handleEnrollBegin(payload, requestId);
    return;
  }
  if (hasCommand(payload, "enroll.commit")) {
    handleEnrollCommit(requestId);
    return;
  }
  if (hasCommand(payload, "grant.verify")) {
    handleGrantVerify(payload, requestId);
    return;
  }
  if (hasCommand(payload, "wifi.ticket.request")) {
    handleWifiTicketRequest(requestId);
    return;
  }
  if (hasCommand(payload, "device.decommission")) {
    handleDecommission(payload, requestId);
    return;
  }

  sendBleResponse(buildErrorResponse("unknown", requestId, "UNKNOWN_COMMAND", "Command not recognized by the transport harness."));
}

class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    const std::string rawValue = characteristic->getValue();
    if (rawValue.empty()) {
      return;
    }

    const String payload(rawValue.c_str());
    logBlePayload("[BLE] ", payload);
    dispatchCommand(payload);
  }
};

void initializeBle() {
  BLEDevice::init(bleName.c_str());
  bleServer = BLEDevice::createServer();
  BLEService* service = bleServer->createService(kServiceUuid);

  commandCharacteristic = service->createCharacteristic(
    kCommandCharacteristicUuid,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  commandCharacteristic->setCallbacks(new CommandCallbacks());

  responseCharacteristic = service->createCharacteristic(
    kResponseCharacteristicUuid,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ);
  responseCharacteristic->addDescriptor(new BLE2902());

  service->start();
  advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(kServiceUuid);
  restartAdvertising();
}

}  // namespace

void setup() {
  Serial.begin(115200);
  loadPreferences();
  initializeBle();

  Serial.println("ColdGuard ESP32 transport harness ready");
  Serial.println("Device ID: " + deviceId);
  logSecretValue("Bootstrap Token: ", bootstrapToken);
  Serial.println("BLE Name: " + bleName);
  Serial.println("MAC: " + macAddress);
}

void loop() {
  if (accessPointStarted) {
    webServer.handleClient();
  }
  delay(20);
}
