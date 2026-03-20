package expo.modules.coldguardwifibridge

fun MonitoringStatus.toMap(): Map<String, Any?> {
  return mapOf(
    "deviceId" to deviceId,
    "error" to error,
    "isRunning" to isRunning,
    "transport" to transport,
  )
}

fun Map<String, MonitoringStatus>.toBridgeMap(): Map<String, Any?> {
  return entries.associate { (deviceId, status) ->
    deviceId to status.toMap()
  }
}
