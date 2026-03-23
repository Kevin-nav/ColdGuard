#include "device_ui.h"

#include <Wire.h>
#include <U8g2lib.h>
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
  21,
  22,
  16,
  2,
  0.40f,
  200UL,
  700UL,
  "",
  1,
  "",
};
U8G2_SH1106_128X64_NONAME_F_HW_I2C* gDisplay = nullptr;
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
String gLastRenderedFrameKey;

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
constexpr uint8_t kDisplayWidth = 128;
constexpr uint8_t kHeaderDividerY = 15;
constexpr uint8_t kFooterDividerY = 55;
constexpr uint8_t kMenuFirstRowY = 18;
constexpr uint8_t kMenuRowHeight = 10;
constexpr size_t kTitleChars = 18;
constexpr size_t kBodyChars = 22;
constexpr size_t kFooterChars = 22;

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

bool runtimePhaseHasFailure(const DeviceState& state) {
  return state.runtimePhase == "facility-wifi-failed" || state.runtimePhase == "softap-failed";
}

bool runtimePhaseIsActive(const DeviceState& state) {
  return state.stationConnectInProgress || state.softApStartInProgress || runtimePhaseHasFailure(state);
}

String runtimePhaseLabel(const DeviceState& state) {
  if (state.runtimePhase == "facility-wifi-provisioning") {
    return "saving WiFi";
  }
  if (state.runtimePhase == "facility-wifi-connecting") {
    return "joining WiFi";
  }
  if (state.runtimePhase == "facility-wifi-retrying") {
    return "retrying WiFi";
  }
  if (state.runtimePhase == "facility-wifi-ready") {
    return "WiFi ready";
  }
  if (state.runtimePhase == "facility-wifi-failed") {
    return "WiFi failed";
  }
  if (state.runtimePhase == "softap-starting") {
    return "AP starting";
  }
  if (state.runtimePhase == "softap-ready") {
    return "AP ready";
  }
  if (state.runtimePhase == "softap-failed") {
    return "AP failed";
  }
  return "";
}

String homePrimaryLine(const DeviceState& state) {
  const String runtimePhase = runtimePhaseLabel(state);
  if (!runtimePhase.isEmpty() && runtimePhaseIsActive(state)) {
    return runtimePhase;
  }

  return enrollmentLabel(state) + " / " + currentTransportLabel(state);
}

String homeSecondaryLine(const DeviceState& state) {
  if (state.stationConnectInProgress) {
    return state.facilityWifiSsid.isEmpty()
             ? "Joining facility Wi-Fi"
             : String("Joining ") + state.facilityWifiSsid;
  }

  if (state.softApStartInProgress) {
    return "Starting local AP";
  }

  if (runtimePhaseHasFailure(state)) {
    return "Check Wi-Fi settings";
  }

  const String runtimePhase = runtimePhaseLabel(state);
  if (!runtimePhase.isEmpty()) {
    return runtimePhase;
  }

  if (state.pendingEnrollment.active) {
    return "Enrollment pending";
  }

  if (state.enrollmentReady) {
    return "Ready for pairing";
  }

  if (state.enrollmentState == "enrolled") {
    return "Ready for runtime";
  }

  return "Select opens menu";
}

