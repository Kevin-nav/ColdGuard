package expo.modules.coldguardwifibridge

import android.content.Context
import android.net.wifi.WifiManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class ColdGuardWifiBridgeModule : Module() {
  private var wifiSessionController: ColdGuardWifiSessionController? = null
  private val wifiSessionMutex = Mutex()

  override fun definition() = ModuleDefinition {
    Name("ColdGuardWifiBridge")
    Events("onEnrollmentStage")

    AsyncFunction("connectToAccessPointAsync") Coroutine { ssid: String, password: String ->
      connectToAccessPoint(ssid, password)
    }

    AsyncFunction("fetchRuntimeSnapshotAsync") Coroutine { runtimeBaseUrl: String ->
      fetchRuntimeSnapshot(runtimeBaseUrl)
    }

    AsyncFunction("fetchRuntimeHistoryAsync") Coroutine { runtimeBaseUrl: String, afterSequence: Double?, limit: Double? ->
      fetchRuntimeHistory(runtimeBaseUrl, afterSequence?.toLong(), limit?.toInt())
    }

    AsyncFunction("listNearbyColdGuardNetworksAsync") Coroutine {
      listNearbyColdGuardNetworks()
    }

    AsyncFunction("startEnrollmentAsync") Coroutine { options: Map<String, Any?> ->
      startEnrollment(options)
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
    return wifiSessionMutex.withLock {
      val context = appContext.reactContext ?: throw IllegalStateException("WIFI_BRIDGE_CONTEXT_UNAVAILABLE")
      val controller = wifiSessionController ?: ColdGuardWifiSessionController(context).also {
        wifiSessionController = it
      }
      val session = controller.connect(ssid, password, bindProcess = true)
      mapOf(
        "localIp" to session.localIp,
        "ssid" to session.ssid
      )
    }
  }

  private suspend fun fetchRuntimeSnapshot(runtimeBaseUrl: String): Map<String, String> {
    return wifiSessionMutex.withLock {
      val controller = wifiSessionController ?: throw IllegalStateException("WIFI_BRIDGE_SESSION_UNAVAILABLE")
      val network = controller.currentNetwork() ?: throw IllegalStateException("WIFI_BRIDGE_NETWORK_UNAVAILABLE")
      val normalizedRuntimeBaseUrl = normalizeRuntimeBaseUrl(runtimeBaseUrl)
      val failures = mutableListOf<String>()
      val statusJson = try {
        fetchJson("$normalizedRuntimeBaseUrl/api/v1/runtime/status", network)
      } catch (error: IOException) {
        failures += "/api/v1/runtime/status: ${error.message ?: "request failed"}"
        null
      }

      if (statusJson == null) {
        throw IOException("WIFI_BRIDGE_RUNTIME_SNAPSHOT_FAILED ${failures.joinToString("; ")}")
      }

      try {
        val resolvedAlertsJson =
          if (statusJson.contains("\"alerts\"")) {
            statusJson
          } else {
            fetchJson("$normalizedRuntimeBaseUrl/api/v1/runtime/alerts", network)
          }

        return@withLock mapOf(
          "alertsJson" to resolvedAlertsJson,
          "historyJson" to "{\"hasMore\":false,\"nextSequence\":0,\"rows\":[]}",
          "runtimeBaseUrl" to normalizedRuntimeBaseUrl,
          "statusJson" to statusJson,
        )
      } catch (error: IOException) {
        failures += "/api/v1/runtime/alerts: ${error.message ?: "request failed"}"
      }

      if (failures.isNotEmpty()) {
        throw IOException("WIFI_BRIDGE_RUNTIME_SNAPSHOT_FAILED ${failures.joinToString("; ")}")
      }

      throw IOException("WIFI_BRIDGE_ALERTS_RESPONSE_MISSING")
    }
  }

  private suspend fun fetchRuntimeHistory(
    runtimeBaseUrl: String,
    afterSequence: Long?,
    limit: Int?,
  ): Map<String, Any?> {
    return wifiSessionMutex.withLock {
      val controller = wifiSessionController ?: throw IllegalStateException("WIFI_BRIDGE_SESSION_UNAVAILABLE")
      val network = controller.currentNetwork() ?: throw IllegalStateException("WIFI_BRIDGE_NETWORK_UNAVAILABLE")
      val normalizedRuntimeBaseUrl = normalizeRuntimeBaseUrl(runtimeBaseUrl)
      val urlBuilder = StringBuilder("$normalizedRuntimeBaseUrl/api/v1/runtime/history")
      val queryParts = mutableListOf<String>()
      if (afterSequence != null) {
        queryParts += "afterSequence=$afterSequence"
      }
      if (limit != null) {
        queryParts += "limit=$limit"
      }
      if (queryParts.isNotEmpty()) {
        urlBuilder.append("?").append(queryParts.joinToString("&"))
      }

      val historyJson = fetchJson(urlBuilder.toString(), network)
      val page = parseHistoryPage(historyJson)
      mapOf(
        "hasMore" to page.hasMore,
        "nextSequence" to page.nextSequence,
        "rowsJson" to page.rowsJson,
        "runtimeBaseUrl" to normalizedRuntimeBaseUrl,
      )
    }
  }

  private suspend fun listNearbyColdGuardNetworks(): List<String> {
    return withContext(Dispatchers.IO) {
      val context = appContext.reactContext ?: throw IllegalStateException("WIFI_BRIDGE_CONTEXT_UNAVAILABLE")
      val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        ?: throw IllegalStateException("WIFI_MANAGER_UNAVAILABLE")

      try {
        wifiManager.startScan()
      } catch (_: Exception) {
      }

      wifiManager.scanResults
        .asSequence()
        .mapNotNull { result ->
          val ssid = result.SSID?.trim()
          if (ssid.isNullOrEmpty() || !ssid.startsWith("ColdGuard_")) {
            null
          } else {
            ssid to result.level
          }
        }
        .groupBy({ it.first }, { it.second })
        .map { (ssid, levels) -> ssid to (levels.maxOrNull() ?: Int.MIN_VALUE) }
        .sortedByDescending { it.second }
        .map { it.first }
    }
  }

  private suspend fun startEnrollment(options: Map<String, Any?>): Map<String, Any?> {
    return wifiSessionMutex.withLock {
      val context = appContext.reactContext ?: throw IllegalStateException("WIFI_BRIDGE_CONTEXT_UNAVAILABLE")
      val request = coldGuardEnrollmentRequestFromMap(options)
      val controller = ColdGuardBleEnrollmentController(
        context = context,
        wifiSessionController = wifiSessionController ?: ColdGuardWifiSessionController(context).also {
          wifiSessionController = it
        },
        onStage = { progress ->
          sendEvent("onEnrollmentStage", progress.toBridgeMap())
        },
      )
      controller.enroll(request).toBridgeMap()
    }
  }

  private fun releaseNetworkBinding() {
    if (wifiSessionMutex.tryLock()) {
      try {
        wifiSessionController?.release(bindProcess = true)
      } finally {
        wifiSessionMutex.unlock()
      }
      return
    }
  }

  private fun startMonitoringDevice(options: Map<String, Any?>): Map<String, Any?> {
    val context = appContext.reactContext ?: throw IllegalStateException("WIFI_BRIDGE_CONTEXT_UNAVAILABLE")
    val connectActionTicketJson = options["connectActionTicketJson"] as? String
    val controllerClientId = options["controllerClientId"] as? String
    val controllerUserId = options["controllerUserId"] as? String
    val deviceId = options["deviceId"] as? String ?: throw IllegalStateException("MONITOR_DEVICE_ID_REQUIRED")
    val facilityWifiRuntimeBaseUrl = options["facilityWifiRuntimeBaseUrl"] as? String
    val handshakeToken = options["handshakeToken"] as? String
    val heartbeatIntervalMs = (options["heartbeatIntervalMs"] as? Number)?.toLong()
    val leaseDurationMs = (options["leaseDurationMs"] as? Number)?.toLong()
    val primaryLeaseSessionId = options["primaryLeaseSessionId"] as? String
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
        controllerClientId = controllerClientId,
        controllerUserId = controllerUserId,
        connectActionTicketJson = connectActionTicketJson,
        deviceId = deviceId,
        facilityWifiRuntimeBaseUrl = facilityWifiRuntimeBaseUrl,
        handshakeToken = handshakeToken,
        heartbeatIntervalMs = heartbeatIntervalMs,
        leaseDurationMs = leaseDurationMs,
        primaryLeaseSessionId = primaryLeaseSessionId,
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

  private fun normalizeRuntimeBaseUrl(value: String): String {
    return try {
      val url = URL(value)
      "${url.protocol}://${url.host}${if (url.port >= 0) ":${url.port}" else ""}"
    } catch (_: Exception) {
      value.trimEnd('/')
    }
  }

  private suspend fun fetchJson(url: String, network: android.net.Network): String = withContext(Dispatchers.IO) {
    val connection = openConnection(url, network).apply {
      requestMethod = "GET"
      connectTimeout = 10_000
      readTimeout = 10_000
    }

    try {
      val responseCode = connection.responseCode
      val body = readResponseBody(connection, responseCode)
      if (responseCode in 200..299) {
        return@withContext body
      }

      throw IOException("HTTP $responseCode ${body.ifBlank { "<empty body>" }}")
    } finally {
      connection.disconnect()
    }
  }

  private fun readResponseBody(connection: HttpURLConnection, responseCode: Int): String {
    val stream = if (responseCode in 200..299) {
      connection.inputStream
    } else {
      connection.errorStream ?: connection.inputStream
    }

    return stream?.bufferedReader()?.use { it.readText() } ?: ""
  }

  private fun openConnection(url: String, network: android.net.Network): HttpURLConnection {
    return (network.openConnection(URL(url)) as HttpURLConnection)
  }

  private fun parseHistoryPage(body: String): RuntimeHistoryPage {
    val trimmed = body.trim()
    if (trimmed.isEmpty()) {
      return RuntimeHistoryPage("[]", false, 0L)
    }

    val parsed = JSONObject(trimmed)
    val rowsJson = when {
      parsed.has("rowsJson") -> parsed.optString("rowsJson", "[]")
      parsed.has("rows") -> parsed.optJSONArray("rows")?.toString() ?: "[]"
      else -> "[]"
    }
    val hasMore = parsed.optBoolean("hasMore", false)
    val nextSequence = when {
      parsed.has("nextSequence") -> parsed.optLong("nextSequence", 0L)
      parsed.has("next_sequence") -> parsed.optLong("next_sequence", 0L)
      else -> 0L
    }
    return RuntimeHistoryPage(rowsJson, hasMore, nextSequence)
  }

  private data class RuntimeHistoryPage(
    val rowsJson: String,
    val hasMore: Boolean,
    val nextSequence: Long,
  )
}
