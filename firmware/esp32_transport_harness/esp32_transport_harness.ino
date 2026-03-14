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
    const String response = coldguard::dispatchCommand(
      payload,
      &deviceState,
      preferences,
      webServer,
      advertising,
      kBleRecoveryConfig);
    sendBleResponse(response);
  }
};

void initializeBle() {
  BLEDevice::init(deviceState.bleName.c_str());
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
  coldguard::restartAdvertising(advertising, deviceState, kServiceUuid, kProtocolVersion);
}

}  // namespace

void setup() {
  Serial.begin(115200);
  coldguard::loadDeviceState(preferences, kPreferencesNamespace, &deviceState);
  initializeBle();

  Serial.println("ColdGuard ESP32 transport harness ready");
  Serial.println("Device ID: " + deviceState.deviceId);
  logSecretValue("Bootstrap Token: ", deviceState.bootstrapToken);
  Serial.println("Enrollment Link: " + buildEnrollmentLink(deviceState));
  Serial.println("BLE Name: " + deviceState.bleName);
  Serial.println("MAC: " + deviceState.macAddress);
}

void loop() {
  if (deviceState.accessPointStarted) {
    webServer.handleClient();
  }
}
