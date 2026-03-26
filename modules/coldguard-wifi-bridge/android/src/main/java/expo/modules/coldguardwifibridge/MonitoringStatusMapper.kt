package expo.modules.coldguardwifibridge

fun MonitoringStatus.toMap(): Map<String, Any?> {
  return mapOf(
    "controlRole" to controlRole,
    "deviceId" to deviceId,
    "error" to error,
    "isRunning" to isRunning,
    "primaryControllerUserId" to primaryControllerUserId,
    "primaryLeaseExpiresAt" to primaryLeaseExpiresAt,
    "primaryLeaseSessionId" to primaryLeaseSessionId,
    "transport" to transport,
  )
}

fun Map<String, MonitoringStatus>.toBridgeMap(): Map<String, Any?> {
  return entries.associate { (deviceId, status) ->
    deviceId to status.toMap()
  }
}
