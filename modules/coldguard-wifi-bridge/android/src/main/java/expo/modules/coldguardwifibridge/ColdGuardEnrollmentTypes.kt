package expo.modules.coldguardwifibridge

import org.json.JSONObject

enum class ColdGuardEnrollmentStage(val wireValue: String, val label: String) {
  VALIDATING_REQUEST("validating_request", "Validating setup"),
  FINDING_DEVICE("finding_device", "Finding device"),
  CONNECTING_BLE("connecting_ble", "Connecting over Bluetooth"),
  DISCOVERING_SERVICES("discovering_services", "Discovering Bluetooth services"),
  ESTABLISHING_SECURE_CHANNEL("establishing_secure_channel", "Establishing secure channel"),
  COMPLETING_PAIRING("completing_pairing", "Completing pairing"),
  REQUESTING_TEMPORARY_SOFTAP("requesting_temporary_softap", "Requesting temporary device Wi-Fi"),
  CONNECTING_SOFTAP("connecting_softap", "Connecting to device Wi-Fi"),
  VERIFYING_RUNTIME("verifying_runtime", "Verifying device connection"),
  CLEANING_UP("cleaning_up", "Cleaning up"),
  COMPLETED("completed", "Finished"),
  FAILED("failed", "Failed");
}

data class ColdGuardEnrollmentRequest(
  val actionTicketJson: String,
  val bootstrapToken: String,
  val connectActionTicketJson: String,
  val deviceId: String,
  val handshakeToken: String,
  val institutionId: String,
  val nickname: String,
)

data class ColdGuardEnrollmentProgress(
  val attempt: Int,
  val detail: String?,
  val deviceId: String?,
  val elapsedMs: Long,
  val stage: ColdGuardEnrollmentStage,
) {
  fun toBridgeMap(): Map<String, Any?> = mapOf(
    "attempt" to attempt,
    "detail" to detail,
    "deviceId" to deviceId,
    "elapsedMs" to elapsedMs.toDouble(),
    "stage" to stage.wireValue,
    "stageLabel" to stage.label,
  )
}

data class ColdGuardEnrollmentDiagnostics(
  val attemptsByStageJson: String,
  val detail: String?,
  val deviceId: String?,
  val failureStage: ColdGuardEnrollmentStage?,
  val rawErrorMessage: String?,
  val runtimeBaseUrl: String?,
  val ssid: String?,
  val timelineJson: String,
) {
  fun toBridgeMap(): Map<String, Any?> = mapOf(
    "attemptsByStageJson" to attemptsByStageJson,
    "detail" to detail,
    "deviceId" to deviceId,
    "failureStage" to failureStage?.wireValue,
    "rawErrorMessage" to rawErrorMessage,
    "runtimeBaseUrl" to runtimeBaseUrl,
    "ssid" to ssid,
    "timelineJson" to timelineJson,
  )
}

data class ColdGuardEnrollmentResult(
  val bleName: String,
  val deviceId: String,
  val diagnostics: ColdGuardEnrollmentDiagnostics,
  val firmwareVersion: String,
  val macAddress: String,
  val protocolVersion: Double,
  val runtimeBaseUrl: String,
  val smokeTestPassed: Boolean,
  val softApPassword: String,
  val softApSsid: String,
) {
  fun toBridgeMap(): Map<String, Any?> = mapOf(
    "bleName" to bleName,
    "deviceId" to deviceId,
    "diagnostics" to diagnostics.toBridgeMap(),
    "firmwareVersion" to firmwareVersion,
    "macAddress" to macAddress,
    "protocolVersion" to protocolVersion,
    "runtimeBaseUrl" to runtimeBaseUrl,
    "smokeTestPassed" to smokeTestPassed,
    "softApPassword" to softApPassword,
    "softApSsid" to softApSsid,
  )
}

internal fun coldGuardEnrollmentRequestFromMap(options: Map<String, Any?>): ColdGuardEnrollmentRequest {
  fun requireString(key: String): String {
    val value = options[key] as? String
    if (value.isNullOrBlank()) {
      throw IllegalStateException("ENROLLMENT_${key.uppercase()}_REQUIRED")
    }
    return value
  }

  return ColdGuardEnrollmentRequest(
    actionTicketJson = requireString("actionTicketJson"),
    bootstrapToken = requireString("bootstrapToken"),
    connectActionTicketJson = requireString("connectActionTicketJson"),
    deviceId = requireString("deviceId"),
    handshakeToken = requireString("handshakeToken"),
    institutionId = requireString("institutionId"),
    nickname = requireString("nickname"),
  )
}

internal fun diagnosticsJsonMap(attemptsByStage: Map<String, Int>, timeline: List<Map<String, Any?>>): Pair<String, String> {
  val attemptsJson = JSONObject(attemptsByStage).toString()
  val timelineJson = timeline.fold(org.json.JSONArray()) { array, entry ->
    array.put(JSONObject(entry))
    array
  }.toString()
  return attemptsJson to timelineJson
}
