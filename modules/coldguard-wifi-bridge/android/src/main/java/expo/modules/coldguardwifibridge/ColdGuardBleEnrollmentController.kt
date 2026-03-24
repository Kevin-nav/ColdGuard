package expo.modules.coldguardwifibridge

import android.Manifest
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.Locale
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.random.Random

class ColdGuardBleEnrollmentController(
  private val context: Context,
  private val wifiSessionController: ColdGuardWifiSessionController,
  private val onStage: (ColdGuardEnrollmentProgress) -> Unit,
) {
  suspend fun enroll(request: ColdGuardEnrollmentRequest): ColdGuardEnrollmentResult = withContext(Dispatchers.IO) {
    val trace = EnrollmentTrace(request.deviceId, onStage)
    var session: ColdGuardBleGattSession? = null
    var runtimeBaseUrl: String? = null
    var softApSsid: String? = null
    var softApPassword: String? = null

    try {
      trace.emit(ColdGuardEnrollmentStage.VALIDATING_REQUEST, "Checking tokens and enrollment payload.")
      ensureBlePermissions()
      val enrollActionTicket = parseJsonTicket(request.actionTicketJson, "ENROLLMENT_ACTION_TICKET_INVALID")
      val connectActionTicket = parseJsonTicket(request.connectActionTicketJson, "ENROLLMENT_CONNECT_TICKET_INVALID")

      val device = runWithRetries(trace, ColdGuardEnrollmentStage.FINDING_DEVICE, 3) {
        scanForDevice(request.deviceId)
      }

      trace.emit(ColdGuardEnrollmentStage.CONNECTING_BLE, "Opening Bluetooth link to the device.")
      session = ColdGuardBleGattSession.connect(context, device) {
        trace.emit(ColdGuardEnrollmentStage.DISCOVERING_SERVICES, "Reading Bluetooth services from the device.")
      }

      trace.emit(ColdGuardEnrollmentStage.ESTABLISHING_SECURE_CHANNEL, "Exchanging secure handshake details.")
      val hello = session!!.hello(request.deviceId)
      if (hello.state != "blank" && hello.state != "ready") {
        throw IllegalStateException("BLE_DEVICE_STATE_MISMATCH")
      }
      if (!hello.enrollmentReady) {
        throw IllegalStateException("ENROLLMENT_NOT_READY")
      }

      val proofTimestamp = createProofTimestamp(hello)
      val handshakeProof = createHandshakeProof(
        deviceId = request.deviceId,
        deviceNonce = hello.deviceNonce,
        handshakeToken = request.handshakeToken,
        proofTimestamp = proofTimestamp,
      )

      trace.emit(ColdGuardEnrollmentStage.COMPLETING_PAIRING, "Submitting the enrollment request to the device.")
      session!!.sendCommand(
        command = "enroll.begin",
        body = JSONObject().apply {
          put("actionTicket", enrollActionTicket)
          put("bootstrapToken", request.bootstrapToken)
          put("deviceId", request.deviceId)
          put("handshakeProof", handshakeProof)
          put("handshakeToken", request.handshakeToken)
          put("institutionId", request.institutionId)
          put("nickname", request.nickname)
          put("proofTimestamp", proofTimestamp)
        },
      )
      session!!.sendCommand("enroll.commit", JSONObject())

      trace.emit(ColdGuardEnrollmentStage.REQUESTING_TEMPORARY_SOFTAP, "Requesting a temporary device Wi-Fi session.")
      session!!.sendCommand(
        command = "grant.verify",
        body = JSONObject().apply {
          put("actionTicket", connectActionTicket)
          put("deviceId", request.deviceId)
          put("handshakeProof", handshakeProof)
          put("proofTimestamp", proofTimestamp)
        },
      )

      val wifiTicketResponse = session!!.sendCommand("wifi.ticket.request", JSONObject())
      softApSsid = wifiTicketResponse.optString("ssid").takeIf { it.isNotBlank() }
        ?: throw IllegalStateException("BLE_RECOVERY_WIFI_TICKET_INVALID")
      softApPassword = wifiTicketResponse.optString("password").takeIf { it.isNotBlank() }
        ?: throw IllegalStateException("BLE_RECOVERY_WIFI_TICKET_INVALID")
      val testUrl = wifiTicketResponse.optString("testUrl").takeIf { it.isNotBlank() }
        ?: throw IllegalStateException("BLE_RECOVERY_WIFI_TICKET_INVALID")
      runtimeBaseUrl = normalizeRuntimeBaseUrl(testUrl)

      trace.emit(
        ColdGuardEnrollmentStage.CONNECTING_SOFTAP,
        "The phone will briefly switch to the device Wi-Fi to verify setup.",
      )
      runWithRetries(trace, ColdGuardEnrollmentStage.CONNECTING_SOFTAP, 2) {
        wifiSessionController.connect(softApSsid!!, softApPassword!!, bindProcess = true)
      }

      trace.emit(ColdGuardEnrollmentStage.VERIFYING_RUNTIME, "Checking the device runtime endpoint over the temporary Wi-Fi link.")
      runWithRetries(trace, ColdGuardEnrollmentStage.VERIFYING_RUNTIME, 2) {
        fetchRuntimeSnapshot(runtimeBaseUrl!!)
      }

      trace.emit(ColdGuardEnrollmentStage.CLEANING_UP, "Releasing temporary setup resources.")
      trace.emit(ColdGuardEnrollmentStage.COMPLETED, "Device pairing and Wi-Fi smoke test completed.")

      ColdGuardEnrollmentResult(
        bleName = hello.bleName,
        deviceId = hello.deviceId,
        diagnostics = trace.buildDiagnostics(
          detail = "Enrollment completed successfully.",
          failureStage = null,
          rawErrorMessage = null,
          runtimeBaseUrl = runtimeBaseUrl,
          ssid = softApSsid,
        ),
        firmwareVersion = hello.firmwareVersion,
        macAddress = hello.macAddress,
        protocolVersion = hello.protocolVersion.toDouble(),
        runtimeBaseUrl = runtimeBaseUrl,
        smokeTestPassed = true,
        softApPassword = softApPassword,
        softApSsid = softApSsid,
      )
    } catch (error: Exception) {
      trace.emit(
        ColdGuardEnrollmentStage.FAILED,
        error.message ?: "Native enrollment failed.",
      )
      throw error
    } finally {
      try {
        wifiSessionController.release(bindProcess = true)
      } catch (_: Exception) {
      }
      try {
        session?.close()
      } catch (_: Exception) {
      }
    }
  }

  private fun ensureBlePermissions() {
    val requiredPermissions = buildList {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        add(Manifest.permission.BLUETOOTH_CONNECT)
        add(Manifest.permission.BLUETOOTH_SCAN)
      } else {
        add(Manifest.permission.ACCESS_FINE_LOCATION)
      }
    }

    val denied = requiredPermissions.any { permission ->
      ContextCompat.checkSelfPermission(context, permission) != PackageManager.PERMISSION_GRANTED
    }
    if (denied) {
      throw IllegalStateException("BLE_PERMISSION_REQUIRED")
    }
  }

  private fun parseJsonTicket(value: String, errorCode: String): JSONObject {
    return try {
      JSONObject(value)
    } catch (_: Exception) {
      throw IllegalStateException(errorCode)
    }
  }

  private suspend fun scanForDevice(expectedDeviceId: String): BluetoothDevice {
    val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    val adapter = bluetoothManager.adapter ?: throw IllegalStateException("BLE_ADAPTER_UNAVAILABLE")
    if (!adapter.isEnabled) {
      throw IllegalStateException("BLE_ADAPTER_DISABLED")
    }
    val scanner = adapter.bluetoothLeScanner ?: throw IllegalStateException("BLE_SCANNER_UNAVAILABLE")

    return withTimeout(SCAN_TIMEOUT_MS) {
      suspendCancellableCoroutine { continuation ->
        val completed = AtomicBoolean(false)
        val callback = object : ScanCallback() {
          override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device ?: return
            val advertisedDeviceId = parseDeviceIdFromServiceData(result)
            Log.d(
              LOG_TAG,
              "[scan_result] name=${device.name ?: "<unknown>"} address=${device.address} advertisedDeviceId=${advertisedDeviceId ?: "<none>"} expectedDeviceId=$expectedDeviceId",
            )
            if (!doesDeviceMatchExpectedId(result, device, expectedDeviceId)) {
              return
            }

            if (!completed.compareAndSet(false, true)) {
              return
            }
            scanner.stopScan(this)
            continuation.resume(device)
          }

          override fun onScanFailed(errorCode: Int) {
            if (!completed.compareAndSet(false, true)) {
              return
            }
            scanner.stopScan(this)
            continuation.resumeWithException(IllegalStateException("BLE_SCAN_FAILED_$errorCode"))
          }
        }
        val settings = ScanSettings.Builder()
          .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
          .build()
        scanner.startScan(null, settings, callback)
        continuation.invokeOnCancellation {
          if (completed.compareAndSet(false, true)) {
            scanner.stopScan(callback)
          }
        }
      }
    }
  }

  private fun createProofTimestamp(hello: BleHelloResponse): Long {
    val elapsedSinceHelloMs = maxOf(0L, System.currentTimeMillis() - hello.receivedAtMs)
    return hello.deviceTimeMs + elapsedSinceHelloMs
  }

  private fun createHandshakeProof(
    deviceId: String,
    deviceNonce: String,
    handshakeToken: String,
    proofTimestamp: Long,
  ): String {
    val canonical = "$deviceNonce|$deviceId|$proofTimestamp"
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(handshakeToken.toByteArray(StandardCharsets.UTF_8), "HmacSHA256"))
    return mac.doFinal(canonical.toByteArray(StandardCharsets.UTF_8)).joinToString("") {
      "%02x".format(Locale.US, it)
    }
  }

  private fun doesDeviceMatchExpectedId(result: ScanResult, device: BluetoothDevice, expectedDeviceId: String): Boolean {
    val advertisedDeviceId = parseDeviceIdFromServiceData(result)
    if (advertisedDeviceId == expectedDeviceId) {
      return true
    }

    val expectedSuffix = expectedDeviceId.takeLast(4).uppercase(Locale.US)
    val deviceName = device.name?.uppercase(Locale.US)
    return deviceName?.contains(expectedSuffix) == true || device.address == expectedDeviceId
  }

  private fun parseDeviceIdFromServiceData(result: ScanResult): String? {
    val scanRecord = result.scanRecord ?: return null
    val serviceData = scanRecord.serviceData ?: return null

    for (entry in serviceData.entries) {
      val rawBytes = entry.value ?: continue
      val payload = try {
        String(rawBytes, StandardCharsets.UTF_8)
      } catch (_: Exception) {
        continue
      }

      for (pair in payload.split(";")) {
        val index = pair.indexOf("=")
        if (index <= 0) {
          continue
        }
        val key = pair.substring(0, index).trim()
        if (!key.equals("id", ignoreCase = true)) {
          continue
        }
        val value = pair.substring(index + 1).trim()
        if (value.isNotBlank()) {
          return value
        }
      }
    }

    return null
  }

  private suspend fun fetchRuntimeSnapshot(runtimeBaseUrl: String): Map<String, String> {
    val network = wifiSessionController.currentNetwork() ?: throw IllegalStateException("WIFI_BRIDGE_NETWORK_UNAVAILABLE")
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

      return mapOf(
        "alertsJson" to resolvedAlertsJson,
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

  private suspend fun fetchJson(url: String, network: android.net.Network): String = withContext(Dispatchers.IO) {
    val connection = (network.openConnection(URL(url)) as HttpURLConnection).apply {
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

  private fun normalizeRuntimeBaseUrl(value: String): String {
    return try {
      val url = URL(value)
      "${url.protocol}://${url.host}${if (url.port >= 0) ":${url.port}" else ""}"
    } catch (_: Exception) {
      value.trimEnd('/')
    }
  }

  private suspend fun <T> runWithRetries(
    trace: EnrollmentTrace,
    stage: ColdGuardEnrollmentStage,
    maxAttempts: Int,
    block: suspend () -> T,
  ): T {
    var lastError: Exception? = null
    for (attempt in 1..maxAttempts) {
      trace.emit(stage, "Attempt $attempt of $maxAttempts.")
      try {
        return block()
      } catch (error: Exception) {
        lastError = error
        if (attempt >= maxAttempts) {
          break
        }
        delay(750L)
      }
    }
    throw lastError ?: IllegalStateException("${stage.wireValue.uppercase(Locale.US)}_FAILED")
  }

  companion object {
    private const val LOG_TAG = "ColdGuardEnrollment"
    private const val MAX_BLE_WRITE_BYTES = 180
    private const val RESPONSE_TIMEOUT_MS = 8_000L
    private const val SCAN_TIMEOUT_MS = 12_000L
    private const val TRANSPORT_CHUNK_BYTES = 120
    private val COLDGUARD_BLE_COMMAND_CHARACTERISTIC_UUID =
      UUID.fromString("6B8F7B61-8B30-4A70-BD9A-44B4C1D7C111")
    private val COLDGUARD_BLE_RESPONSE_CHARACTERISTIC_UUID =
      UUID.fromString("6B8F7B61-8B30-4A70-BD9A-44B4C1D7C112")
    private val COLDGUARD_BLE_SERVICE_UUID =
      UUID.fromString("6B8F7B61-8B30-4A70-BD9A-44B4C1D7C110")
    private val CLIENT_CHARACTERISTIC_CONFIG_UUID =
      UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    private fun encodeTransportPayload(jsonPayload: String): String {
      return java.util.Base64.getEncoder().withoutPadding().encodeToString(jsonPayload.toByteArray(StandardCharsets.UTF_8))
    }

    private fun decodeBleMessage(rawValue: String): JSONObject {
      val sanitizedValue = rawValue
        .replace("\u0000", "")
        .trim()
        .let { candidate ->
          val objectStart = candidate.indexOf('{')
          val objectEnd = candidate.lastIndexOf('}')
          if (objectStart >= 0 && objectEnd >= objectStart) {
            candidate.substring(objectStart, objectEnd + 1)
          } else {
            candidate
          }
        }
      return try {
        JSONObject(sanitizedValue)
      } catch (_: Exception) {
        throw IllegalStateException("BLE_MESSAGE_JSON_INVALID")
      }
    }

    private fun splitTransportPayload(value: String, chunkSize: Int = TRANSPORT_CHUNK_BYTES): List<String> {
      val chunks = mutableListOf<String>()
      var index = 0
      while (index < value.length) {
        val nextEnd = minOf(value.length, index + chunkSize)
        chunks += value.substring(index, nextEnd)
        index = nextEnd
      }
      return chunks
    }

    private fun utf8ByteLength(value: String): Int {
      return value.toByteArray(StandardCharsets.UTF_8).size
    }
  }

  private class EnrollmentTrace(
    private val deviceId: String,
    private val onStage: (ColdGuardEnrollmentProgress) -> Unit,
  ) {
    private val startedAtMs = System.currentTimeMillis()
    private val attemptsByStage = linkedMapOf<String, Int>()
    private val timeline = mutableListOf<Map<String, Any?>>()

    fun emit(stage: ColdGuardEnrollmentStage, detail: String?) {
      val nextAttempt = (attemptsByStage[stage.wireValue] ?: 0) + 1
      attemptsByStage[stage.wireValue] = nextAttempt
      val elapsedMs = System.currentTimeMillis() - startedAtMs
      val event = ColdGuardEnrollmentProgress(
        attempt = nextAttempt,
        detail = detail,
        deviceId = deviceId,
        elapsedMs = elapsedMs,
        stage = stage,
      )
      timeline += mapOf(
        "attempt" to nextAttempt,
        "detail" to detail,
        "elapsedMs" to elapsedMs.toDouble(),
        "stage" to stage.wireValue,
        "stageLabel" to stage.label,
      )
      Log.d(LOG_TAG, "[${stage.wireValue}] attempt=$nextAttempt elapsedMs=$elapsedMs detail=${detail ?: ""}")
      onStage(event)
    }

    fun buildDiagnostics(
      detail: String?,
      failureStage: ColdGuardEnrollmentStage?,
      rawErrorMessage: String?,
      runtimeBaseUrl: String?,
      ssid: String?,
    ): ColdGuardEnrollmentDiagnostics {
      val (attemptsJson, timelineJson) = diagnosticsJsonMap(attemptsByStage, timeline)
      return ColdGuardEnrollmentDiagnostics(
        attemptsByStageJson = attemptsJson,
        detail = detail,
        deviceId = deviceId,
        failureStage = failureStage,
        rawErrorMessage = rawErrorMessage,
        runtimeBaseUrl = runtimeBaseUrl,
        ssid = ssid,
        timelineJson = timelineJson,
      )
    }
  }

  private data class BleHelloResponse(
    val bleName: String,
    val deviceId: String,
    val deviceNonce: String,
    val deviceTimeMs: Long,
    val enrollmentReady: Boolean,
    val firmwareVersion: String,
    val macAddress: String,
    val protocolVersion: Int,
    val receivedAtMs: Long,
    val state: String,
  )

  private class ColdGuardBleGattSession(
    private val gatt: BluetoothGatt,
    private val commandCharacteristic: BluetoothGattCharacteristic,
    private val callback: SessionCallback,
  ) {
    suspend fun hello(expectedDeviceId: String): BleHelloResponse {
      val response = sendCommand("hello", JSONObject())
      val bleName = response.optString("bleName")
      val deviceId = response.optString("deviceId")
      val deviceNonce = response.optString("deviceNonce")
      val deviceTimeMs = response.optLong("deviceTimeMs", -1L)
      val enrollmentReady = response.optBoolean("enrollmentReady", false)
      val firmwareVersion = response.optString("firmwareVersion")
      val macAddress = response.optString("macAddress")
      val protocolVersion = response.optInt("protocolVersion", 0)
      val state = response.optString("state")
      if (
        bleName.isBlank() ||
        deviceId.isBlank() ||
        deviceNonce.isBlank() ||
        deviceTimeMs <= 0L ||
        firmwareVersion.isBlank() ||
        macAddress.isBlank() ||
        protocolVersion <= 0 ||
        state.isBlank()
      ) {
        throw IllegalStateException("BLE_INVALID_HELLO_RESPONSE")
      }
      if (deviceId != expectedDeviceId) {
        throw IllegalStateException("BLE_DEVICE_ID_MISMATCH")
      }
      return BleHelloResponse(
        bleName = bleName,
        deviceId = deviceId,
        deviceNonce = deviceNonce,
        deviceTimeMs = deviceTimeMs,
        enrollmentReady = enrollmentReady,
        firmwareVersion = firmwareVersion,
        macAddress = macAddress,
        protocolVersion = protocolVersion,
        receivedAtMs = System.currentTimeMillis(),
        state = state,
      )
    }

    suspend fun sendCommand(command: String, body: JSONObject): JSONObject {
      val requestId = "req-${System.currentTimeMillis()}-${Random.nextInt(100000, 999999)}"
      val payload = JSONObject(body.toString()).apply {
        put("command", command)
        put("requestId", requestId)
      }
      val rawPayload = payload.toString()
      if (utf8ByteLength(rawPayload) <= MAX_BLE_WRITE_BYTES) {
        return writePayload(rawPayload, requestId, command)
      }

      val chunks = splitTransportPayload(encodeTransportPayload(rawPayload))
      for (index in chunks.indices) {
        val chunkJson = JSONObject().apply {
          put("command", "transport.chunk")
          put("data", chunks[index])
          put("final", index == chunks.lastIndex)
          put("requestId", "chunk-$requestId-$index")
          put("transportId", requestId)
        }

        val response = writePayload(
          payload = chunkJson.toString(),
          requestId = if (index == chunks.lastIndex) requestId else null,
          command = command,
        )
        if (index == chunks.lastIndex) {
          return response
        }
      }

      throw IllegalStateException("BLE_CHUNK_DISPATCH_FAILED [$command]")
    }

    fun close() {
      callback.close()
      try {
        gatt.disconnect()
      } catch (_: Exception) {
      }
      try {
        gatt.close()
      } catch (_: Exception) {
      }
    }

    private suspend fun writePayload(payload: String, requestId: String?, command: String): JSONObject {
      if (requestId != null) {
        callback.awaitResponse(requestId)
      } else {
        callback.clearPendingResponse()
      }

      val writeDeferred = callback.prepareWrite()
      commandCharacteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
      @Suppress("DEPRECATION")
      commandCharacteristic.value = payload.toByteArray(StandardCharsets.UTF_8)
      @Suppress("DEPRECATION")
      val writeStarted = gatt.writeCharacteristic(commandCharacteristic)
      if (!writeStarted) {
        callback.clearPendingResponse()
        callback.clearPendingWrite()
        throw IllegalStateException("BLE_WRITE_FAILED [$command]")
      }

      withTimeout(RESPONSE_TIMEOUT_MS) {
        writeDeferred.await()
      }

      if (requestId == null) {
        return JSONObject()
      }

      val response = withTimeout(RESPONSE_TIMEOUT_MS) {
        callback.pendingResponse?.await()
      } ?: throw IllegalStateException("BLE_RESPONSE_TIMEOUT_${command.uppercase(Locale.US).replace('.', '_')}")

      if (!response.optBoolean("ok", false)) {
        val errorCode = response.optString("errorCode").takeIf { it.isNotBlank() }
        val message = response.optString("message").takeIf { it.isNotBlank() }
        throw IllegalStateException(errorCode ?: message ?: "BLE_COMMAND_FAILED")
      }

      return response
    }

    companion object {
      private const val CONNECT_RETRY_DELAY_MS = 750L
      private const val CONNECT_RETRY_MAX_ATTEMPTS = 3

      suspend fun connect(
        context: Context,
        device: BluetoothDevice,
        onDiscoveringServices: () -> Unit,
      ): ColdGuardBleGattSession {
        var lastError: Exception? = null

        for (attempt in 1..CONNECT_RETRY_MAX_ATTEMPTS) {
          var gatt: BluetoothGatt? = null
          try {
            val callback = SessionCallback(onDiscoveringServices)
            gatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
              device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
            } else {
              @Suppress("DEPRECATION")
              device.connectGatt(context, false, callback)
            } ?: throw IllegalStateException("BLE_GATT_CONNECT_FAILED")

            val services = withTimeout(15_000L) {
              callback.servicesDiscovered.await()
            }
            val service = services.firstOrNull { it.uuid == COLDGUARD_BLE_SERVICE_UUID }
              ?: throw IllegalStateException("BLE_SERVICE_NOT_FOUND")
            val commandCharacteristic = service.getCharacteristic(COLDGUARD_BLE_COMMAND_CHARACTERISTIC_UUID)
              ?: throw IllegalStateException("BLE_COMMAND_CHARACTERISTIC_NOT_FOUND")
            val responseCharacteristic = service.getCharacteristic(COLDGUARD_BLE_RESPONSE_CHARACTERISTIC_UUID)
              ?: throw IllegalStateException("BLE_RESPONSE_CHARACTERISTIC_NOT_FOUND")

            val notificationsEnabled = gatt.setCharacteristicNotification(responseCharacteristic, true)
            if (!notificationsEnabled) {
              throw IllegalStateException("BLE_NOTIFICATION_ENABLE_FAILED")
            }
            val descriptor = responseCharacteristic.getDescriptor(CLIENT_CHARACTERISTIC_CONFIG_UUID)
              ?: throw IllegalStateException("BLE_RESPONSE_DESCRIPTOR_NOT_FOUND")
            descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            callback.prepareDescriptorWrite()
            @Suppress("DEPRECATION")
            val descriptorWriteStarted = gatt.writeDescriptor(descriptor)
            if (!descriptorWriteStarted) {
              callback.clearPendingDescriptorWrite()
              throw IllegalStateException("BLE_DESCRIPTOR_WRITE_FAILED")
            }
            withTimeout(RESPONSE_TIMEOUT_MS) {
              callback.pendingDescriptorWrite?.await()
            }

            return ColdGuardBleGattSession(
              gatt = gatt,
              commandCharacteristic = commandCharacteristic,
              callback = callback,
            )
          } catch (error: Exception) {
            lastError = error
            try {
              gatt?.disconnect()
            } catch (_: Exception) {
            }
            try {
              gatt?.close()
            } catch (_: Exception) {
            }
            if (attempt < CONNECT_RETRY_MAX_ATTEMPTS && isTransientConnectError(error)) {
              delay(CONNECT_RETRY_DELAY_MS)
              continue
            }
            throw error
          }
        }

        throw lastError ?: IllegalStateException("BLE_GATT_CONNECT_FAILED")
      }

      private fun isTransientConnectError(error: Exception): Boolean {
        val message = error.message?.lowercase(Locale.US) ?: return false
        return message.contains("not_found") ||
          message.contains("discover") ||
          message.contains("gatt") ||
          message.contains("disconnected")
      }
    }

    private class SessionCallback(
      private val onDiscoveringServices: () -> Unit,
    ) : BluetoothGattCallback() {
      val servicesDiscovered = CompletableDeferred<List<BluetoothGattService>>()
      var pendingDescriptorWrite: CompletableDeferred<Unit>? = null
        private set
      var pendingResponse: CompletableDeferred<JSONObject>? = null
        private set
      private var pendingResponseId: String? = null
      private var pendingWrite: CompletableDeferred<Unit>? = null

      fun prepareDescriptorWrite() {
        pendingDescriptorWrite = CompletableDeferred()
      }

      fun clearPendingDescriptorWrite() {
        pendingDescriptorWrite?.cancel()
        pendingDescriptorWrite = null
      }

      fun prepareWrite(): CompletableDeferred<Unit> {
        pendingWrite?.cancel()
        return CompletableDeferred<Unit>().also {
          pendingWrite = it
        }
      }

      fun clearPendingWrite() {
        pendingWrite?.cancel()
        pendingWrite = null
      }

      fun awaitResponse(requestId: String) {
        pendingResponse?.cancel()
        pendingResponseId = requestId
        pendingResponse = CompletableDeferred()
      }

      fun clearPendingResponse() {
        pendingResponse?.cancel()
        pendingResponse = null
        pendingResponseId = null
      }

      fun close() {
        clearPendingDescriptorWrite()
        clearPendingWrite()
        clearPendingResponse()
      }

      override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
          val error = IllegalStateException("BLE_GATT_STATUS_$status")
          if (!servicesDiscovered.isCompleted) {
            servicesDiscovered.completeExceptionally(error)
          }
          close()
          return
        }

        when (newState) {
          BluetoothProfile.STATE_CONNECTED -> {
            onDiscoveringServices()
            if (!gatt.discoverServices() && !servicesDiscovered.isCompleted) {
              servicesDiscovered.completeExceptionally(IllegalStateException("BLE_DISCOVER_SERVICES_FAILED"))
            }
          }

          BluetoothProfile.STATE_DISCONNECTED -> {
            val error = IllegalStateException("BLE_GATT_DISCONNECTED")
            if (!servicesDiscovered.isCompleted) {
              servicesDiscovered.completeExceptionally(error)
            }
            pendingDescriptorWrite?.completeExceptionally(error)
            pendingWrite?.completeExceptionally(error)
            pendingResponse?.completeExceptionally(error)
            close()
          }
        }
      }

      override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
        if (status != BluetoothGatt.GATT_SUCCESS) {
          if (!servicesDiscovered.isCompleted) {
            servicesDiscovered.completeExceptionally(IllegalStateException("BLE_DISCOVER_SERVICES_STATUS_$status"))
          }
          return
        }

        if (!servicesDiscovered.isCompleted) {
          servicesDiscovered.complete(gatt.services)
        }
      }

      override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
        Log.d(LOG_TAG, "[descriptor_write] status=$status uuid=${descriptor.uuid}")
        val deferred = pendingDescriptorWrite
        pendingDescriptorWrite = null
        if (status != BluetoothGatt.GATT_SUCCESS) {
          deferred?.completeExceptionally(IllegalStateException("BLE_DESCRIPTOR_WRITE_STATUS_$status"))
          return
        }
        deferred?.complete(Unit)
      }

      override fun onCharacteristicWrite(
        gatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        status: Int,
      ) {
        Log.d(LOG_TAG, "[characteristic_write] status=$status uuid=${characteristic.uuid}")
        val deferred = pendingWrite
        pendingWrite = null
        if (status != BluetoothGatt.GATT_SUCCESS) {
          deferred?.completeExceptionally(IllegalStateException("BLE_WRITE_STATUS_$status"))
          return
        }
        deferred?.complete(Unit)
      }

      private fun handleCharacteristicChanged(rawBytes: ByteArray?) {
        val rawValue = rawBytes?.toString(StandardCharsets.UTF_8) ?: return
        Log.d(
          LOG_TAG,
          "[characteristic_changed] bytes=${rawBytes.size} payload=${rawValue.replace("\u0000", "\\0")}",
        )
        val response = try {
          decodeBleMessage(rawValue)
        } catch (error: Exception) {
          Log.w(LOG_TAG, "[characteristic_changed_parse_failed] message=${error.message}")
          return
        }
        if (pendingResponseId != null && response.optString("requestId") == pendingResponseId) {
          pendingResponseId = null
          val deferred = pendingResponse
          pendingResponse = null
          deferred?.complete(response)
          Log.d(LOG_TAG, "[characteristic_changed_matched] requestId=${response.optString("requestId")}")
        } else {
          Log.d(
            LOG_TAG,
            "[characteristic_changed_unmatched] expected=${pendingResponseId ?: "<none>"} actual=${response.optString("requestId")}",
          )
        }
      }

      override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
        handleCharacteristicChanged(characteristic.value)
      }

      override fun onCharacteristicChanged(
        gatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        value: ByteArray,
      ) {
        handleCharacteristicChanged(value)
      }
    }
  }
}
