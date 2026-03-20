package expo.modules.coldguardwifibridge

import android.content.Context
import androidx.core.content.ContextCompat
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ColdGuardWifiBridgeModule : Module() {
  private var wifiSessionController: ColdGuardWifiSessionController? = null

  override fun definition() = ModuleDefinition {
    Name("ColdGuardWifiBridge")

    AsyncFunction("connectToAccessPointAsync") Coroutine { ssid: String, password: String ->
      connectToAccessPoint(ssid, password)
    }

    AsyncFunction("startMonitoringDeviceAsync") { options: Map<String, Any?> ->
      startMonitoringDevice(options)
    }

    AsyncFunction("stopMonitoringDeviceAsync") { deviceId: String ->
      stopMonitoringDevice(deviceId)
    }

    AsyncFunction("getMonitoringStatusesAsync") {
      ColdGuardDeviceMonitoringService.currentStatuses().toBridgeMap()
    }

    AsyncFunction("releaseNetworkBindingAsync") {
      releaseNetworkBinding()
    }
  }

  private suspend fun connectToAccessPoint(ssid: String, password: String): Map<String, String> {
    val context = appContext.reactContext ?: throw IllegalStateException("WIFI_BRIDGE_CONTEXT_UNAVAILABLE")
    val controller = wifiSessionController ?: ColdGuardWifiSessionController(context).also {
      wifiSessionController = it
    }
    val session = controller.connect(ssid, password, bindProcess = true)
    return mapOf(
      "localIp" to session.localIp,
      "ssid" to session.ssid
    )
  }

  private fun releaseNetworkBinding() {
    wifiSessionController?.release(bindProcess = true)
  }

  private fun startMonitoringDevice(options: Map<String, Any?>): Map<String, Any?> {
    val context = appContext.reactContext ?: throw IllegalStateException("WIFI_BRIDGE_CONTEXT_UNAVAILABLE")
    val connectActionTicketJson = options["connectActionTicketJson"] as? String
    val deviceId = options["deviceId"] as? String ?: throw IllegalStateException("MONITOR_DEVICE_ID_REQUIRED")
    val facilityWifiRuntimeBaseUrl = options["facilityWifiRuntimeBaseUrl"] as? String
    val handshakeToken = options["handshakeToken"] as? String
    val transport = options["transport"] as? String ?: "softap"
    val softApSsid = options["softApSsid"] as? String
    val softApPassword = options["softApPassword"] as? String
    val softApRuntimeBaseUrl = options["softApRuntimeBaseUrl"] as? String

    if (!ColdGuardDeviceMonitoringService.canPostNotifications(context)) {
      return ColdGuardDeviceMonitoringService
        .markNotificationPermissionRequired(deviceId, transport)
        .toBridgeMap()
    }

    val intent = ColdGuardDeviceMonitoringService.startIntent(
      context,
      MonitoringOptions(
        connectActionTicketJson = connectActionTicketJson,
        deviceId = deviceId,
        facilityWifiRuntimeBaseUrl = facilityWifiRuntimeBaseUrl,
        handshakeToken = handshakeToken,
        softApPassword = softApPassword,
        softApRuntimeBaseUrl = softApRuntimeBaseUrl,
        softApSsid = softApSsid,
        transport = transport,
      )
    )
    ContextCompat.startForegroundService(context, intent)
    return ColdGuardDeviceMonitoringService.markStarting(deviceId, transport).toBridgeMap()
  }

  private fun stopMonitoringDevice(deviceId: String): Map<String, Any?> {
    val context = appContext.reactContext ?: throw IllegalStateException("WIFI_BRIDGE_CONTEXT_UNAVAILABLE")
    context.startService(ColdGuardDeviceMonitoringService.stopIntent(context, deviceId))
    return ColdGuardDeviceMonitoringService.markStopping(deviceId).toBridgeMap()
  }
}
