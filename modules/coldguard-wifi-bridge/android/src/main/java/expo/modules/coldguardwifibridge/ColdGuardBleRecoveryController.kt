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
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import android.util.Base64
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.util.Locale
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class ColdGuardBleWifiTicket(
  val password: String,
  val runtimeBaseUrl: String,
  val ssid: String,
)

class ColdGuardBleRecoveryController(private val context: Context) {
  suspend fun requestWifiTicket(options: MonitoringOptions): ColdGuardBleWifiTicket = withContext(Dispatchers.IO) {
    ensureBlePermissions()
    val handshakeToken = options.handshakeToken?.takeIf { it.isNotBlank() }
      ?: throw IllegalStateException("BLE_RECOVERY_HANDSHAKE_TOKEN_MISSING")
    val actionTicketJson = options.connectActionTicketJson?.takeIf { it.isNotBlank() }
      ?: throw IllegalStateException("BLE_RECOVERY_CONNECT_TICKET_MISSING")
    val actionTicket = try {
      JSONObject(actionTicketJson)
    } catch (_: Exception) {
      throw IllegalStateException("BLE_RECOVERY_CONNECT_TICKET_INVALID")
    }

    val device = scanForDevice(options.deviceId)
    val session = connect(device)
    try {
      val hello = session.hello(options.deviceId)
      val proofTimestamp = createProofTimestamp(hello)
      val handshakeProof = createHandshakeProof(
        deviceId = options.deviceId,
        deviceNonce = hello.deviceNonce,
        handshakeToken = handshakeToken,
        proofTimestamp = proofTimestamp,
      )

      session.sendCommand(
        command = "grant.verify",
        body = JSONObject().apply {
          put("actionTicket", actionTicket)
          put("deviceId", options.deviceId)
          put("handshakeProof", handshakeProof)
          put("proofTimestamp", proofTimestamp)
        },
      )

      val response = session.sendCommand(
        command = "wifi.ticket.request",
        body = JSONObject(),
      )

      val ssid = response.optString("ssid")
      val password = response.optString("password")
      val testUrl = response.optString("testUrl")
      if (ssid.isBlank() || password.isBlank() || testUrl.isBlank()) {
        throw IllegalStateException("BLE_RECOVERY_WIFI_TICKET_INVALID")
      }

      ColdGuardBleWifiTicket(
        password = password,
        runtimeBaseUrl = normalizeRuntimeBaseUrl(testUrl),
        ssid = ssid,
      )
    } finally {
      session.close()
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

        val filters = listOf(
          ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(COLDGUARD_BLE_SERVICE_UUID))
            .build()
        )
        val settings = ScanSettings.Builder()
          .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
          .build()
        scanner.startScan(filters, settings, callback)
        continuation.invokeOnCancellation {
          if (completed.compareAndSet(false, true)) {
            scanner.stopScan(callback)
          }
        }
      }
    }
  }

  private suspend fun connect(device: BluetoothDevice): ColdGuardBleGattSession {
    return ColdGuardBleGattSession.connect(context, device)
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

  private fun normalizeRuntimeBaseUrl(value: String): String {
    return try {
      val url = java.net.URL(value)
      "${url.protocol}://${url.host}${if (url.port >= 0) ":${url.port}" else ""}"
    } catch (_: Exception) {
      value.trimEnd('/')
    }
  }

  companion object {
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

    private fun encodeBleMessage(jsonPayload: String): String {
      return Base64.encodeToString(jsonPayload.toByteArray(StandardCharsets.UTF_8), Base64.NO_WRAP)
    }

    private fun decodeBleMessage(encodedValue: String): JSONObject {
      val decoded = try {
        Base64.decode(encodedValue, Base64.DEFAULT)
      } catch (_: Exception) {
        throw IllegalStateException("BLE_MESSAGE_BASE64_INVALID")
      }
      val jsonPayload = decoded.toString(StandardCharsets.UTF_8)
      return try {
        JSONObject(jsonPayload)
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

  private data class BleHelloResponse(
    val deviceId: String,
    val deviceNonce: String,
    val deviceTimeMs: Long,
    val receivedAtMs: Long,
  )

  private class ColdGuardBleGattSession(
    private val gatt: BluetoothGatt,
    private val commandCharacteristic: BluetoothGattCharacteristic,
    private val callback: SessionCallback,
  ) {
    suspend fun hello(expectedDeviceId: String): BleHelloResponse {
      val response = sendCommand("hello", JSONObject())
      val deviceId = response.optString("deviceId")
      val deviceNonce = response.optString("deviceNonce")
      val deviceTimeMs = response.optLong("deviceTimeMs", -1L)
      if (deviceId.isBlank() || deviceNonce.isBlank() || deviceTimeMs <= 0L) {
        throw IllegalStateException("BLE_INVALID_HELLO_RESPONSE")
      }
      if (deviceId != expectedDeviceId) {
        throw IllegalStateException("BLE_DEVICE_ID_MISMATCH")
      }
      return BleHelloResponse(
        deviceId = deviceId,
        deviceNonce = deviceNonce,
        deviceTimeMs = deviceTimeMs,
        receivedAtMs = System.currentTimeMillis(),
      )
    }

    suspend fun sendCommand(command: String, body: JSONObject): JSONObject {
      val requestId = "req-${System.currentTimeMillis()}-${(100000..999999).random()}"
      val payload = JSONObject(body.toString()).apply {
        put("command", command)
        put("requestId", requestId)
      }
      val rawPayload = payload.toString()
      val encodedPayload = encodeBleMessage(rawPayload)

      if (utf8ByteLength(rawPayload) <= MAX_BLE_WRITE_BYTES) {
        return writePayload(encodedPayload, requestId, command)
      }

      val chunks = splitTransportPayload(encodedPayload)
      for (index in chunks.indices) {
        val chunkJson = JSONObject().apply {
          put("command", "transport.chunk")
          put("data", chunks[index])
          put("final", index == chunks.lastIndex)
          put("requestId", "chunk-$requestId-$index")
          put("transportId", requestId)
        }

        val response = writePayload(
          payload = encodeBleMessage(chunkJson.toString()),
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

      suspend fun connect(context: Context, device: BluetoothDevice): ColdGuardBleGattSession {
        var lastError: Exception? = null

        for (attempt in 1..CONNECT_RETRY_MAX_ATTEMPTS) {
          var gatt: BluetoothGatt? = null
          try {
            val callback = SessionCallback()
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

    private class SessionCallback : BluetoothGattCallback() {
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
        val deferred = pendingWrite
        pendingWrite = null
        if (status != BluetoothGatt.GATT_SUCCESS) {
          deferred?.completeExceptionally(IllegalStateException("BLE_WRITE_STATUS_$status"))
          return
        }
        deferred?.complete(Unit)
      }

      override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
        val rawValue = characteristic.value?.toString(StandardCharsets.UTF_8) ?: return
        val response = try {
          decodeBleMessage(rawValue)
        } catch (_: Exception) {
          return
        }
        if (pendingResponseId != null && response.optString("requestId") == pendingResponseId) {
          pendingResponseId = null
          val deferred = pendingResponse
          pendingResponse = null
          deferred?.complete(response)
        }
      }
    }
  }
}
