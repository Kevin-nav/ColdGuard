#include <BLE2902.h>
#include <BLEAdvertising.h>
#include <BLECharacteristic.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <Preferences.h>
#include <WebServer.h>

#include "src/ble_recovery.h"
#include "src/device_ui.h"
#include "src/device_state.h"
#include "src/wifi_runtime.h"

namespace {

constexpr char kFirmwareVersion[] = "cg-transport-0.1.2";
constexpr uint8_t kProtocolVersion = 1;
constexpr unsigned long kProofWindowMs = 5UL * 60UL * 1000UL;
constexpr unsigned long kVerifiedSessionWindowMs = 60UL * 1000UL;
constexpr char kPreferencesNamespace[] = "coldguard";
constexpr bool kVerboseSecretLogging = false;
// Harness-only shared secret. Replace with per-device secret provisioning before production use.
constexpr char kActionTicketMasterKey[] = "coldguard-test-master-key";

constexpr char kServiceUuid[] = "6B8F7B61-8B30-4A70-BD9A-44B4C1D7C110";
constexpr char kCommandCharacteristicUuid[] = "6B8F7B61-8B30-4A70-BD9A-44B4C1D7C111";
constexpr char kResponseCharacteristicUuid[] = "6B8F7B61-8B30-4A70-BD9A-44B4C1D7C112";
constexpr uint8_t kNavTouchPin = T0;
constexpr uint8_t kSelectTouchPin = T4;  // GPIO 13
constexpr uint8_t kBuiltInLedPin = 2;
constexpr uint8_t kLcdColumns = 16;
constexpr uint8_t kLcdRows = 2;
constexpr float kTouchThresholdFactor = 0.40f;
constexpr unsigned long kTouchDebounceMs = 200UL;
constexpr unsigned long kTouchLongPressMs = 700UL;
constexpr size_t kBleNotifyChunkBytes = 20;

Preferences preferences;
WebServer webServer(80);
BLEServer* bleServer = nullptr;
BLECharacteristic* commandCharacteristic = nullptr;
BLECharacteristic* responseCharacteristic = nullptr;
BLEAdvertising* advertising = nullptr;
coldguard::DeviceState deviceState;
bool pendingAdvertisingRefreshOnDisconnect = false;

constexpr coldguard::BleRecoveryConfig kBleRecoveryConfig = {
  kActionTicketMasterKey,
  kFirmwareVersion,
  kServiceUuid,
  kProofWindowMs,
  kVerifiedSessionWindowMs,
  kProtocolVersion,
};

constexpr coldguard::DeviceUiConfig kDeviceUiConfig = {
  kNavTouchPin,
  kSelectTouchPin,
  kBuiltInLedPin,
  21,
  22,
  kLcdColumns,
  kLcdRows,
  kTouchThresholdFactor,
  kTouchDebounceMs,
  kTouchLongPressMs,
  kFirmwareVersion,
  kProtocolVersion,
  kServiceUuid,
};

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

  Serial.println(label + coldguard::sanitizePayloadForLogging(payload));
}

void sendBleResponse(const String& payload) {
  if (payload.isEmpty()) {
    return;
  }

  for (size_t offset = 0; offset < payload.length(); offset += kBleNotifyChunkBytes) {
    const String chunk = payload.substring(offset, offset + kBleNotifyChunkBytes);
    responseCharacteristic->setValue(chunk.c_str());
    responseCharacteristic->notify();
    delay(10);
  }

  logBlePayload("[BLE] ", payload);
}

class CommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    const String rawValue = characteristic->getValue();
    if (rawValue.isEmpty()) {
      return;
    }

    const String payload(rawValue);
    logBlePayload("[BLE] ", payload);
    coldguard::BleRecoveryDeferredActions deferredActions;
    const String response = coldguard::dispatchCommand(
      payload,
      &deviceState,
      preferences,
      webServer,
      advertising,
      kBleRecoveryConfig,
      &deferredActions);
    sendBleResponse(response);
    if (deferredActions.restartAdvertising) {
      pendingAdvertisingRefreshOnDisconnect = true;
      Serial.println("[BLE_DEBUG] advertising refresh scheduled for disconnect");
    }
  }
};

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) override {
    (void)server;
    Serial.println("[BLE_DEBUG] central connected");
  }

  void onDisconnect(BLEServer* server) override {
    (void)server;
    if (pendingAdvertisingRefreshOnDisconnect) {
      Serial.println("[BLE_DEBUG] central disconnected; applying deferred advertising refresh");
    } else {
      Serial.println("[BLE_DEBUG] central disconnected; resuming advertising");
    }
    pendingAdvertisingRefreshOnDisconnect = false;
    coldguard::restartAdvertising(advertising, deviceState, kServiceUuid, kProtocolVersion);
  }
};

