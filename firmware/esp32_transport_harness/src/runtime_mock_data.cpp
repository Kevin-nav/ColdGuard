#include "runtime_mock_data.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

#include <SPIFFS.h>

#include "device_state.h"

#if __has_include(<OneWire.h>) && __has_include(<DallasTemperature.h>)
#include <DallasTemperature.h>
#include <OneWire.h>
#define COLDGUARD_HAS_DS18B20 1
#else
#define COLDGUARD_HAS_DS18B20 0
#endif

#if __has_include(<RTClib.h>)
#include <RTClib.h>
#define COLDGUARD_HAS_RTC 1
#else
#define COLDGUARD_HAS_RTC 0
#endif

namespace coldguard {

namespace {

constexpr uint8_t kTelemetryDs18b20Pin = 17;
constexpr unsigned long kTelemetrySampleIntervalMs = 15UL * 1000UL;
constexpr unsigned long kTelemetryStorageRetryMs = 10UL * 1000UL;
constexpr unsigned long kOfflineWarningMs = 10UL * 60UL * 1000UL;
constexpr unsigned long kOfflineCriticalMs = 30UL * 60UL * 1000UL;
constexpr float kTempWarningC = 5.0f;
constexpr float kTempCriticalC = 8.0f;
constexpr size_t kTelemetryLogMaxBytes = 48UL * 1024UL;
constexpr uint32_t kHistoryPageDefaultLimit = 100U;
constexpr uint32_t kHistoryPageMaxLimit = 250U;
constexpr char kTelemetryLogPath[] = "/telemetry_backlog.csv";
constexpr char kTelemetryLogTmpPath[] = "/telemetry_backlog.tmp";

uint32_t gNextTelemetrySequence = 1;
bool gTelemetryHardwareReady = false;
bool gTelemetryStorageReady = false;
unsigned long gLastTelemetrySampleAtMs = 0;
unsigned long gLastTelemetryStorageRetryAtMs = 0;

#if COLDGUARD_HAS_DS18B20
OneWire gOneWire(kTelemetryDs18b20Pin);
DallasTemperature gTemperatureSensors(&gOneWire);
#endif

#if COLDGUARD_HAS_RTC
RTC_DS3231 gRtc;
#endif

struct TelemetrySample {
  uint32_t sequence = 0;
  uint64_t recordedAtEpochMs = 0;
  String rtcIso;
  String timeSource = "fallback";
  float vaccineTempC = 4.0f;
  String mktStatus = "safe";
  bool temperatureSensorHealthy = false;
  bool rtcHealthy = false;
  bool temperatureCritical = false;
  String sensorHealth;
  String statusText;
};

struct TelemetryHistoryRow {
  uint32_t sequence = 0;
  uint64_t recordedAtEpochMs = 0;
  String rtcIso;
  String timeSource;
  float vaccineTempC = 0.0f;
  String mktStatus;
  bool temperatureSensorHealthy = false;
  bool rtcHealthy = false;
};

String boolText(bool value) {
  return value ? "true" : "false";
}

String normalizeCsvField(const String& value) {
  String normalized = value;
  normalized.replace("\r", "");
  normalized.trim();
  return normalized;
}

String csvFieldAt(const String& line, size_t fieldIndex) {
  size_t currentField = 0;
  int start = 0;
  for (int index = 0; index <= static_cast<int>(line.length()); index++) {
    const bool atEnd = index == static_cast<int>(line.length());
    if (!atEnd && line.charAt(index) != ',') {
      continue;
    }

    if (currentField == fieldIndex) {
      return normalizeCsvField(line.substring(start, index));
    }

    currentField++;
    start = index + 1;
  }

  return "";
}

bool parseBoolField(const String& value) {
  return value == "1" || value.equalsIgnoreCase("true");
}

bool isMktStatusValue(const String& value) {
  return value == "safe" || value == "warning" || value == "alert";
}

uint64_t parseUint64Field(const String& value, uint64_t fallback = 0) {
  if (value.isEmpty()) {
    return fallback;
  }

  char* endPtr = nullptr;
  const uint64_t parsed = std::strtoull(value.c_str(), &endPtr, 10);
  if (endPtr == value.c_str()) {
    return fallback;
  }
  return parsed;
}

String buildSensorHealthSummary(bool temperatureHealthy, bool rtcHealthy) {
  return String("temp=") + boolText(temperatureHealthy) +
         ";rtc=" + boolText(rtcHealthy);
}

String deriveAccessMode(const DeviceState& state) {
  if (state.stationConnected) {
    return "facility_runtime";
  }
  if (state.accessPointStarted) {
    return state.enrollmentState == "enrolled" ? "temporary_shared_access" : "runtime_recovery";
  }
  return "bluetooth_primary";
}

String deriveStatusText(const DeviceState& state) {
  const String deviceLabel = state.deviceNickname.isEmpty() ? state.bleName : state.deviceNickname;
  if (!state.telemetryInitialized) {
    return deviceLabel + " is waiting for the first telemetry sample.";
  }
  if (!state.telemetryTemperatureSensorHealthy || !state.telemetryRtcHealthy) {
    return deviceLabel + " is running with degraded telemetry hardware.";
  }
  if (state.telemetryTemperatureCritical) {
    return deviceLabel + " is in a critical temperature state.";
  }
  return deviceLabel + " is logging real sensor telemetry to internal storage.";
}

String buildTelemetryStatusText(const String& deviceLabel, const TelemetrySample& sample) {
  if (!sample.temperatureSensorHealthy || !sample.rtcHealthy) {
    return deviceLabel + " is running with degraded telemetry hardware.";
  }
  if (sample.temperatureCritical) {
    return deviceLabel + " is in a critical temperature state.";
  }
  return deviceLabel + " is logging real sensor telemetry to internal storage.";
}

bool ensureTelemetryStorageReady() {
  if (gTelemetryStorageReady) {
    return true;
  }

  const unsigned long nowMs = millis();
  if (gLastTelemetryStorageRetryAtMs != 0 &&
      static_cast<long>(nowMs - gLastTelemetryStorageRetryAtMs) < static_cast<long>(kTelemetryStorageRetryMs)) {
    return false;
  }

  gLastTelemetryStorageRetryAtMs = nowMs;
  gTelemetryStorageReady = SPIFFS.begin(true);
  return gTelemetryStorageReady;
}

bool loadTelemetryHistoryLines(std::vector<String>* lines) {
  lines->clear();
  if (!SPIFFS.exists(kTelemetryLogPath)) {
    return true;
  }

  File file = SPIFFS.open(kTelemetryLogPath, FILE_READ);
  if (!file) {
    return false;
  }

  while (file.available()) {
    const String line = normalizeCsvField(file.readStringUntil('\n'));
    if (!line.isEmpty()) {
      lines->push_back(line);
    }
  }

  file.close();
  return true;
}

bool rewriteTelemetryHistoryLines(const std::vector<String>& lines) {
  if (lines.empty()) {
    SPIFFS.remove(kTelemetryLogPath);
    SPIFFS.remove(kTelemetryLogTmpPath);
    return true;
  }

  File file = SPIFFS.open(kTelemetryLogTmpPath, FILE_WRITE);
  if (!file) {
    return false;
  }

  for (const String& line : lines) {
    file.println(line);
  }
  file.close();

  SPIFFS.remove(kTelemetryLogPath);
  if (!SPIFFS.rename(kTelemetryLogTmpPath, kTelemetryLogPath)) {
    SPIFFS.remove(kTelemetryLogTmpPath);
    return false;
  }

  return true;
}

String buildTelemetryRowCsv(const TelemetrySample& sample) {
  String row;
  row.reserve(192);
  row += String(sample.sequence);
  row += ",";
  row += uint64ToString(sample.recordedAtEpochMs);
  row += ",";
  row += sample.rtcIso;
  row += ",";
  row += sample.timeSource;
  row += ",";
  row += String(sample.vaccineTempC, 2);
  row += ",";
  row += sample.mktStatus;
  row += ",";
  row += sample.temperatureSensorHealthy ? "1" : "0";
  row += ",";
  row += sample.rtcHealthy ? "1" : "0";
  return row;
}

bool compactTelemetryHistoryForAppend(const String& newRow) {
  if (newRow.length() + 1 > kTelemetryLogMaxBytes) {
    return false;
  }

  std::vector<String> existingLines;
  if (!loadTelemetryHistoryLines(&existingLines)) {
    return false;
  }

  std::vector<String> retainedLines;
  retainedLines.reserve(existingLines.size() + 1);

  size_t totalBytes = newRow.length() + 1;
  for (auto it = existingLines.rbegin(); it != existingLines.rend(); ++it) {
    const size_t lineBytes = it->length() + 1;
    if (totalBytes + lineBytes > kTelemetryLogMaxBytes) {
      break;
    }

    retainedLines.push_back(*it);
    totalBytes += lineBytes;
  }

  std::reverse(retainedLines.begin(), retainedLines.end());
  retainedLines.push_back(newRow);
  return rewriteTelemetryHistoryLines(retainedLines);
}

bool appendTelemetrySample(const TelemetrySample& sample) {
  if (!ensureTelemetryStorageReady()) {
    return false;
  }

  const String row = buildTelemetryRowCsv(sample);
  size_t currentSize = 0;
  if (SPIFFS.exists(kTelemetryLogPath)) {
    File file = SPIFFS.open(kTelemetryLogPath, FILE_READ);
    if (file) {
      currentSize = file.size();
      file.close();
    }
  }

  if (currentSize + row.length() + 1 <= kTelemetryLogMaxBytes) {
    File appendFile = SPIFFS.open(kTelemetryLogPath, FILE_APPEND);
    if (!appendFile) {
      appendFile = SPIFFS.open(kTelemetryLogPath, FILE_WRITE);
    }
    if (!appendFile) {
      return false;
    }

    appendFile.println(row);
    appendFile.close();
    return true;
  }

  return compactTelemetryHistoryForAppend(row);
}

bool parseTelemetryHistoryRow(const String& line, TelemetryHistoryRow* row) {
  if (line.isEmpty() || line.startsWith("sequence,")) {
    return false;
  }

  const String sequenceText = csvFieldAt(line, 0);
  if (sequenceText.isEmpty()) {
    return false;
  }

  const String mktStatus = csvFieldAt(line, 5);
  if (!isMktStatusValue(mktStatus)) {
    return false;
  }

  row->sequence = static_cast<uint32_t>(sequenceText.toInt());
  row->recordedAtEpochMs = parseUint64Field(csvFieldAt(line, 1));
  row->rtcIso = csvFieldAt(line, 2);
  row->timeSource = csvFieldAt(line, 3);
  row->vaccineTempC = csvFieldAt(line, 4).toFloat();
  row->mktStatus = mktStatus;
  row->temperatureSensorHealthy = parseBoolField(csvFieldAt(line, 6));
  row->rtcHealthy = parseBoolField(csvFieldAt(line, 7));
  return true;
}

String buildTelemetryHistoryRowJson(const TelemetryHistoryRow& row, const String& deviceId) {
  String json;
  json.reserve(380);
  json += "{";
  json += "\"deviceId\":\"";
  json += escapeJson(deviceId);
  json += "\",\"sequence\":";
  json += String(row.sequence);
  json += ",\"recordedAt\":";
  json += uint64ToString(row.recordedAtEpochMs);
  json += ",\"recordedAtEpochMs\":";
  json += uint64ToString(row.recordedAtEpochMs);
  json += ",\"lastSeenAt\":";
  json += uint64ToString(row.recordedAtEpochMs);
  json += ",\"rtcIso\":\"";
  json += escapeJson(row.rtcIso);
  json += "\",\"timeSource\":\"";
  json += escapeJson(row.timeSource);
  json += "\",\"currentTempC\":";
  json += String(row.vaccineTempC, 2);
  json += ",\"vaccineTempC\":";
  json += String(row.vaccineTempC, 2);
  json += ",\"mktStatus\":\"";
  json += escapeJson(row.mktStatus);
  json += "\",\"temperatureSensorHealthy\":";
  json += boolText(row.temperatureSensorHealthy);
  json += ",\"rtcHealthy\":";
  json += boolText(row.rtcHealthy);
  json += "}";
  return json;
}

bool pruneTelemetryHistoryThroughSequence(uint32_t sequence) {
  if (!SPIFFS.exists(kTelemetryLogPath)) {
    return true;
  }

  std::vector<String> retainedLines;
  std::vector<String> lines;
  if (!loadTelemetryHistoryLines(&lines)) {
    return false;
  }

  retainedLines.reserve(lines.size());
  bool changed = false;
  for (const String& line : lines) {
    TelemetryHistoryRow row;
    if (!parseTelemetryHistoryRow(line, &row)) {
      changed = true;
      continue;
    }

    if (row.sequence > sequence) {
      retainedLines.push_back(line);
    } else {
      changed = true;
    }
  }

  if (!changed) {
    return true;
  }

  return rewriteTelemetryHistoryLines(retainedLines);
}

bool sampleRuntimeTelemetry(DeviceState* state, Preferences& preferences) {
  TelemetrySample sample;
  sample.sequence = gNextTelemetrySequence++;
  sample.recordedAtEpochMs = currentDeviceTimeMs();

#if COLDGUARD_HAS_RTC
  if (gRtc.begin()) {
    sample.rtcHealthy = true;
    if (gRtc.lostPower()) {
      gRtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    }
    const DateTime now = gRtc.now();
    sample.recordedAtEpochMs = static_cast<uint64_t>(now.unixtime()) * 1000ULL;
    char isoBuffer[24];
    std::snprintf(
      isoBuffer,
      sizeof(isoBuffer),
      "%04d-%02d-%02dT%02d:%02d:%02dZ",
      now.year(),
      now.month(),
      now.day(),
      now.hour(),
      now.minute(),
      now.second());
    sample.rtcIso = String(isoBuffer);
    sample.timeSource = "rtc";
  } else {
    sample.timeSource = "fallback";
  }
#else
  sample.timeSource = "fallback";
#endif

#if COLDGUARD_HAS_DS18B20
  gTemperatureSensors.begin();
  gTemperatureSensors.setResolution(10);
  gTemperatureSensors.setWaitForConversion(true);
  gTemperatureSensors.requestTemperatures();
  delay(200);
  const float temperature = gTemperatureSensors.getTempCByIndex(0);
  if (temperature != DEVICE_DISCONNECTED_C && temperature > -100.0f && temperature < 100.0f) {
    sample.vaccineTempC = temperature;
    sample.temperatureSensorHealthy = true;
  } else {
    sample.vaccineTempC = state->telemetryTemperatureC;
  }
#else
  sample.vaccineTempC = state->telemetryTemperatureC;
#endif

  sample.temperatureCritical = sample.vaccineTempC >= kTempCriticalC;
  const bool tempWarning = sample.vaccineTempC >= kTempWarningC;
  if (sample.temperatureCritical) {
    sample.mktStatus = "alert";
  } else if (tempWarning) {
    sample.mktStatus = "warning";
  } else {
    sample.mktStatus = "safe";
  }

  sample.sensorHealth = buildSensorHealthSummary(sample.temperatureSensorHealthy, sample.rtcHealthy);
  const String deviceLabel = state->deviceNickname.isEmpty() ? state->bleName : state->deviceNickname;
  sample.statusText = buildTelemetryStatusText(deviceLabel, sample);

  const bool historyWriteOk = appendTelemetrySample(sample);

  state->telemetrySequence = sample.sequence;
  state->telemetryRecordedAtEpochMs = sample.recordedAtEpochMs;
  state->telemetryRtcIso = sample.rtcIso;
  state->telemetryTimeSource = sample.timeSource;
  state->telemetrySensorHealth = sample.sensorHealth;
  state->telemetryStatusText = sample.statusText;
  state->telemetryMktStatus = sample.mktStatus;
  state->telemetryTemperatureC = sample.vaccineTempC;
  state->telemetryTemperatureSensorHealthy = sample.temperatureSensorHealthy;
  state->telemetryRtcHealthy = sample.rtcHealthy;
  state->telemetrySdCardMounted = gTelemetryStorageReady;
  state->telemetryInitialized = true;
  state->telemetryTemperatureCritical = sample.temperatureCritical;
  state->telemetryLastSampleAtMs = millis();
  saveDeviceState(preferences, *state);
  gLastTelemetrySampleAtMs = millis();
  return historyWriteOk;
}

bool shouldSampleTelemetry() {
  if (gLastTelemetrySampleAtMs == 0) {
    return true;
  }

  return static_cast<long>(millis() - gLastTelemetrySampleAtMs) >= static_cast<long>(kTelemetrySampleIntervalMs);
}

}  // namespace

void initializeRuntimeTelemetry(DeviceState* state, Preferences& preferences) {
  if (state == nullptr) {
    return;
  }

  gNextTelemetrySequence = state->telemetrySequence > 0 ? state->telemetrySequence + 1 : 1;
  gTelemetryHardwareReady = true;
  gTelemetryStorageReady = ensureTelemetryStorageReady();

#if COLDGUARD_HAS_DS18B20
  gTemperatureSensors.begin();
  gTemperatureSensors.setResolution(10);
  gTemperatureSensors.setWaitForConversion(true);
#endif

#if COLDGUARD_HAS_RTC
  if (gRtc.begin() && gRtc.lostPower()) {
    gRtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
#endif

  sampleRuntimeTelemetry(state, preferences);
}

void tickRuntimeTelemetry(DeviceState* state, Preferences& preferences) {
  if (state == nullptr) {
    return;
  }

  if (!gTelemetryHardwareReady) {
    initializeRuntimeTelemetry(state, preferences);
    return;
  }

  if (!shouldSampleTelemetry()) {
    return;
  }

  sampleRuntimeTelemetry(state, preferences);
}

RuntimeSnapshot buildRuntimeSnapshot(const DeviceState& state, const String& runtimeBaseUrl) {
  RuntimeSnapshot snapshot;
  snapshot.accessMode = deriveAccessMode(state);
  snapshot.latestSequence = state.telemetrySequence;
  snapshot.recordedAtEpochMs = state.telemetryRecordedAtEpochMs;
  snapshot.rtcIso = state.telemetryRtcIso;
  snapshot.timeSource = state.telemetryTimeSource;
  snapshot.currentTempC = state.telemetryTemperatureC;
  snapshot.mktStatus = state.telemetryMktStatus.isEmpty()
    ? (state.telemetryTemperatureCritical ? "alert" : "safe")
    : state.telemetryMktStatus;
  snapshot.primaryTransport = "bluetooth";
  snapshot.runtimeBaseUrl = runtimeBaseUrl;
  snapshot.secondaryTransport = state.accessPointStarted ? "softap" : "";
  snapshot.softApAvailable = state.accessPointStarted;
  snapshot.softApClientCount = state.accessPointStarted ? 1 : 0;
  snapshot.softApIdleTimeoutMs = state.accessPointStarted ? 60000UL : 0UL;
  snapshot.statusText = state.telemetryStatusText.isEmpty() ? deriveStatusText(state) : state.telemetryStatusText;
  snapshot.stationConnected = state.stationConnected;
  snapshot.transport = state.stationConnected ? "facility_wifi" : (state.accessPointStarted ? "softap" : "ble");
  snapshot.temperatureSensorHealthy = state.telemetryTemperatureSensorHealthy;
  snapshot.rtcHealthy = state.telemetryRtcHealthy;
  snapshot.lastSampleAtMs = state.telemetryLastSampleAtMs;
  snapshot.sensorHealth = state.telemetrySensorHealth;
  return snapshot;
}

String buildRuntimeAlertsJson(const RuntimeSnapshot& snapshot, unsigned long nowMs) {
  String alerts = "[";
  bool needsComma = false;
  const bool temperatureWarning = snapshot.currentTempC >= kTempWarningC;
  const bool temperatureCritical = snapshot.currentTempC >= kTempCriticalC;

  if (temperatureWarning) {
    alerts += "{";
    alerts += "\"cursor\":\"temperature-runtime\",";
    alerts += "\"incidentType\":\"temperature\",";
    alerts += "\"severity\":\"";
    alerts += temperatureCritical ? "critical" : "warning";
    alerts += "\",\"status\":\"open\",";
    alerts += "\"title\":\"Temperature excursion in progress\",";
    alerts += "\"body\":\"Firmware telemetry reported a temperature drift.\",";
    alerts += "\"triggeredAt\":";
    alerts += uint64ToString(snapshot.recordedAtEpochMs);
    alerts += "}";
    needsComma = true;
  }

  const unsigned long sampleAgeMs = snapshot.lastSampleAtMs == 0 ? nowMs : millis() - snapshot.lastSampleAtMs;
  if (sampleAgeMs >= kOfflineWarningMs) {
    if (needsComma) {
      alerts += ",";
    }
    alerts += "{";
    alerts += "\"cursor\":\"device-offline\",";
    alerts += "\"incidentType\":\"device_offline\",";
    alerts += "\"severity\":\"";
    alerts += sampleAgeMs >= kOfflineCriticalMs ? "critical" : "warning";
    alerts += "\",\"status\":\"open\",";
    alerts += "\"title\":\"Device telemetry is stale\",";
    alerts += "\"body\":\"The firmware has not sampled telemetry recently.\",";
    alerts += "\"triggeredAt\":";
    alerts += uint64ToString(snapshot.recordedAtEpochMs);
    alerts += "}";
  }

  alerts += "]";
  return alerts;
}

String buildRuntimeHistoryJson(const DeviceState& state, uint32_t afterSequence, uint32_t limit) {
  const uint32_t boundedLimit = limit == 0 ? kHistoryPageDefaultLimit : (limit > kHistoryPageMaxLimit ? kHistoryPageMaxLimit : limit);
  if (!ensureTelemetryStorageReady() || !SPIFFS.exists(kTelemetryLogPath)) {
    String response;
    response.reserve(180);
    response += "{\"ok\":true,\"deviceId\":\"";
    response += escapeJson(state.deviceId);
    response += "\",\"afterSequence\":";
    response += String(afterSequence);
    response += ",\"nextSequence\":";
    response += String(afterSequence);
    response += ",\"hasMore\":false,\"rows\":[]}";
    return response;
  }

  File file = SPIFFS.open(kTelemetryLogPath, FILE_READ);
  if (!file) {
    String response;
    response.reserve(180);
    response += "{\"ok\":true,\"deviceId\":\"";
    response += escapeJson(state.deviceId);
    response += "\",\"afterSequence\":";
    response += String(afterSequence);
    response += ",\"nextSequence\":";
    response += String(afterSequence);
    response += ",\"hasMore\":false,\"rows\":[]}";
    return response;
  }

  String rows = "[";
  uint32_t nextSequence = afterSequence;
  uint32_t lastIncludedSequence = afterSequence;
  bool hasMore = false;
  uint32_t includedRows = 0;

  while (file.available()) {
    const String line = normalizeCsvField(file.readStringUntil('\n'));
    TelemetryHistoryRow row;
    if (!parseTelemetryHistoryRow(line, &row)) {
      continue;
    }

    if (row.sequence <= afterSequence) {
      continue;
    }

    if (includedRows > 0) {
      rows += ",";
    }
    rows += buildTelemetryHistoryRowJson(row, state.deviceId);
    includedRows++;
    lastIncludedSequence = row.sequence;
    nextSequence = row.sequence;

    if (includedRows >= boundedLimit) {
      hasMore = file.available();
      break;
    }
  }

  file.close();

  nextSequence = includedRows > 0 ? lastIncludedSequence + 1 : afterSequence;

  rows += "]";

  String response;
  response.reserve(200 + rows.length());
  response += "{\"ok\":true,\"deviceId\":\"";
  response += escapeJson(state.deviceId);
  response += "\",\"afterSequence\":";
  response += String(afterSequence);
  response += ",\"nextSequence\":";
  response += String(nextSequence);
  response += ",\"hasMore\":";
  response += String(hasMore ? "true" : "false");
  response += ",\"rows\":";
  response += rows;
  response += "}";
  return response;
}

bool acknowledgeRuntimeHistoryThroughSequence(uint32_t sequence) {
  if (!ensureTelemetryStorageReady()) {
    return false;
  }

  return pruneTelemetryHistoryThroughSequence(sequence);
}

}  // namespace coldguard
