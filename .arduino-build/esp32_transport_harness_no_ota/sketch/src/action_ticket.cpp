#line 1 "C:\\Users\\Kevin\\Projects\\LabVIEW\\ColdGuard\\firmware\\esp32_transport_harness\\src\\action_ticket.cpp"
#include "action_ticket.h"

#include <cctype>
#include <cstdlib>
#include <cstring>
#include <mbedtls/md.h>

namespace coldguard {

namespace {

void debugActionTicket(const String& message) {
  Serial.println("[ACTION_TICKET] " + message);
}

bool hmacSha256Bytes(
  const uint8_t* key,
  size_t keyLength,
  const uint8_t* payload,
  size_t payloadLength,
  uint8_t output[32]) {
  const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (info == nullptr) {
    return false;
  }

  return mbedtls_md_hmac(info, key, keyLength, payload, payloadLength, output) == 0;
}

String hmacSha256HexWithBinaryKey(const uint8_t* key, size_t keyLength, const String& payload) {
  uint8_t hmac[32];
  if (!hmacSha256Bytes(
        key,
        keyLength,
        reinterpret_cast<const uint8_t*>(payload.c_str()),
        payload.length(),
        hmac)) {
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

bool deriveActionTicketKey(const String& deviceId, const char* actionTicketMasterKey, uint8_t output[32]) {
  return hmacSha256Bytes(
    reinterpret_cast<const uint8_t*>(actionTicketMasterKey),
    std::strlen(actionTicketMasterKey),
    reinterpret_cast<const uint8_t*>(deviceId.c_str()),
    deviceId.length(),
    output);
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

bool isProofTimestampFresh(const DeviceState& state, long long timestampMs, unsigned long proofWindowMs) {
  if (timestampMs <= 0) {
    return false;
  }

  const uint64_t trustedNowMs = currentDeviceTimeMs();
  const uint64_t providedTimestampMs = static_cast<uint64_t>(timestampMs);
  const uint64_t deviceDeltaMs = providedTimestampMs > trustedNowMs
    ? providedTimestampMs - trustedNowMs
    : trustedNowMs - providedTimestampMs;
  if (deviceDeltaMs > static_cast<uint64_t>(proofWindowMs)) {
    return false;
  }

  if (state.lastDeviceNonceIssuedAtMs == 0) {
    return false;
  }

  const uint64_t nonceAgeMs = trustedNowMs - state.lastDeviceNonceIssuedAtMs;
  return nonceAgeMs <= static_cast<uint64_t>(proofWindowMs);
}

String buildActionTicketCanonicalString(
  const String& ticketId,
  const String& ticketDeviceId,
  const String& institutionId,
  const String& action,
  long long issuedAt,
  long long expiresAt,
  long long counter,
  const String& operatorId) {
  return "1|" + ticketId + "|"
         + ticketDeviceId + "|"
         + institutionId + "|"
         + action + "|"
         + String(issuedAt) + "|"
         + String(expiresAt) + "|"
         + String(counter) + "|"
         + operatorId;
}

}  // namespace

String hmacSha256Hex(const String& key, const String& payload) {
  uint8_t hmac[32];
  if (!hmacSha256Bytes(
        reinterpret_cast<const uint8_t*>(key.c_str()),
        key.length(),
        reinterpret_cast<const uint8_t*>(payload.c_str()),
        payload.length(),
        hmac)) {
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

bool verifyActionTicket(
  const String& actionTicketJson,
  const DeviceState& state,
  const String& expectedInstitutionId,
  const String& expectedAction,
  long long proofTimestampMs,
  unsigned long proofWindowMs,
  const char* actionTicketMasterKey,
  uint32_t* nextGrantVersion) {
  if (!isProofTimestampFresh(state, proofTimestampMs, proofWindowMs)) {
    debugActionTicket("proof timestamp rejected");
    return false;
  }

  if (actionTicketJson.isEmpty()) {
    debugActionTicket("missing actionTicket object");
    return false;
  }

  const String ticketId = getJsonString(actionTicketJson, "ticketId");
  const String ticketDeviceId = getJsonString(actionTicketJson, "deviceId");
  const String institutionIdClaim = getJsonString(actionTicketJson, "institutionId");
  const String action = getJsonString(actionTicketJson, "action");
  const long long issuedAt = getJsonInt64(actionTicketJson, "issuedAt", 0);
  const long long expiresAt = getJsonInt64(actionTicketJson, "expiresAt", 0);
  const long long counter = getJsonInt64(actionTicketJson, "counter", 0);
  const String operatorId = getJsonString(actionTicketJson, "operatorId");
  const String providedMac = getJsonString(actionTicketJson, "mac");
  const long long version = getJsonInt64(actionTicketJson, "v", 0);

  if (version != 1 || ticketId.isEmpty() || ticketDeviceId != state.deviceId || institutionIdClaim != expectedInstitutionId) {
    debugActionTicket(
      "header mismatch"
      " v=" + String(version) +
      " ticketIdEmpty=" + String(ticketId.isEmpty() ? "true" : "false") +
      " ticketDeviceId=" + ticketDeviceId +
      " expectedDeviceId=" + state.deviceId +
      " institutionId=" + institutionIdClaim +
      " expectedInstitutionId=" + expectedInstitutionId);
    return false;
  }
  if (action != expectedAction || issuedAt <= 0 || expiresAt <= 0 || counter <= 0 || providedMac.isEmpty()) {
    debugActionTicket(
      "field validation failed"
      " action=" + action +
      " expectedAction=" + expectedAction +
      " issuedAt=" + String(issuedAt) +
      " expiresAt=" + String(expiresAt) +
      " counter=" + String(counter) +
      " macEmpty=" + String(providedMac.isEmpty() ? "true" : "false"));
    return false;
  }

  if (expiresAt <= issuedAt) {
    debugActionTicket("ticket ordering invalid");
    return false;
  }

  const uint64_t trustedNowMs = currentDeviceTimeMs();
  if (static_cast<uint64_t>(expiresAt) <= trustedNowMs) {
    debugActionTicket(
      "ticket expired"
      " expiresAt=" + String(expiresAt) +
      " nowMs=" + uint64ToString(trustedNowMs));
    return false;
  }

  uint8_t derivedKey[32];
  if (!deriveActionTicketKey(ticketDeviceId, actionTicketMasterKey, derivedKey)) {
    debugActionTicket("failed to derive device action key");
    return false;
  }

  const String canonical = buildActionTicketCanonicalString(
    ticketId,
    ticketDeviceId,
    institutionIdClaim,
    action,
    issuedAt,
    expiresAt,
    counter,
    operatorId);
  const String expectedMac = hmacSha256HexWithBinaryKey(derivedKey, sizeof(derivedKey), canonical);
  if (expectedMac.isEmpty() || !constantTimeEquals(expectedMac, providedMac)) {
    debugActionTicket(
      "mac mismatch"
      " canonical=" + canonical +
      " providedMac=" + providedMac);
    return false;
  }

  if (nextGrantVersion != nullptr) {
    *nextGrantVersion = static_cast<uint32_t>(counter);
  }
  debugActionTicket("verification passed");
  return true;
}

bool verifyHandshakeProofWithToken(
  const String& sessionHandshakeToken,
  const DeviceState& state,
  const String& proof,
  long long timestampMs,
  unsigned long proofWindowMs) {
  if (sessionHandshakeToken.isEmpty() || state.lastDeviceNonce.isEmpty()) {
    return false;
  }

  if (!isProofTimestampFresh(state, timestampMs, proofWindowMs)) {
    return false;
  }

  const String canonical = state.lastDeviceNonce + "|" + state.deviceId + "|" + String(timestampMs);
  const String expectedProof = hmacSha256Hex(sessionHandshakeToken, canonical);
  return !expectedProof.isEmpty() && constantTimeEquals(expectedProof, proof);
}

bool verifyHandshakeProof(
  const DeviceState& state,
  const String& proof,
  long long timestampMs,
  unsigned long proofWindowMs) {
  return verifyHandshakeProofWithToken(state.handshakeToken, state, proof, timestampMs, proofWindowMs);
}

}  // namespace coldguard
