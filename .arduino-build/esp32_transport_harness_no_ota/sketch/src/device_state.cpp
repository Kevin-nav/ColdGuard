#line 1 "C:\\Users\\Kevin\\Projects\\LabVIEW\\ColdGuard\\firmware\\esp32_transport_harness\\src\\device_state.cpp"
#include "device_state.h"

#include <cctype>
#include <cstdio>
#include <esp_timer.h>

namespace coldguard {

namespace {

void appendJsonUnicodeEscape(String& escaped, uint8_t value) {
  constexpr char kHexDigits[] = "0123456789ABCDEF";
  escaped += "\\u00";
  escaped += kHexDigits[(value >> 4) & 0x0F];
  escaped += kHexDigits[value & 0x0F];
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

}  // namespace

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

String buildEnrollmentLink(const DeviceState& state) {
  return "https://coldguard.org/device/" + state.deviceId +
         "?claim=" + state.bootstrapToken + "&v=1";
}

String escapeJson(const String& value) {
  String escaped;
  escaped.reserve(value.length() * 6);
  for (size_t index = 0; index < value.length(); index++) {
    const uint8_t current = static_cast<uint8_t>(value.charAt(index));
    switch (current) {
      case '"':
        escaped += "\\\"";
        break;
      case '\\':
        escaped += "\\\\";
        break;
      case '/':
        escaped += "\\/";
        break;
      case '\b':
        escaped += "\\b";
        break;
      case '\f':
        escaped += "\\f";
        break;
      case '\n':
        escaped += "\\n";
        break;
      case '\r':
        escaped += "\\r";
        break;
      case '\t':
        escaped += "\\t";
        break;
      default:
        if (current < 0x20 || std::isprint(current) == 0) {
          appendJsonUnicodeEscape(escaped, current);
        } else {
          escaped += static_cast<char>(current);
        }
        break;
    }
  }
  return escaped;
}

String uint64ToString(uint64_t value) {
  char buffer[24];
  std::snprintf(buffer, sizeof(buffer), "%llu", static_cast<unsigned long long>(value));
  return String(buffer);
}

String observableEnrollmentState(const DeviceState& state) {
  return state.pendingEnrollment.active ? "pending" : state.enrollmentState;
}

uint64_t currentDeviceTimeMs() {
  return static_cast<uint64_t>(esp_timer_get_time() / 1000ULL);
}

String buildAdvertisementPayload(const DeviceState& state, uint8_t protocolVersion) {
  return "id=" + state.deviceId + ";state=" + observableEnrollmentState(state) + ";pv=" + String(protocolVersion);
}

void loadDeviceState(Preferences& preferences, const char* preferencesNamespace, DeviceState* state) {
  preferences.begin(preferencesNamespace, false);

  const uint64_t efuseMac = ESP.getEfuseMac();
  state->macAddress = formatMacAddress(efuseMac);
  state->deviceId = preferences.getString("deviceId", buildDeviceId(efuseMac));
  state->bleName = "ColdGuard_" + state->deviceId.substring(state->deviceId.length() - 4);
  state->bootstrapToken = preferences.getString("bootstrap", "");
  if (state->bootstrapToken.isEmpty()) {
    state->bootstrapToken = generateBootstrapToken();
    preferences.putString("bootstrap", state->bootstrapToken);
  }
  state->wifiPassword = preferences.getString("wifi_pw", "");
  if (state->wifiPassword.length() < 8) {
    state->wifiPassword = generateWifiPassword();
    preferences.putString("wifi_pw", state->wifiPassword);
  }
  state->facilityWifiSsid = preferences.getString("fac_wifi_ssid", "");
  state->facilityWifiPassword = preferences.getString("fac_wifi_pw", "");
  state->enrollmentState = preferences.getString("state", "blank");
  state->institutionId = preferences.getString("institution", "");
  state->deviceNickname = preferences.getString("nickname", "");
  state->handshakeToken = preferences.getString("handshake", "");
  state->grantVersion = preferences.getUInt("grantVer", 0);
}

void saveDeviceState(Preferences& preferences, const DeviceState& state) {
  preferences.putString("deviceId", state.deviceId);
  preferences.putString("bootstrap", state.bootstrapToken);
  preferences.putString("wifi_pw", state.wifiPassword);
  preferences.putString("fac_wifi_ssid", state.facilityWifiSsid);
  preferences.putString("fac_wifi_pw", state.facilityWifiPassword);
  preferences.putString("state", state.enrollmentState);
  preferences.putString("institution", state.institutionId);
  preferences.putString("nickname", state.deviceNickname);
  preferences.putString("handshake", state.handshakeToken);
  preferences.putUInt("grantVer", state.grantVersion);
}

void clearEnrollmentState(DeviceState* state) {
  state->enrollmentState = "blank";
  state->institutionId = "";
  state->deviceNickname = "";
  state->handshakeToken = "";
  state->grantVersion = 0;
  state->pendingEnrollment = PendingEnrollment{};
  state->verifiedSessionUntilMs = 0;
  state->wifiTicketExpiryMs = 0;
  state->lastHeartbeatAtMs = 0;
  state->lastStationConnectAttemptMs = 0;
  state->lastVerifiedPermission = "";
  state->facilityWifiSsid = "";
  state->facilityWifiPassword = "";
  state->runtimeServerStarted = false;
  state->stationConnected = false;
  state->bootstrapToken = generateBootstrapToken();
}

}  // namespace coldguard
