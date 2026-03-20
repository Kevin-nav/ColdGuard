package expo.modules.coldguardwifibridge

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Network
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ColdGuardDeviceMonitoringService : Service() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val registryLock = Any()
  private val monitoredDevices = linkedMapOf<String, MonitoredDeviceState>()
  private var bleRecoveryController: ColdGuardBleRecoveryController? = null
  private var pollingJob: Job? = null
  private var wifiController: ColdGuardWifiSessionController? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    bleRecoveryController = ColdGuardBleRecoveryController(this)
    wifiController = ColdGuardWifiSessionController(this)
    ensureNotificationChannels()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        val deviceId = intent.getStringExtra("deviceId") ?: return START_NOT_STICKY
        stopMonitoringDevice(deviceId)
        return START_NOT_STICKY
      }

      ACTION_START -> {
        val nextOptions = MonitoringOptions.fromIntent(intent)
        if (!canPostNotifications(this)) {
          markNotificationPermissionRequired(nextOptions.deviceId, nextOptions.transport)
          stopSelf()
          return START_NOT_STICKY
        }

        registerMonitoring(nextOptions)
        startForeground(NOTIFICATION_ID, buildOngoingNotification(buildServiceStatusText()))
        ensurePolling()
      }
    }

    return START_REDELIVER_INTENT
  }

  override fun onDestroy() {
    stopPolling()
    wifiController?.release(bindProcess = false)
    synchronized(registryLock) {
      monitoredDevices.clear()
    }
    clearAllStatuses()
    scope.cancel()
    super.onDestroy()
  }

  private fun registerMonitoring(options: MonitoringOptions) {
    synchronized(registryLock) {
      val existing = monitoredDevices[options.deviceId]
      val nextAlertCursors = existing?.activeAlertCursors ?: mutableSetOf()
      monitoredDevices[options.deviceId] = MonitoredDeviceState(
        options = options,
        activeAlertCursors = nextAlertCursors,
      )
    }
    updateStatus(
      MonitoringStatus(
        deviceId = options.deviceId,
        error = null,
        isRunning = true,
        transport = options.transport,
      )
    )
  }

  private fun stopMonitoringDevice(deviceId: String) {
    synchronized(registryLock) {
      monitoredDevices.remove(deviceId)
    }
    clearDeviceStatus(deviceId)

    if (hasMonitoredDevices()) {
      updateOngoingNotification()
      ensurePolling()
      return
    }

    stopPolling()
    wifiController?.release(bindProcess = false)
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun ensurePolling() {
    if (pollingJob?.isActive == true) {
      return
    }

    pollingJob = scope.launch {
      while (isActive) {
        val snapshot = synchronized(registryLock) {
          monitoredDevices.values.map { state ->
            MonitoredDeviceState(
              options = state.options,
              activeAlertCursors = state.activeAlertCursors.toMutableSet(),
            )
          }
        }

        if (snapshot.isEmpty()) {
          break
        }

        for (state in snapshot) {
          if (!isActive) {
            break
          }

          val nextResult = pollOnce(state.options, state.activeAlertCursors)
          synchronized(registryLock) {
            monitoredDevices[state.options.deviceId]?.let { liveState ->
              liveState.options = nextResult.options
              liveState.activeAlertCursors.clear()
              liveState.activeAlertCursors.addAll(nextResult.activeAlertCursors)
            }
          }
        }

        delay(POLL_INTERVAL_MS)
      }

      if (!hasMonitoredDevices()) {
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
    }
  }

  private fun stopPolling() {
    pollingJob?.cancel()
    pollingJob = null
  }

  private fun hasMonitoredDevices(): Boolean {
    return synchronized(registryLock) {
      monitoredDevices.isNotEmpty()
    }
  }

  private suspend fun pollOnce(
    currentOptions: MonitoringOptions,
    activeAlertCursors: Set<String>,
  ): MonitoredPollResult {
    try {
      val resolved = resolveRuntimePoll(currentOptions)
      val nextAlertCursors = notifyAlerts(currentOptions.deviceId, resolved.alerts, activeAlertCursors)
      postHeartbeat(resolved.runtimeBaseUrl, resolved.network)
      updateStatus(
        MonitoringStatus(
          deviceId = currentOptions.deviceId,
          error = null,
          isRunning = true,
          transport = resolved.transport,
        )
      )
      updateOngoingNotification()
      return MonitoredPollResult(
        activeAlertCursors = nextAlertCursors,
        options = resolved.nextOptions,
      )
    } catch (error: Exception) {
      updateStatus(
        MonitoringStatus(
          deviceId = currentOptions.deviceId,
          error = error.message ?: "RUNTIME_MONITOR_FAILED",
          isRunning = true,
          transport = currentOptions.transport,
        )
      )
      updateOngoingNotification()
      return MonitoredPollResult(
        activeAlertCursors = activeAlertCursors.toMutableSet(),
        options = currentOptions,
      )
    }
  }

  private suspend fun resolveRuntimePoll(currentOptions: MonitoringOptions): ResolvedRuntimePoll {
    currentOptions.facilityWifiRuntimeBaseUrl
      ?.takeIf { it.isNotBlank() }
      ?.let { runtimeBaseUrl ->
        try {
          return fetchRuntimePoll(
            network = null,
            nextOptions = currentOptions.copy(transport = "facility_wifi"),
            runtimeBaseUrl = runtimeBaseUrl,
            transport = "facility_wifi",
          )
        } catch (_: Exception) {
        }
      }

    val softApRuntimeBaseUrl = currentOptions.softApRuntimeBaseUrl?.takeIf { it.isNotBlank() }
    val softApSsid = currentOptions.softApSsid?.takeIf { it.isNotBlank() }
    val softApPassword = currentOptions.softApPassword?.takeIf { it.isNotBlank() }
    if (softApRuntimeBaseUrl != null && softApSsid != null && softApPassword != null) {
      try {
        return fetchSoftApRuntimePoll(
          nextOptions = currentOptions.copy(transport = "softap"),
          password = softApPassword,
          runtimeBaseUrl = softApRuntimeBaseUrl,
          ssid = softApSsid,
        )
      } catch (_: Exception) {
      }
    }

    updateStatus(
      MonitoringStatus(
        deviceId = currentOptions.deviceId,
        error = null,
        isRunning = true,
        transport = "ble_fallback",
      )
    )
    updateOngoingNotification()

    val recoveredTicket = bleRecoveryController?.requestWifiTicket(currentOptions)
      ?: throw IllegalStateException("BLE_RECOVERY_UNAVAILABLE")
    val recoveredOptions = currentOptions.copy(
      softApPassword = recoveredTicket.password,
      softApRuntimeBaseUrl = recoveredTicket.runtimeBaseUrl,
      softApSsid = recoveredTicket.ssid,
      transport = "softap",
    )
    return fetchSoftApRuntimePoll(
      nextOptions = recoveredOptions,
      password = recoveredTicket.password,
      runtimeBaseUrl = recoveredTicket.runtimeBaseUrl,
      ssid = recoveredTicket.ssid,
    )
  }

  private suspend fun fetchSoftApRuntimePoll(
    nextOptions: MonitoringOptions,
    password: String,
    runtimeBaseUrl: String,
    ssid: String,
  ): ResolvedRuntimePoll {
    val controller = wifiController ?: throw IllegalStateException("WIFI_CONTROLLER_UNAVAILABLE")
    val session = controller.connect(ssid, password, bindProcess = false)

    return try {
      fetchRuntimePoll(
        network = session.network,
        nextOptions = nextOptions,
        runtimeBaseUrl = runtimeBaseUrl,
        transport = "softap",
      )
    } finally {
      controller.release(bindProcess = false)
    }
  }

  private fun fetchRuntimePoll(
    network: Network?,
    nextOptions: MonitoringOptions,
    runtimeBaseUrl: String,
    transport: String,
  ): ResolvedRuntimePoll {
    val normalizedRuntimeBaseUrl = normalizeRuntimeBaseUrl(runtimeBaseUrl)
    val statusJson = JSONObject(fetchJson("$normalizedRuntimeBaseUrl/api/v1/runtime/status", network))
    val alerts = if (statusJson.has("alerts")) {
      statusJson.optJSONArray("alerts") ?: JSONArray()
    } else {
      JSONObject(fetchJson("$normalizedRuntimeBaseUrl/api/v1/runtime/alerts", network))
        .optJSONArray("alerts")
        ?: JSONArray()
    }

    val updatedOptions = when (transport) {
      "facility_wifi" -> nextOptions.copy(
        facilityWifiRuntimeBaseUrl = normalizedRuntimeBaseUrl,
        transport = "facility_wifi",
      )

      "softap" -> nextOptions.copy(
        softApRuntimeBaseUrl = normalizedRuntimeBaseUrl,
        transport = "softap",
      )

      else -> nextOptions
    }

    return ResolvedRuntimePoll(
      alerts = alerts,
      network = network,
      nextOptions = updatedOptions,
      runtimeBaseUrl = normalizedRuntimeBaseUrl,
      statusJson = statusJson,
      transport = transport,
    )
  }

  private fun postHeartbeat(runtimeBaseUrl: String, network: Network?) {
    try {
      val connection = openConnection("$runtimeBaseUrl/api/v1/runtime/heartbeat", network)
      connection.requestMethod = "POST"
      connection.connectTimeout = 10_000
      connection.readTimeout = 10_000
      connection.doOutput = true
      connection.outputStream.use { output ->
        output.write("{}".toByteArray())
      }
      connection.inputStream.use { it.readBytes() }
      connection.disconnect()
    } catch (_: Exception) {
    }
  }

  private fun fetchJson(url: String, network: Network?): String {
    val connection = openConnection(url, network).apply {
      requestMethod = "GET"
      connectTimeout = 10_000
      readTimeout = 10_000
    }
    return try {
      connection.inputStream.bufferedReader().use { it.readText() }
    } finally {
      connection.disconnect()
    }
  }

  private fun openConnection(url: String, network: Network?): HttpURLConnection {
    return ((network?.openConnection(URL(url)) ?: URL(url).openConnection()) as HttpURLConnection)
  }

  private fun notifyAlerts(
    deviceId: String,
    alerts: JSONArray,
    activeAlertCursors: Set<String>,
  ): MutableSet<String> {
    val nextActiveCursors = mutableSetOf<String>()

    for (index in 0 until alerts.length()) {
      val alert = alerts.optJSONObject(index) ?: continue
      val cursor = alert.optString("cursor", "")
      if (cursor.isBlank()) {
        continue
      }

      val status = alert.optString("status", "open")
      if (status == "resolved") {
        continue
      }

      nextActiveCursors.add(cursor)
      if (activeAlertCursors.contains(cursor)) {
        continue
      }

      val title = alert.optString("title", "ColdGuard alert")
      val body = alert.optString("body", "A monitored device needs attention.")
      val severity = alert.optString("severity", "warning")
      val notification = NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
        .setContentTitle(title)
        .setContentText(body)
        .setSmallIcon(android.R.drawable.ic_dialog_alert)
        .setPriority(
          if (severity == "critical") NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT
        )
        .setAutoCancel(true)
        .build()
      notifyIfPermitted((deviceId + cursor).hashCode(), notification)
    }

    return nextActiveCursors
  }

  private fun notifyIfPermitted(notificationId: Int, notification: Notification) {
    if (!canPostNotifications(this)) {
      return
    }
    NotificationManagerCompat.from(this).notify(notificationId, notification)
  }

  private fun updateOngoingNotification() {
    notifyIfPermitted(NOTIFICATION_ID, buildOngoingNotification(buildServiceStatusText()))
  }

  private fun buildServiceStatusText(): String {
    val statuses = currentStatuses().values
    if (statuses.isEmpty()) {
      return "Starting monitor..."
    }

    val activeCount = statuses.count { it.isRunning }
    val recoveringCount = statuses.count { !it.error.isNullOrBlank() }
    return if (recoveringCount > 0) {
      "Monitoring $activeCount devices, $recoveringCount recovering"
    } else {
      "Monitoring $activeCount devices"
    }
  }

  private fun buildOngoingNotification(content: String): Notification {
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("ColdGuard monitoring active")
      .setContentText(content)
      .setOngoing(true)
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  private fun ensureNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "ColdGuard monitoring", NotificationManager.IMPORTANCE_LOW)
    )
    manager.createNotificationChannel(
      NotificationChannel(ALERT_CHANNEL_ID, "ColdGuard alerts", NotificationManager.IMPORTANCE_HIGH)
    )
  }

  private fun normalizeRuntimeBaseUrl(value: String): String {
    return try {
      val url = URL(value)
      "${url.protocol}://${url.host}${if (url.port >= 0) ":${url.port}" else ""}"
    } catch (_: Exception) {
      value.trimEnd('/')
    }
  }

  companion object {
    private const val ACTION_START = "expo.modules.coldguardwifibridge.action.START_MONITORING"
    private const val ACTION_STOP = "expo.modules.coldguardwifibridge.action.STOP_MONITORING"
    private const val ALERT_CHANNEL_ID = "coldguard-monitor-alerts"
    private const val CHANNEL_ID = "coldguard-monitor"
    private const val NOTIFICATION_ID = 4107
    private const val POLL_INTERVAL_MS = 30_000L
    private val statusLock = Any()

    @Volatile
    private var monitoringStatuses: MutableMap<String, MonitoringStatus> = linkedMapOf()

    fun currentStatuses(): Map<String, MonitoringStatus> {
      return synchronized(statusLock) {
        monitoringStatuses.toMap()
      }
    }

    fun startIntent(context: Context, options: MonitoringOptions): Intent {
      return Intent(context, ColdGuardDeviceMonitoringService::class.java).apply {
        action = ACTION_START
        putExtra("connectActionTicketJson", options.connectActionTicketJson)
        putExtra("deviceId", options.deviceId)
        putExtra("facilityWifiRuntimeBaseUrl", options.facilityWifiRuntimeBaseUrl)
        putExtra("handshakeToken", options.handshakeToken)
        putExtra("softApPassword", options.softApPassword)
        putExtra("softApRuntimeBaseUrl", options.softApRuntimeBaseUrl)
        putExtra("softApSsid", options.softApSsid)
        putExtra("transport", options.transport)
      }
    }

    fun stopIntent(context: Context, deviceId: String): Intent {
      return Intent(context, ColdGuardDeviceMonitoringService::class.java).apply {
        action = ACTION_STOP
        putExtra("deviceId", deviceId)
      }
    }

    fun canPostNotifications(context: Context): Boolean {
      return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    }

    fun markStarting(deviceId: String, transport: String): Map<String, MonitoringStatus> {
      updateStatus(
        MonitoringStatus(
          deviceId = deviceId,
          error = null,
          isRunning = true,
          transport = transport,
        )
      )
      return currentStatuses()
    }

    fun markStopping(deviceId: String): Map<String, MonitoringStatus> {
      clearDeviceStatus(deviceId)
      return currentStatuses()
    }

    fun markNotificationPermissionRequired(deviceId: String, transport: String): Map<String, MonitoringStatus> {
      updateStatus(
        MonitoringStatus(
          deviceId = deviceId,
          error = "POST_NOTIFICATIONS_PERMISSION_REQUIRED",
          isRunning = false,
          transport = transport,
        )
      )
      return currentStatuses()
    }

    private fun updateStatus(status: MonitoringStatus) {
      synchronized(statusLock) {
        monitoringStatuses[status.deviceId] = status
      }
    }

    private fun clearDeviceStatus(deviceId: String) {
      synchronized(statusLock) {
        monitoringStatuses.remove(deviceId)
      }
    }

    private fun clearAllStatuses() {
      synchronized(statusLock) {
        monitoringStatuses.clear()
      }
    }
  }
}

