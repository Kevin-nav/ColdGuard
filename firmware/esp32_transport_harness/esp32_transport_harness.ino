#include <BLE2902.h>
#include <BLEAdvertising.h>
#include <BLECharacteristic.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <Preferences.h>
#include <WebServer.h>

#include "src/ble_recovery.h"
#include "src/device_state.h"
#include "src/wifi_runtime.h"

namespace {

constexpr char kFirmwareVersion[] = "cg-transport-0.1.0";
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

String buildEnrollmentLink(const coldguard::DeviceState& state) {
  return "https://coldguard.org/device/" + state.deviceId + "?claim=" + state.bootstrapToken + "&v=1";
}

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
  responseCharacteristic->setValue(payload.c_str());
  responseCharacteristic->notify();
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
  BLEDevice::init(deviceState.bleName.c_str());
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());
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
  coldguard::restartAdvertising(advertising, deviceState, kServiceUuid, kProtocolVersion);
}

}  // namespace

void setup() {
  Serial.begin(115200);
  coldguard::loadDeviceState(preferences, kPreferencesNamespace, &deviceState);
  coldguard::tickWifiRuntime(webServer, &deviceState, kFirmwareVersion);
  initializeBle();

  Serial.println("ColdGuard ESP32 transport harness ready");
  Serial.println("Device ID: " + deviceState.deviceId);
  logSecretValue("Bootstrap Token: ", deviceState.bootstrapToken);
  Serial.println("Enrollment Link: " + coldguard::buildEnrollmentLink(deviceState));
  Serial.println("BLE Name: " + deviceState.bleName);
  Serial.println("MAC: " + deviceState.macAddress);
}

void loop() {
  coldguard::tickWifiRuntime(webServer, &deviceState, kFirmwareVersion);
  if (deviceState.accessPointStarted || deviceState.stationConnected) {
    webServer.handleClient();
  }
}