String menuLabel(MenuItem item) {
  switch (item) {
    case MenuItem::Status:
      return "Status";
    case MenuItem::NewEnrollment:
      return "New enrollment";
    case MenuItem::ShowPairingCode:
      return "Pairing code";
    case MenuItem::WifiTools:
      return "Wi-Fi tools";
    case MenuItem::Diagnostics:
      return "Diagnostics";
    case MenuItem::FactoryReset:
      return "Factory reset";
    case MenuItem::Exit:
      return "Home";
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

String marqueeText(const String& value, size_t maxChars, unsigned long nowMs) {
  if (value.length() <= maxChars) {
    return value;
  }

  const String padded = value + "   ";
  const size_t windowStart = (nowMs / 450UL) % padded.length();
  String window;
  for (size_t index = 0; index < maxChars; index++) {
    window += padded.charAt((windowStart + index) % padded.length());
  }
  return window;
}

String clipText(const String& value, size_t maxChars) {
  if (value.length() <= maxChars) {
    return value;
  }
  if (maxChars <= 3) {
    return value.substring(0, maxChars);
  }
  return value.substring(0, maxChars - 3) + "...";
}

String fitBodyText(const String& value, unsigned long nowMs) {
  return marqueeText(value, kBodyChars, nowMs);
}

String fitTitleText(const String& value) {
  return clipText(value, kTitleChars);
}

String fitFooterText(const String& value) {
  return clipText(value, kFooterChars);
}

void setHeaderFont() {
  gDisplay->setFont(u8g2_font_6x12_tf);
  gDisplay->setFontPosTop();
}

void setEmphasisFont() {
  gDisplay->setFont(u8g2_font_6x12B_tf);
  gDisplay->setFontPosTop();
}

void setBodyFont() {
  gDisplay->setFont(u8g2_font_5x8_tf);
  gDisplay->setFontPosTop();
}

void setFooterFont() {
  gDisplay->setFont(u8g2_font_5x7_tf);
  gDisplay->setFontPosTop();
}

void drawTextLeft(uint8_t x, uint8_t y, const String& text) {
  gDisplay->drawStr(x, y, text.c_str());
}

void drawTextCentered(uint8_t y, const String& text) {
  const int16_t width = gDisplay->getStrWidth(text.c_str());
  int16_t x = (kDisplayWidth - width) / 2;
  if (x < 0) {
    x = 0;
  }
  gDisplay->drawStr(static_cast<uint8_t>(x), y, text.c_str());
}

bool beginFrame(const String& frameKey) {
  if (gDisplay == nullptr) {
    return false;
  }

  if (gHasRenderedFrame && frameKey == gLastRenderedFrameKey) {
    return false;
  }

  gHasRenderedFrame = true;
  gLastRenderedFrameKey = frameKey;

  gDisplay->clearBuffer();
  return true;
}

void endFrame() {
  gDisplay->sendBuffer();
}

void drawHeader(const String& title) {
  setHeaderFont();
  drawTextLeft(0, 0, fitTitleText(title));
  gDisplay->drawHLine(0, kHeaderDividerY, kDisplayWidth);
}

void drawFooter(const String& text) {
  gDisplay->drawHLine(0, kFooterDividerY, kDisplayWidth);
  setFooterFont();
  drawTextLeft(0, kFooterDividerY + 2, fitFooterText(text));
}

String currentFooterNotice(const String& defaultText) {
  if (gTransientUntilMs > millis() && gScreen != UiScreen::Confirm) {
    return gTransientMessage;
  }
  return defaultText;
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
  if (!state.lastErrorCode.isEmpty() || runtimePhaseHasFailure(state)) {
    return LedMode::Error;
  }
  if (gScreen == UiScreen::Menu || gScreen == UiScreen::Confirm) {
    return LedMode::Menu;
  }
  if (state.softApStartInProgress ||
      state.stationConnectInProgress ||
      state.pendingEnrollment.active ||
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
  const unsigned long nowMs = millis();
  const String primary = fitBodyText(homePrimaryLine(state), nowMs);
  const String secondary = fitBodyText(homeSecondaryLine(state), nowMs);
  const String footer = currentFooterNotice("Select: menu");
  const String frameKey = String("home|") + title + "|" + primary + "|" + secondary + "|" + footer;
  if (!beginFrame(frameKey)) {
    return;
  }

  drawHeader(title);
  setEmphasisFont();
  drawTextCentered(21, primary);
  setBodyFont();
  drawTextCentered(38, secondary);
  drawFooter(footer);
  endFrame();
}

void renderMenuScreen() {
  const unsigned long nowMs = millis();
  const String footer = currentFooterNotice("Nav: move  Select: open");
  const size_t visibleRows = 4;
  size_t startIndex = 0;
  if (gMenuIndex >= visibleRows) {
    startIndex = gMenuIndex - (visibleRows - 1);
  }

  String frameKey = String("menu|") + String(gMenuIndex) + "|" + footer;
  for (size_t row = 0; row < visibleRows && startIndex + row < kMenuItemCount; row++) {
    frameKey += "|" + menuLabel(kMenuItems[startIndex + row]);
  }
  if (!beginFrame(frameKey)) {
    return;
  }

  drawHeader("Menu");
  setBodyFont();
  for (size_t row = 0; row < visibleRows && startIndex + row < kMenuItemCount; row++) {
    const size_t itemIndex = startIndex + row;
    const bool selected = itemIndex == gMenuIndex;
    const uint8_t y = kMenuFirstRowY + static_cast<uint8_t>(row) * kMenuRowHeight;
    const String label = fitBodyText(menuLabel(kMenuItems[itemIndex]), nowMs);
    if (selected) {
      gDisplay->drawBox(0, y - 1, kDisplayWidth, kMenuRowHeight);
      gDisplay->setDrawColor(0);
      drawTextLeft(5, y, label);
      gDisplay->setDrawColor(1);
    } else {
      drawTextLeft(7, y, label);
    }
  }
  drawFooter(footer);
  endFrame();
}

void renderStatusDetail(const DeviceState& state) {
  const unsigned long nowMs = millis();
  String body1;
  String body2;
  switch (gDetailPage % 3) {
    case 0:
      body1 = "Enrollment " + enrollmentLabel(state);
      body2 = "Transport " + currentTransportLabel(state);
      break;
    case 1:
      body1 = "SoftAP " + String(state.accessPointStarted ? "up" : "down");
      body2 = "WiFi " + String(state.stationConnected ? "up" : "down");
      break;
    default:
      body1 = "Runtime";
      body2 = runtimePhaseLabel(state).isEmpty() ? "steady" : runtimePhaseLabel(state);
      break;
  }

  const String footer = currentFooterNotice("Nav: page  Hold: back");
  const String shown1 = fitBodyText(body1, nowMs);
  const String shown2 = fitBodyText(body2, nowMs);
  const String frameKey = String("detail|status|") + String(gDetailPage % 3) + "|" + shown1 + "|" + shown2 + "|" + footer;
  if (!beginFrame(frameKey)) {
    return;
  }

  drawHeader("Status");
  setEmphasisFont();
  drawTextLeft(0, 21, shown1);
  setBodyFont();
  drawTextLeft(0, 39, shown2);
  drawFooter(footer);
  endFrame();
}

void renderPairingCodeDetail(const DeviceState& state) {
  const unsigned long nowMs = millis();
  String body1;
  String body2;

  if (!state.enrollmentReady) {
    body1 = "Pairing disabled";
    body2 = "Create new enrollment";
  } else {
    switch (gDetailPage % 3) {
      case 0:
        body1 = "Ready to pair";
        body2 = "Device ID " + state.deviceId;
        break;
      case 1:
        body1 = "Claim token";
        body2 = state.bootstrapToken;
        break;
      default:
        body1 = "Enrollment link";
        body2 = buildEnrollmentLink(state);
        break;
    }
  }

  const String footer = currentFooterNotice("Nav: page  Hold: back");
  const String shown1 = fitBodyText(body1, nowMs);
  const String shown2 = fitBodyText(body2, nowMs);
  const String frameKey = String("detail|pair|") + String(gDetailPage % 3) + "|" + shown1 + "|" + shown2 + "|" + footer;
  if (!beginFrame(frameKey)) {
    return;
  }

  drawHeader("Pairing code");
  setEmphasisFont();
  drawTextLeft(0, 21, shown1);
  setBodyFont();
  drawTextLeft(0, 37, shown2);
  drawFooter(footer);
  endFrame();
}

void renderWifiToolsDetail(const DeviceState& state) {
  const unsigned long nowMs = millis();
  String body1;
  String body2;

  switch (gDetailPage % 2) {
    case 0:
      body1 = state.facilityWifiSsid.isEmpty() ? "Saved Wi-Fi: none" : "Saved Wi-Fi";
      body2 = state.facilityWifiSsid.isEmpty()
                ? "SoftAP " + String(state.accessPointStarted ? "up" : "down")
                : state.facilityWifiSsid;
      break;
    default:
      body1 = "Clear saved Wi-Fi";
      body2 = runtimePhaseLabel(state).isEmpty()
                ? "Transport " + currentTransportLabel(state)
                : runtimePhaseLabel(state);
      break;
  }

  const String footer = currentFooterNotice("Nav: page  Select: clear");
  const String shown1 = fitBodyText(body1, nowMs);
  const String shown2 = fitBodyText(body2, nowMs);
  const String frameKey = String("detail|wifi|") + String(gDetailPage % 2) + "|" + shown1 + "|" + shown2 + "|" + footer;
  if (!beginFrame(frameKey)) {
    return;
  }

  drawHeader("Wi-Fi tools");
  setEmphasisFont();
  drawTextLeft(0, 21, shown1);
  setBodyFont();
  drawTextLeft(0, 37, shown2);
  drawFooter(footer);
  endFrame();
}

void renderDiagnosticsDetail(const DeviceState& state) {
  const unsigned long nowMs = millis();
  String body1;
  String body2;

  switch (gDetailPage % 3) {
    case 0:
      body1 = "Device ID";
      body2 = String("FW ") + String(gConfig.firmwareVersion);
      break;
    case 1:
      body1 = "Last error";
      body2 = state.lastErrorCode.isEmpty() ? "none" : state.lastErrorCode;
      break;
    default:
      body1 = "BLE name";
      body2 = state.bleName + " / " + enrollmentLabel(state);
      break;
  }

  const String footer = currentFooterNotice("Nav: page  Hold: back");
  const String shown1 = fitBodyText(body1, nowMs);
  const String shown2 = fitBodyText(body2, nowMs);
  const String frameKey = String("detail|diag|") + String(gDetailPage % 3) + "|" + shown1 + "|" + shown2 + "|" + footer;
  if (!beginFrame(frameKey)) {
    return;
  }

  drawHeader("Diagnostics");
  setEmphasisFont();
  drawTextLeft(0, 21, shown1);
  setBodyFont();
  drawTextLeft(0, 37, shown2);
  drawFooter(footer);
  endFrame();
}

void renderConfirmScreen() {
  String prompt;
  switch (gConfirmAction) {
    case ConfirmAction::NewEnrollment:
      prompt = "New enrollment?";
      break;
    case ConfirmAction::ClearFacilityWifi:
      prompt = "Clear saved Wi-Fi?";
      break;
    case ConfirmAction::FactoryReset:
      prompt = "Factory reset?";
      break;
    case ConfirmAction::None:
      prompt = "No action";
      break;
  }

  const String footer = "Tap: no  Hold: yes";
  const String frameKey = String("confirm|") + String(confirmActionLabel(gConfirmAction)) + "|" + prompt;
  if (!beginFrame(frameKey)) {
    return;
  }

  drawHeader("Confirm");
  gDisplay->drawFrame(4, 19, 120, 26);
  setEmphasisFont();
  drawTextCentered(28, fitTitleText(prompt));
  drawFooter(footer);
  endFrame();
}

void clearFacilityWifi(
  DeviceState* state,
  Preferences& preferences) {
  state->facilityWifiSsid = "";
  state->facilityWifiPassword = "";
  state->facilityWifiProvisioning = false;
  state->stationConnected = false;
  state->stationConnectInProgress = false;
  state->stationConnectDeadlineMs = 0;
  state->lastStationConnectAttemptMs = 0;
  state->lastErrorCode = "";
  state->runtimePhase = state->accessPointStarted ? "softap-ready" : "idle";
  state->runtimePhaseChangedAtMs = millis();
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
      showTransientMessage("Enrollment ready");
      openDetailView(DetailView::PairingCode);
      return;
    case ConfirmAction::ClearFacilityWifi:
      clearFacilityWifi(state, preferences);
      logUiEvent("Facility Wi-Fi cleared");
      triggerLedOverlay(LedOverlayType::FacilityWifiCleared, 1200UL);
      showTransientMessage("Wi-Fi cleared");
      openDetailView(DetailView::WifiTools);
      return;
    case ConfirmAction::FactoryReset:
      stopSoftAp(webServer, state);
      WiFi.disconnect(false, false);
      clearEnrollmentState(state);
      state->runtimePhase = "idle";
      state->runtimePhaseChangedAtMs = millis();
      state->stationConnectInProgress = false;
      state->stationConnectDeadlineMs = 0;
      state->facilityWifiProvisioning = false;
      state->softApStartInProgress = false;
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
  gLastRenderedFrameKey = "";

  pinMode(gConfig.ledPin, OUTPUT);
  setLedOutput(false);

  Wire.begin(gConfig.oledI2cSdaPin, gConfig.oledI2cSclPin);
  gDisplay = new U8G2_SH1106_128X64_NONAME_F_HW_I2C(U8G2_R0, U8X8_PIN_NONE);
  gDisplay->begin();
  gDisplay->setFont(u8g2_font_6x12_tf);
  gDisplay->setFontPosTop();
  gDisplay->clearBuffer();
  gDisplay->sendBuffer();

  logTouchCalibration("Nav", gConfig.navTouchPin, gNavTouchBaseline, gNavTouchThreshold);
  logTouchCalibration("Select", gConfig.selectTouchPin, gSelectTouchBaseline, gSelectTouchThreshold);
  if (beginFrame("boot|ui-ready")) {
    drawHeader("ColdGuard");
    setEmphasisFont();
    drawTextCentered(24, "OLED ready");
    drawFooter("Two-touch UI");
    endFrame();
  }
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
