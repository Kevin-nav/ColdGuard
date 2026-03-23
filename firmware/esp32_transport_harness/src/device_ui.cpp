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

enum class TouchRole {
  Nav,
  Select,
};

enum class UiInputEvent {
  NavTap,
  NavHold,
  SelectTap,
  SelectHold,
};

enum class UiScreen {
  Home,
  Menu,
  Detail,
  Confirm,
};

enum class DetailView {
  Status,
  PairingCode,
  WifiTools,
  Diagnostics,
};

enum class ConfirmAction {
  None,
  NewEnrollment,
  ClearFacilityWifi,
  FactoryReset,
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

struct TouchTracker {
  uint8_t pin = 0;
  uint16_t threshold = 0;
  bool stableActive = false;
  bool rawActive = false;
  bool longPressHandled = false;
  unsigned long stateChangedAtMs = 0;
  unsigned long startedAtMs = 0;
};

DeviceUiConfig gConfig = {
  T0,
  T4,
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
UiScreen gScreen = UiScreen::Home;
DetailView gDetailView = DetailView::Status;
ConfirmAction gConfirmAction = ConfirmAction::None;
UiScreen gConfirmReturnScreen = UiScreen::Menu;
DetailView gConfirmReturnDetailView = DetailView::Status;
size_t gMenuIndex = 0;
size_t gDetailPage = 0;
unsigned long gTransientUntilMs = 0;
String gTransientMessage;
uint16_t gNavTouchBaseline = 0;
uint16_t gNavTouchThreshold = 0;
uint16_t gSelectTouchBaseline = 0;
uint16_t gSelectTouchThreshold = 0;
TouchTracker gNavTouch;
TouchTracker gSelectTouch;
LedOverlayState gLedOverlay;
bool gLastLedOutput = false;
bool gHasLoggedLedMode = false;
LedMode gLastLoggedLedMode = LedMode::Runtime;
String gLastObservedErrorCode;
bool gHasRenderedFrame = false;
String gLastRenderedLine1;
String gLastRenderedLine2;

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

const char* screenLabel(UiScreen screen) {
  switch (screen) {
    case UiScreen::Home:
      return "home";
    case UiScreen::Menu:
      return "menu";
    case UiScreen::Detail:
      return "detail";
    case UiScreen::Confirm:
      return "confirm";
  }

  return "home";
}

const char* detailViewLabel(DetailView view) {
  switch (view) {
    case DetailView::Status:
      return "status";
    case DetailView::PairingCode:
      return "pairing";
    case DetailView::WifiTools:
      return "wifi-tools";
    case DetailView::Diagnostics:
      return "diagnostics";
  }

  return "status";
}

const char* confirmActionLabel(ConfirmAction action) {
  switch (action) {
    case ConfirmAction::None:
      return "none";
    case ConfirmAction::NewEnrollment:
      return "new-enrollment";
    case ConfirmAction::ClearFacilityWifi:
      return "clear-facility-wifi";
    case ConfirmAction::FactoryReset:
      return "factory-reset";
  }

  return "none";
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

void logTouchCalibration(const char* role, uint8_t touchPin, uint16_t baseline, uint16_t threshold) {
  Serial.println(
    String("[UI] ") + role + " touch calibrated: pin=" + String(touchPin) +
    String(" baseline=") + String(baseline) +
    String(" threshold=") + String(threshold));
}

const char* inputEventLabel(UiInputEvent event) {
  switch (event) {
    case UiInputEvent::NavTap:
      return "nav_tap";
    case UiInputEvent::NavHold:
      return "nav_hold";
    case UiInputEvent::SelectTap:
      return "select_tap";
    case UiInputEvent::SelectHold:
      return "select_hold";
  }

  return "input";
}

void logInputEvent(UiInputEvent event) {
  logUiEvent(String("Input -> ") + inputEventLabel(event));
}

void logMenuSelection() {
  logUiEvent(String("Selection -> item=") + menuLabel(kMenuItems[gMenuIndex]));
}

void setUiScreen(UiScreen screen) {
  if (gScreen == screen) {
    return;
  }

  gScreen = screen;
  logUiEvent(String("Screen -> ") + screenLabel(screen));
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

  if (gHasRenderedFrame && line1 == gLastRenderedLine1 && line2 == gLastRenderedLine2) {
    return;
  }

  gHasRenderedFrame = true;
  gLastRenderedLine1 = line1;
  gLastRenderedLine2 = line2;

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
  if (gScreen == UiScreen::Menu || gScreen == UiScreen::Confirm) {
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

void openHome() {
  gDetailPage = 0;
  setUiScreen(UiScreen::Home);
}

void openMenu() {
  gMenuIndex = 0;
  gDetailPage = 0;
  setUiScreen(UiScreen::Menu);
  logMenuSelection();
}

void openDetailView(DetailView view) {
  gDetailView = view;
  gDetailPage = 0;
  setUiScreen(UiScreen::Detail);
  logUiEvent(String("Detail -> ") + detailViewLabel(view));
}

void openConfirmScreen(ConfirmAction action, UiScreen returnScreen, DetailView returnDetailView) {
  gConfirmAction = action;
  gConfirmReturnScreen = returnScreen;
  gConfirmReturnDetailView = returnDetailView;
  setUiScreen(UiScreen::Confirm);
  logUiEvent(String("Confirm -> action=") + confirmActionLabel(action));
}

void returnFromConfirm(bool accepted) {
  logUiEvent(
    String("Confirm -> action=") + confirmActionLabel(gConfirmAction) +
    String(accepted ? " accepted" : " cancelled"));

  const UiScreen returnScreen = gConfirmReturnScreen;
  const DetailView returnDetailView = gConfirmReturnDetailView;
  gConfirmAction = ConfirmAction::None;

  if (accepted) {
    return;
  }

  if (returnScreen == UiScreen::Detail) {
    openDetailView(returnDetailView);
    return;
  }
  if (returnScreen == UiScreen::Menu) {
    setUiScreen(UiScreen::Menu);
    logMenuSelection();
    return;
  }
  openHome();
}

void renderHomeScreen(const DeviceState& state) {
  const String title = state.deviceNickname.isEmpty() ? state.bleName : state.deviceNickname;
  renderLines(title, enrollmentLabel(state) + " " + currentTransportLabel(state));
}

void renderMenuScreen() {
  const MenuItem current = kMenuItems[gMenuIndex];
  const MenuItem next = kMenuItems[(gMenuIndex + 1) % kMenuItemCount];
  renderLines(">" + menuLabel(current), " " + menuLabel(next));
}

void renderStatusDetail(const DeviceState& state) {
  switch (gDetailPage % 2) {
    case 0:
      renderLines("> Status", "Trans:" + currentTransportLabel(state));
      break;
    default:
      renderLines(
        "State:" + enrollmentLabel(state),
        "WiFi:" + String(state.stationConnected ? "up" : "down"));
      break;
  }
}

void renderPairingCodeDetail(const DeviceState& state) {
  if (!state.enrollmentReady) {
    renderLines("Pairing disabled", "New enroll first");
    return;
  }

  switch (gDetailPage % 3) {
    case 0:
      renderLines("> Pair code", "ID:" + state.deviceId);
      break;
    case 1:
      renderLines("Claim", state.bootstrapToken);
      break;
    default:
      renderLines("Link", buildEnrollmentLink(state));
      break;
  }
}

void renderWifiToolsDetail(const DeviceState& state) {
  switch (gDetailPage % 2) {
    case 0:
      renderLines(
        "> WiFi tools",
        state.facilityWifiSsid.isEmpty() ? "SSID:not set" : "SSID:" + state.facilityWifiSsid);
      break;
    default:
      renderLines(
        "Select:clear",
        "SoftAP:" + String(state.accessPointStarted ? "up" : "down"));
      break;
  }
}

void renderDiagnosticsDetail(const DeviceState& state) {
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

void renderConfirmScreen() {
  switch (gConfirmAction) {
    case ConfirmAction::NewEnrollment:
      renderLines("New enroll?", "Tap no hold yes");
      return;
    case ConfirmAction::ClearFacilityWifi:
      renderLines("Clear WiFi?", "Tap no hold yes");
      return;
    case ConfirmAction::FactoryReset:
      renderLines("Factory reset?", "Tap no hold yes");
      return;
    case ConfirmAction::None:
      renderLines("ColdGuard", "No action");
      return;
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
      openDetailView(DetailView::Status);
      return;
    case MenuItem::NewEnrollment:
      openConfirmScreen(ConfirmAction::NewEnrollment, UiScreen::Menu, DetailView::Status);
      return;
    case MenuItem::ShowPairingCode:
      logUiEvent("Pairing code viewed");
      openDetailView(DetailView::PairingCode);
      return;
    case MenuItem::WifiTools:
      openDetailView(DetailView::WifiTools);
      return;
    case MenuItem::FactoryReset:
      openConfirmScreen(ConfirmAction::FactoryReset, UiScreen::Menu, DetailView::Status);
      return;
    case MenuItem::Diagnostics:
      openDetailView(DetailView::Diagnostics);
      return;
    case MenuItem::Exit:
      openHome();
      return;
  }
}

void executeConfirmedAction(
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising) {
  const ConfirmAction action = gConfirmAction;
  returnFromConfirm(true);

  switch (action) {
    case ConfirmAction::NewEnrollment:
      prepareNewEnrollment(state);
      saveDeviceState(preferences, *state);
      restartAdvertising(advertising, *state, gConfig.serviceUuid, gConfig.protocolVersion);
      logNewEnrollment(*state);
      triggerLedOverlay(LedOverlayType::EnrollmentGenerated, 1200UL);
      showTransientMessage("New enroll ready");
      openDetailView(DetailView::PairingCode);
      return;
    case ConfirmAction::ClearFacilityWifi:
      clearFacilityWifi(state, preferences);
      logUiEvent("Facility Wi-Fi cleared");
      triggerLedOverlay(LedOverlayType::FacilityWifiCleared, 1200UL);
      showTransientMessage("Facility WiFi clr");
      openDetailView(DetailView::WifiTools);
      return;
    case ConfirmAction::FactoryReset:
      stopSoftAp(webServer, state);
      WiFi.disconnect(false, false);
      clearEnrollmentState(state);
      saveDeviceState(preferences, *state);
      restartAdvertising(advertising, *state, gConfig.serviceUuid, gConfig.protocolVersion);
      logUiEvent("Factory reset");
      triggerLedOverlay(LedOverlayType::FactoryReset, 1400UL);
      showTransientMessage("Factory reset");
      openHome();
      return;
    case ConfirmAction::None:
      return;
  }
}

void clearTouchTracker(TouchTracker* tracker) {
  tracker->stableActive = false;
  tracker->rawActive = false;
  tracker->longPressHandled = false;
  tracker->stateChangedAtMs = millis();
  tracker->startedAtMs = 0;
}

bool sampleTouchActive(const TouchTracker& tracker) {
  return touchRead(tracker.pin) < tracker.threshold;
}

void advanceUiPage() {
  if (gScreen == UiScreen::Menu) {
    gMenuIndex = (gMenuIndex + 1) % kMenuItemCount;
    logMenuSelection();
    return;
  }

  if (gScreen == UiScreen::Detail) {
    gDetailPage += 1;
    return;
  }

  if (gScreen == UiScreen::Confirm) {
    returnFromConfirm(false);
  }
}

void goBackFromCurrentScreen() {
  if (gScreen == UiScreen::Home) {
    return;
  }

  if (gScreen == UiScreen::Menu) {
    openHome();
    return;
  }

  if (gScreen == UiScreen::Confirm) {
    returnFromConfirm(false);
    return;
  }

  openMenu();
}

void handleInputEvent(
  UiInputEvent event,
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising) {
  logInputEvent(event);

  switch (event) {
    case UiInputEvent::NavTap:
      advanceUiPage();
      return;
    case UiInputEvent::NavHold:
      goBackFromCurrentScreen();
      return;
    case UiInputEvent::SelectTap:
      if (gScreen == UiScreen::Home) {
        openMenu();
        return;
      }
      if (gScreen == UiScreen::Menu) {
        performMenuAction(kMenuItems[gMenuIndex], state, preferences, webServer, advertising);
        return;
      }
      if (gScreen == UiScreen::Detail) {
        if (gDetailView == DetailView::WifiTools) {
          openConfirmScreen(ConfirmAction::ClearFacilityWifi, UiScreen::Detail, DetailView::WifiTools);
          return;
        }
        advanceUiPage();
        return;
      }
      returnFromConfirm(false);
      return;
    case UiInputEvent::SelectHold:
      if (gScreen == UiScreen::Confirm) {
        executeConfirmedAction(state, preferences, webServer, advertising);
        return;
      }
      if (gScreen == UiScreen::Menu) {
        performMenuAction(kMenuItems[gMenuIndex], state, preferences, webServer, advertising);
        return;
      }
      if (gScreen == UiScreen::Detail && gDetailView == DetailView::WifiTools) {
        openConfirmScreen(ConfirmAction::ClearFacilityWifi, UiScreen::Detail, DetailView::WifiTools);
        return;
      }
      openMenu();
      return;
  }
}

void processTouchTracker(
  TouchTracker* tracker,
  TouchRole role,
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising) {
  const unsigned long nowMs = millis();
  const bool rawActive = sampleTouchActive(*tracker);

  if (rawActive != tracker->rawActive) {
    tracker->rawActive = rawActive;
    tracker->stateChangedAtMs = nowMs;
  }

  if (nowMs - tracker->stateChangedAtMs < gConfig.touchDebounceMs) {
    return;
  }

  if (rawActive != tracker->stableActive) {
    tracker->stableActive = rawActive;
    if (rawActive) {
      tracker->startedAtMs = nowMs;
      tracker->longPressHandled = false;
      return;
    }

    if (!tracker->longPressHandled) {
      handleInputEvent(
        role == TouchRole::Nav ? UiInputEvent::NavTap : UiInputEvent::SelectTap,
        state,
        preferences,
        webServer,
        advertising);
    }
    return;
  }

  if (tracker->stableActive &&
      !tracker->longPressHandled &&
      nowMs - tracker->startedAtMs >= gConfig.longPressMs) {
    tracker->longPressHandled = true;
    handleInputEvent(
      role == TouchRole::Nav ? UiInputEvent::NavHold : UiInputEvent::SelectHold,
      state,
      preferences,
      webServer,
      advertising);
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
    switch (gScreen) {
      case UiScreen::Home:
        renderLines(state.deviceNickname.isEmpty() ? state.bleName : state.deviceNickname, gTransientMessage);
        return;
      case UiScreen::Menu:
        renderLines(">" + menuLabel(kMenuItems[gMenuIndex]), gTransientMessage);
        return;
      case UiScreen::Detail:
        switch (gDetailView) {
          case DetailView::Status:
            renderLines("> Status", gTransientMessage);
            return;
          case DetailView::PairingCode:
            renderLines("Pairing", gTransientMessage);
            return;
          case DetailView::WifiTools:
            renderLines("> WiFi tools", gTransientMessage);
            return;
          case DetailView::Diagnostics:
            renderLines("Diagnostics", gTransientMessage);
            return;
        }
        return;
      case UiScreen::Confirm:
        renderConfirmScreen();
        return;
    }
    return;
  }

  switch (gScreen) {
    case UiScreen::Home:
      renderHomeScreen(state);
      return;
    case UiScreen::Menu:
      renderMenuScreen();
      return;
    case UiScreen::Detail:
      switch (gDetailView) {
        case DetailView::Status:
          renderStatusDetail(state);
          return;
        case DetailView::PairingCode:
          renderPairingCodeDetail(state);
          return;
        case DetailView::WifiTools:
          renderWifiToolsDetail(state);
          return;
        case DetailView::Diagnostics:
          renderDiagnosticsDetail(state);
          return;
      }
      return;
    case UiScreen::Confirm:
      renderConfirmScreen();
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
  gNavTouchBaseline = calibrateTouchBaseline(gConfig.navTouchPin);
  gNavTouchThreshold = deriveTouchThreshold(gNavTouchBaseline, gConfig.touchThresholdFactor);
  gSelectTouchBaseline = calibrateTouchBaseline(gConfig.selectTouchPin);
  gSelectTouchThreshold = deriveTouchThreshold(gSelectTouchBaseline, gConfig.touchThresholdFactor);
  gNavTouch = TouchTracker{gConfig.navTouchPin, gNavTouchThreshold};
  gSelectTouch = TouchTracker{gConfig.selectTouchPin, gSelectTouchThreshold};
  clearTouchTracker(&gNavTouch);
  clearTouchTracker(&gSelectTouch);
  gScreen = UiScreen::Home;
  gDetailView = DetailView::Status;
  gConfirmAction = ConfirmAction::None;
  gConfirmReturnScreen = UiScreen::Menu;
  gConfirmReturnDetailView = DetailView::Status;
  gMenuIndex = 0;
  gDetailPage = 0;
  gLedOverlay = LedOverlayState{};
  gLastLedOutput = false;
  gHasLoggedLedMode = false;
  gLastObservedErrorCode = "";
  gHasRenderedFrame = false;
  gLastRenderedLine1 = "";
  gLastRenderedLine2 = "";

  pinMode(gConfig.ledPin, OUTPUT);
  setLedOutput(false);

  Wire.begin();
  gDisplay = new LiquidCrystal_I2C(gConfig.lcdAddress, gConfig.lcdColumns, gConfig.lcdRows);
  gDisplay->init();
  gDisplay->backlight();
  gDisplay->clear();

  logTouchCalibration("Nav", gConfig.navTouchPin, gNavTouchBaseline, gNavTouchThreshold);
  logTouchCalibration("Select", gConfig.selectTouchPin, gSelectTouchBaseline, gSelectTouchThreshold);
  renderLines("ColdGuard", "UI ready");
}

void tickDeviceUi(
  DeviceState* state,
  Preferences& preferences,
  WebServer& webServer,
  BLEAdvertising* advertising) {
  processTouchTracker(&gNavTouch, TouchRole::Nav, state, preferences, webServer, advertising);
  processTouchTracker(&gSelectTouch, TouchRole::Select, state, preferences, webServer, advertising);
  maybeTrackErrorOverlay(*state);
  renderLed(*state);
  renderUi(*state);
}

}  // namespace coldguard