void initializeBle() {
  Serial.println("[BOOT] BLE: BLEDevice::init begin");
  BLEDevice::init(deviceState.bleName.c_str());
  Serial.println("[BOOT] BLE: createServer");
  bleServer = BLEDevice::createServer();
  if (bleServer == nullptr) {
    Serial.println("[BOOT][FATAL] BLE createServer returned null");
    return;
  }
  bleServer->setCallbacks(new ServerCallbacks());
  Serial.println("[BOOT] BLE: createService");
  BLEService* service = bleServer->createService(kServiceUuid);
  if (service == nullptr) {
    Serial.println("[BOOT][FATAL] BLE createService returned null");
    return;
  }

  Serial.println("[BOOT] BLE: create command characteristic");
  commandCharacteristic = service->createCharacteristic(
    kCommandCharacteristicUuid,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  if (commandCharacteristic == nullptr) {
    Serial.println("[BOOT][FATAL] command characteristic is null");
    return;
  }
  commandCharacteristic->setCallbacks(new CommandCallbacks());

  Serial.println("[BOOT] BLE: create response characteristic");
  responseCharacteristic = service->createCharacteristic(
    kResponseCharacteristicUuid,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ);
  if (responseCharacteristic == nullptr) {
    Serial.println("[BOOT][FATAL] response characteristic is null");
    return;
  }
  responseCharacteristic->addDescriptor(new BLE2902());

  Serial.println("[BOOT] BLE: service start");
  service->start();
  Serial.println("[BOOT] BLE: get advertising");
  advertising = BLEDevice::getAdvertising();
  if (advertising == nullptr) {
    Serial.println("[BOOT][FATAL] BLE advertising instance is null");
    return;
  }
  Serial.println("[BOOT] BLE: add service UUID");
  advertising->addServiceUUID(kServiceUuid);
  Serial.println("[BOOT] BLE: restart advertising");
  coldguard::restartAdvertising(advertising, deviceState, kServiceUuid, kProtocolVersion);
  Serial.println("[BOOT] BLE: init complete");
}

}  // namespace

void setup() {
  Serial.begin(115200);
  Serial.println("[BOOT] setup: serial ready");
  Serial.println("[BOOT] setup: loading device state");
  coldguard::loadDeviceState(preferences, kPreferencesNamespace, &deviceState);
  Serial.println("[BOOT] setup: initializing device UI");
  coldguard::initializeDeviceUi(kDeviceUiConfig);
  Serial.println("[BOOT] setup: starting wifi runtime tick");
  coldguard::tickWifiRuntime(webServer, &deviceState, kFirmwareVersion);
  Serial.println("[BOOT] setup: initializing BLE");
  initializeBle();
  Serial.println("[BOOT] setup: init complete");

  Serial.println("ColdGuard ESP32 transport harness ready");
  Serial.println(String("Device ID: ") + deviceState.deviceId);
  logSecretValue("Bootstrap Token: ", deviceState.bootstrapToken);
  Serial.println(String("Enrollment Link: ") + coldguard::buildEnrollmentLink(deviceState));
  Serial.println(String("BLE Name: ") + deviceState.bleName);
  Serial.println(String("MAC: ") + deviceState.macAddress);
}

void loop() {
  coldguard::tickWifiRuntime(webServer, &deviceState, kFirmwareVersion);
  coldguard::tickDeviceUi(&deviceState, preferences, webServer, advertising);
  if (deviceState.accessPointStarted || deviceState.stationConnected) {
    webServer.handleClient();
  }
}
