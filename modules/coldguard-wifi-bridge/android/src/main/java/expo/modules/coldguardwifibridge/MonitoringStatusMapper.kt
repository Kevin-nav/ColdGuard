package expo.modules.coldguardwifibridge

fun MonitoringStatus.toMap(): Map<String, Any?> {
  return mapOf(
    "deviceId" to deviceId,
    "error" to error,
    "isRunning" to isRunning,
    "transport" to transport,
  )
}