data class MonitoringOptions(
  val connectActionTicketJson: String?,
  val deviceId: String,
  val facilityWifiRuntimeBaseUrl: String?,
  val handshakeToken: String?,
  val softApPassword: String?,
  val softApRuntimeBaseUrl: String?,
  val softApSsid: String?,
  val transport: String,
) {
  companion object {
    fun fromIntent(intent: Intent): MonitoringOptions {
      return MonitoringOptions(
        connectActionTicketJson = intent.getStringExtra("connectActionTicketJson"),
        deviceId = intent.getStringExtra("deviceId") ?: throw IllegalStateException("MONITOR_DEVICE_ID_REQUIRED"),
        facilityWifiRuntimeBaseUrl = intent.getStringExtra("facilityWifiRuntimeBaseUrl"),
        handshakeToken = intent.getStringExtra("handshakeToken"),
        softApPassword = intent.getStringExtra("softApPassword"),
        softApRuntimeBaseUrl = intent.getStringExtra("softApRuntimeBaseUrl"),
        softApSsid = intent.getStringExtra("softApSsid"),
        transport = intent.getStringExtra("transport") ?: "softap",
      )
    }
  }
}

data class MonitoringStatus(
  val deviceId: String,
  val error: String?,
  val isRunning: Boolean,
  val transport: String?,
)

data class ResolvedRuntimePoll(
  val alerts: JSONArray,
  val network: Network?,
  val nextOptions: MonitoringOptions,
  val runtimeBaseUrl: String,
  val statusJson: JSONObject,
  val transport: String,
)

private data class MonitoredDeviceState(
  var options: MonitoringOptions,
  val activeAlertCursors: MutableSet<String>,
)

private data class MonitoredPollResult(
  val activeAlertCursors: MutableSet<String>,
  val options: MonitoringOptions,
)
