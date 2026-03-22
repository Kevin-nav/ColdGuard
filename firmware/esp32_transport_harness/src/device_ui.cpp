#include "device_ui.h"

#include <LiquidCrystal_I2C.h>
#include <Wire.h>
#include <WiFi.h>

#include "ble_recovery.h"
#include "wifi_runtime.h"

namespace coldguard {

namespace {

constexpr unsigned long kTransientMessageMs = 2500UL;
constexpr bool kBuiltInLedActiveHigh = true;

enum class UiMode {
  Runtime,
  Menu,
  Status,
  PairingCode,
  WifiTools,
  Diagnostics,
};

enum class MenuItem {
  Status,
  NewEnrollment,
  ShowPairingCode,
  WifiTools,
  Diagnostics,
  FactoryReset,
  Exit,
};

enum class LedMode {
  Runtime,
  Menu,
  EnrollmentReady,
  PendingActivity,
  Error,
};

enum class LedOverlayType {
  None,
  EnrollmentGenerated,
  FacilityWifiCleared,
  FactoryReset,
  ErrorRecorded,
};

struct LedOverlayState {
  LedOverlayType type = LedOverlayType::None;
  unsigned long startedAtMs = 0;
  unsigned long durationMs = 0;
};

DeviceUiConfig gConfig = {
  T0,
  2,
  0x27,
  16,
  2,
  0.40f,
  200UL,
  700UL,
  "",
  1,
  "",
};
LiquidCrystal_I2C* gDisplay = nullptr;
UiMode gMode = UiMode::Runtime;
size_t gMenuIndex = 0;
size_t gDetailPage = 0;
unsigned long gTransientUntilMs = 0;
String gTransientMessage;
uint16_t gTouchBaseline = 0;
uint16_t gTouchThreshold = 0;
bool gTouchStableActive = false;
bool gTouchRawActive = false;
bool gTouchLongPressHandled = false;
unsigned long gTouchStateChangedAtMs = 0;
unsigned long gTouchStartedAtMs = 0;
LedOverlayState gLedOverlay;
bool gLastLedOutput = false;
bool gHasLoggedLedMode = false;
LedMode gLastLoggedLedMode = LedMode::Runtime;
String gLastObservedErrorCode;

const MenuItem kMenuItems[] = {
  MenuItem::Status,
  MenuItem::NewEnrollment,
  MenuItem::ShowPairingCode,
  MenuItem::WifiTools,
  MenuItem::Diagnostics,
  MenuItem::FactoryReset,
  MenuItem::Exit,
};

constexpr size_t kMenuItemCount = sizeof(kMenuItems) / sizeof(kMenuItems[0]);

String enrollmentLabel(const DeviceState& state) {
  if (state.pendingEnrollment.active) {
    return "pending";
  }
  if (state.enrollmentState == "enrolled") {
    return "enrolled";
  }
  return state.enrollmentReady ? "ready" : "blank";
}

String currentTransportLabel(const DeviceState& state) {
  if (state.stationConnected) {
    return "facility";
  }
  if (state.accessPointStarted) {
    return "softap";
  }
  return "ble";
}

String menuLabel(MenuItem item) {
  switch (item) {
    case MenuItem::Status:
      return "Status";
    case MenuItem::NewEnrollment:
      return "New enroll";
    case MenuItem::ShowPairingCode:
      return "Pair code";
    case MenuItem::WifiTools:
      return "WiFi tools";
    case MenuItem::Diagnostics:
      return "Diagnostics";
    case MenuItem::FactoryReset:
      return "Factory reset";
    case MenuItem::Exit:
      return "Exit";
  }

  return "Menu";
}

const char* uiModeLabel(UiMode mode) {
  switch (mode) {
    case UiMode::Runtime:
      return "runtime";
    case UiMode::Menu:
      return "menu";
    case UiMode::Status:
      return "status";
    case UiMode::PairingCode:
      return "pairing";
    case UiMode::WifiTools:
      return "wifi-tools";
    case UiMode::Diagnostics:
      return "diagnostics";
  }

  return "runtime";
}

const char* ledModeLabel(LedMode mode) {
  switch (mode) {
    case LedMode::Runtime:
      return "runtime-normal";
    case LedMode::Menu:
      return "menu-open";
    case LedMode::EnrollmentReady:
      return "enrollment-ready";
    case LedMode::PendingActivity:
      return "pending-activity";
    case LedMode::Error:
      return "error-present";
  }

  return "runtime-normal";
}

void logUiEvent(const String& message) {
  Serial.println(String("[UI] ") + message);
}

void setUiMode(UiMode mode) {
  if (gMode == mode) {
    return;
  }

  gMode = mode;
  logUiEvent(String("Mode -> ") + uiModeLabel(mode));
}

String padToWidth(const String& value) {
  String padded = value;
  if (padded.length() >= gConfig.lcdColumns) {
    return padded.substring(0, gConfig.lcdColumns);
  }

  while (padded.length() < gConfig.lcdColumns) {
    padded += " ";
  }
  return padded;
}

String scrollLine(const String& value, unsigned long nowMs) {
  if (value.length() <= gConfig.lcdColumns) {
    return padToWidth(value);
  }

  const String padded = value + "   ";
  const size_t windowStart = (nowMs / 450UL) % padded.length();
  String window;
  for (size_t index = 0; index < gConfig.lcdColumns; index++) {
    window += padded.charAt((windowStart + index) % padded.length());
  }
  return window;
}

void renderLines(const String& rawLine1, const String& rawLine2) {
  if (gDisplay == nullptr) {
    return;
  }

  const unsigned long nowMs = millis();
  const String line1 = scrollLine(rawLine1, nowMs);
  const String line2 = scrollLine(rawLine2, nowMs);

  gDisplay->setCursor(0, 0);
  gDisplay->print(line1);
  gDisplay->setCursor(0, 1);
  gDisplay->print(line2);
}

void showTransientMessage(const String& message) {
  gTransientMessage = message;
  gTransientUntilMs = millis() + kTransientMessageMs;
}

void triggerLedOverlay(LedOverlayType type, unsigned long durationMs) {
  gLedOverlay.type = type;
  gLedOverlay.startedAtMs = millis();
  gLedOverlay.durationMs = durationMs;
}

void setLedOutput(bool on) {
  gLastLedOutput = on;
  digitalWrite(gConfig.ledPin, on == kBuiltInLedActiveHigh ? HIGH : LOW);
}

bool pulseWindow(unsigned long phaseMs, unsigned long startMs, unsigned long endMs) {
  return phaseMs >= startMs && phaseMs < endMs;
}

bool overlayPatternActive(LedOverlayType type, unsigned long nowMs) {
  const unsigned long phaseMs = nowMs - gLedOverlay.startedAtMs;
  switch (type) {
    case LedOverlayType::EnrollmentGenerated:
      return pulseWindow(phaseMs, 0UL, 120UL) ||
             pulseWindow(phaseMs, 180UL, 300UL) ||
             pulseWindow(phaseMs, 360UL, 480UL);
    case LedOverlayType::FacilityWifiCleared:
      return pulseWindow(phaseMs % 400UL, 0UL, 200UL);
    case LedOverlayType::FactoryReset:
      return pulseWindow(phaseMs, 0UL, 120UL) ||
             pulseWindow(phaseMs, 240UL, 360UL) ||
             pulseWindow(phaseMs, 480UL, 600UL) ||
             pulseWindow(phaseMs, 720UL, 840UL);
    case LedOverlayType::ErrorRecorded:
      return pulseWindow(phaseMs % 240UL, 0UL, 120UL);
    case LedOverlayType::None:
      return false;
  }

  return false;
}

LedMode determineLedMode(const DeviceState& state) {
  if (!state.lastErrorCode.isEmpty()) {
    return LedMode::Error;
  }
  if (gMode == UiMode::Menu) {
    return LedMode::Menu;
  }
  if (state.pendingEnrollment.active ||
      (!state.facilityWifiSsid.isEmpty() && !state.stationConnected)) {
    return LedMode::PendingActivity;
  }
  if (state.enrollmentReady) {
    return LedMode::EnrollmentReady;
  }
  return LedMode::Runtime;
}

bool continuousPatternActive(LedMode mode, unsigned long nowMs) {
  switch (mode) {
    case LedMode::Runtime: {
      const unsigned long phaseMs = nowMs % 1200UL;
      return pulseWindow(phaseMs, 0UL, 90UL) || pulseWindow(phaseMs, 220UL, 280UL);
    }
    case LedMode::Menu:
      return true;
    case LedMode::EnrollmentReady: {
      const unsigned long phaseMs = nowMs % 1000UL;
      return pulseWindow(phaseMs, 0UL, 100UL) || pulseWindow(phaseMs, 180UL, 280UL);
    }
    case LedMode::PendingActivity: {
      const unsigned long phaseMs = nowMs % 450UL;
      return pulseWindow(phaseMs, 0UL, 180UL);
    }
    case LedMode::Error: {
      const unsigned long phaseMs = nowMs % 1000UL;
      return pulseWindow(phaseMs, 0UL, 90UL) ||
             pulseWindow(phaseMs, 180UL, 270UL) ||
             pulseWindow(phaseMs, 360UL, 450UL);
    }
  }

  return false;
}

void renderLed(const DeviceState& state) {
  const unsigned long nowMs = millis();
  if (gLedOverlay.type != LedOverlayType::None &&
      nowMs - gLedOverlay.startedAtMs >= gLedOverlay.durationMs) {
    gLedOverlay = LedOverlayState{};
  }

  const LedMode ledMode = determineLedMode(state);
  if (!gHasLoggedLedMode || gLastLoggedLedMode != ledMode) {
    gHasLoggedLedMode = true;
    gLastLoggedLedMode = ledMode;
    logUiEvent(String("Mode signal -> ") + ledModeLabel(ledMode));
  }

  bool ledOn = continuousPatternActive(ledMode, nowMs);
  if (gLedOverlay.type != LedOverlayType::None) {
    ledOn = overlayPatternActive(gLedOverlay.type, nowMs);
  }

  if (ledOn != gLastLedOutput) {
    setLedOutput(ledOn);
  }
}

void openMenu() {
  gMenuIndex = 0;
  gDetailPage = 0;
  setUiMode(UiMode::Menu);
  logUiEvent("Menu opened");
}

void renderRuntimeScreen(const DeviceState& state) {
  const String title = state.deviceNickname.isEmpty() ? state.bleName : state.deviceNickname;
  renderLines(title, "State:" + enrollmentLabel(state) + " " + currentTransportLabel(state));
}

void renderMenuScreen() {
  const MenuItem current = kMenuItems[gMenuIndex];
  const MenuItem next = kMenuItems[(gMenuIndex + 1) % kMenuItemCount];
  renderLines(">" + menuLabel(current), " " + menuLabel(next));
}

void renderStatusScreen(const DeviceState& state) {
  switch (gDetailPage % 2) {
    case 0:
      renderLines("State:" + enrollmentLabel(state), "Trans:" + currentTransportLabel(state));
      break;
    default:
      renderLines(
        "SoftAP:" + String(state.accessPointStarted ? "up" : "down"),
        "WiFi:" + String(state.stationConnected ? "up" : "down"));
      break;
  }
}

void renderPairingCodeScreen(const DeviceState& state) {
  if (!state.enrollmentReady) {
    renderLines("Pairing disabled", "New enroll first");
    return;
  }

  switch (gDetailPage % 3) {
    case 0:
      renderLines("Enroll ready", "ID:" + state.deviceId);
      break;
    case 1:
      renderLines("Claim", state.bootstrapToken);
      break;
    default:
      renderLines("Link", buildEnrollmentLink(state));
      break;
  }
}

void renderWifiToolsScreen(const DeviceState& state) {
  switch (gDetailPage % 2) {
    case 0:
      renderLines(
        "Facility SSID",
        state.facilityWifiSsid.isEmpty() ? "not set" : state.facilityWifiSsid);
      break;
    default:
      renderLines(
        "Long:clear WiFi",
        "SoftAP:" + String(state.accessPointStarted ? "up" : "down"));
      break;
  }
}

void renderDiagnosticsScreen(const DeviceState& state) {
  switch (gDetailPage % 3) {
    case 0:
      renderLines(state.deviceId, "FW:" + String(gConfig.firmwareVersion));
      break;
    case 1:
      renderLines("Err", state.lastErrorCode.isEmpty() ? "none" : state.lastErrorCode);
      break;
    default:
      renderLines("BLE:" + state.bleName, "Mode:" + enrollmentLabel(state));
      break;
  }
}

void clearFacilityWifi(
  DeviceState* state,
  Preferences& preferences) {
  state->facilityWifiSsid = "";
  state->facilityWifiPassword = "";
  state->stationConnected = false;
  state->lastStationConnectAttemptMs = 0;
  state->lastErrorCode = "";
  WiFi.disconnect(false, false);
  saveDeviceState(preferences, *state);
}

void logNewEnrollment(const DeviceState& state) {
  logUiEvent("New enrollment generated");
  Serial.println(String("[UI] Device ID: ") + state.deviceId);
  Serial.println(String("[UI] Bootstrap Token: ") + state.bootstrapToken);
  Serial.println(String("[UI] Enrollment Link: ") + buildEnrollmentLink(state));
}

void performMenuAction(
  MenuItem item,
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising) {
  logUiEvent(String("Selected menu item: ") + menuLabel(item));

  switch (item) {
    case MenuItem::Status:
      gDetailPage = 0;
      setUiMode(UiMode::Status);
      return;
    case MenuItem::NewEnrollment:
      prepareNewEnrollment(state);
      saveDeviceState(preferences, *state);
      restartAdvertising(advertising, *state, gConfig.serviceUuid, gConfig.protocolVersion);
      logNewEnrollment(*state);
      triggerLedOverlay(LedOverlayType::EnrollmentGenerated, 1200UL);
      showTransientMessage("New enroll ready");
      gDetailPage = 0;
      setUiMode(UiMode::PairingCode);
      return;
    case MenuItem::ShowPairingCode:
      logUiEvent("Pairing code viewed");
      gDetailPage = 0;
      setUiMode(UiMode::PairingCode);
      return;
    case MenuItem::WifiTools:
      gDetailPage = 0;
      setUiMode(UiMode::WifiTools);
      return;
    case MenuItem::FactoryReset:
      stopSoftAp(webServer, state);
      WiFi.disconnect(false, false);
      clearEnrollmentState(state);
      saveDeviceState(preferences, *state);
      restartAdvertising(advertising, *state, gConfig.serviceUuid, gConfig.protocolVersion);
      logUiEvent("Factory reset");
      triggerLedOverlay(LedOverlayType::FactoryReset, 1400UL);
      showTransientMessage("Factory reset");
      setUiMode(UiMode::Runtime);
      return;
    case MenuItem::Diagnostics:
      gDetailPage = 0;
      setUiMode(UiMode::Diagnostics);
      return;
    case MenuItem::Exit:
      setUiMode(UiMode::Runtime);
      return;
  }
}

void handleShortPress() {
  if (gMode == UiMode::Runtime) {
    return;
  }

  if (gMode == UiMode::Menu) {
    gMenuIndex = (gMenuIndex + 1) % kMenuItemCount;
    return;
  }

  gDetailPage += 1;
}

void handleLongPress(
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising) {
  if (gMode == UiMode::Runtime) {
    openMenu();
    return;
  }

  if (gMode == UiMode::Menu) {
    performMenuAction(kMenuItems[gMenuIndex], state, preferences, webServer, advertising);
    return;
  }

  if (gMode == UiMode::WifiTools) {
    clearFacilityWifi(state, preferences);
    logUiEvent("Facility Wi-Fi cleared");
    triggerLedOverlay(LedOverlayType::FacilityWifiCleared, 1200UL);
    showTransientMessage("Facility WiFi clr");
    gDetailPage = 0;
    setUiMode(UiMode::WifiTools);
    return;
  }

  openMenu();
}

bool sampleTouchActive() {
  return touchRead(gConfig.touchPin) < gTouchThreshold;
}

void processTouch(
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising) {
  const unsigned long nowMs = millis();
  const bool rawActive = sampleTouchActive();

  if (rawActive != gTouchRawActive) {
    gTouchRawActive = rawActive;
    gTouchStateChangedAtMs = nowMs;
  }

  if (nowMs - gTouchStateChangedAtMs < gConfig.touchDebounceMs) {
    return;
  }

  if (rawActive != gTouchStableActive) {
    gTouchStableActive = rawActive;
    if (rawActive) {
      gTouchStartedAtMs = nowMs;
      gTouchLongPressHandled = false;
      return;
    }

    if (!gTouchLongPressHandled) {
      handleShortPress();
    }
    return;
  }

  if (gTouchStableActive &&
      !gTouchLongPressHandled &&
      nowMs - gTouchStartedAtMs >= gConfig.longPressMs) {
    gTouchLongPressHandled = true;
    handleLongPress(state, preferences, webServer, advertising);
  }
}

void maybeTrackErrorOverlay(const DeviceState& state) {
  if (state.lastErrorCode.isEmpty()) {
    gLastObservedErrorCode = "";
    return;
  }

  if (state.lastErrorCode == gLastObservedErrorCode) {
    return;
  }

  gLastObservedErrorCode = state.lastErrorCode;
  logUiEvent(String("Runtime error recorded: ") + state.lastErrorCode);
  triggerLedOverlay(LedOverlayType::ErrorRecorded, 1500UL);
}

void renderUi(const DeviceState& state) {
  if (gTransientUntilMs > millis()) {
    renderLines("ColdGuard", gTransientMessage);
    return;
  }

  switch (gMode) {
    case UiMode::Runtime:
      renderRuntimeScreen(state);
      return;
    case UiMode::Menu:
      renderMenuScreen();
      return;
    case UiMode::Status:
      renderStatusScreen(state);
      return;
    case UiMode::PairingCode:
      renderPairingCodeScreen(state);
      return;
    case UiMode::WifiTools:
      renderWifiToolsScreen(state);
      return;
    case UiMode::Diagnostics:
      renderDiagnosticsScreen(state);
      return;
  }
}

uint16_t calibrateTouchBaseline(uint8_t touchPin) {
  uint32_t total = 0;
  constexpr size_t kSamples = 12;
  for (size_t index = 0; index < kSamples; index++) {
    total += touchRead(touchPin);
  }
  return static_cast<uint16_t>(total / kSamples);
}

uint16_t deriveTouchThreshold(uint16_t baseline, float factor) {
  if (factor <= 0.0f) {
    factor = 0.40f;
  } else if (factor >= 1.0f) {
    factor = 0.95f;
  }

  if (baseline == 0) {
    return 1;
  }

  uint16_t threshold = static_cast<uint16_t>(baseline * factor);
  if (threshold == 0) {
    threshold = 1;
  }
  if (threshold >= baseline && baseline > 0) {
    threshold = baseline - 1;
  }
  if (threshold == 0) {
    threshold = 1;
  }
  return threshold;
}

}  // namespace

void initializeDeviceUi(const DeviceUiConfig& config) {
  gConfig = config;
  delay(500);
  gTouchBaseline = calibrateTouchBaseline(gConfig.touchPin);
  gTouchThreshold = deriveTouchThreshold(gTouchBaseline, gConfig.touchThresholdFactor);
  gTouchRawActive = false;
  gTouchStableActive = false;
  gTouchLongPressHandled = false;
  gTouchStateChangedAtMs = millis();
  gTouchStartedAtMs = 0;
  gLedOverlay = LedOverlayState{};
  gLastLedOutput = false;
  gHasLoggedLedMode = false;
  gLastObservedErrorCode = "";

  pinMode(gConfig.ledPin, OUTPUT);
  setLedOutput(false);

  Wire.begin();
  gDisplay = new LiquidCrystal_I2C(gConfig.lcdAddress, gConfig.lcdColumns, gConfig.lcdRows);
  gDisplay->init();
  gDisplay->backlight();
  gDisplay->clear();

  Serial.println(
    String("[UI] Touch calibrated: baseline=") + String(gTouchBaseline) +
    String(" threshold=") + String(gTouchThreshold));
  renderLines("ColdGuard", "UI ready");
}

void tickDeviceUi(
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising) {
  processTouch(state, preferences, webServer, advertising);
  maybeTrackErrorOverlay(*state);
  renderLed(*state);
  renderUi(*state);
}

}  // namespace coldguard
