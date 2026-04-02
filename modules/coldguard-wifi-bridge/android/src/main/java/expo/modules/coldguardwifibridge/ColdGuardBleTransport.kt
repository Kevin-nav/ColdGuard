package expo.modules.coldguardwifibridge

import java.nio.charset.StandardCharsets

internal data class ColdGuardBleWriteEnvelope(
  val payload: String,
  val responseRequestId: String?,
)

internal object ColdGuardBleTransport {
  const val REQUESTED_MTU = 517
  private const val DEFAULT_TRANSPORT_CHUNK_CHARS = 120

  fun buildWriteEnvelopes(
    rawPayload: String,
    requestId: String,
    maxWriteBytes: Int,
  ): List<ColdGuardBleWriteEnvelope> {
    if (maxWriteBytes <= 0) {
      throw IllegalStateException("BLE_WRITE_LIMIT_INVALID")
    }

    if (utf8ByteLength(rawPayload) <= maxWriteBytes) {
      return listOf(
        ColdGuardBleWriteEnvelope(
          payload = rawPayload,
          responseRequestId = requestId,
        ),
      )
    }

    val encodedPayload = java.util.Base64.getEncoder().encodeToString(rawPayload.toByteArray(StandardCharsets.UTF_8))
    val envelopes = mutableListOf<ColdGuardBleWriteEnvelope>()
    var cursor = 0
    var chunkIndex = 0

    while (cursor < encodedPayload.length) {
      var nextEnd = minOf(encodedPayload.length, cursor + DEFAULT_TRANSPORT_CHUNK_CHARS)
      var nextEnvelope: ColdGuardBleWriteEnvelope? = null

      while (nextEnd > cursor) {
        val isFinal = nextEnd == encodedPayload.length
        val payload = buildTransportChunkPayload(
          data = encodedPayload.substring(cursor, nextEnd),
          isFinal = isFinal,
          requestId = "chunk-$requestId-$chunkIndex",
          transportId = requestId,
        )
        if (utf8ByteLength(payload) <= maxWriteBytes) {
          nextEnvelope = ColdGuardBleWriteEnvelope(
            payload = payload,
            responseRequestId = if (isFinal) requestId else null,
          )
          cursor = nextEnd
          chunkIndex += 1
          break
        }
        nextEnd -= 1
      }

      if (nextEnvelope == null) {
        throw IllegalStateException("BLE_MTU_TOO_SMALL_FOR_CHUNK_TRANSPORT")
      }

      envelopes += nextEnvelope
    }

    return envelopes
  }

  fun utf8ByteLength(value: String): Int {
    return value.toByteArray(StandardCharsets.UTF_8).size
  }

  private fun buildTransportChunkPayload(
    data: String,
    isFinal: Boolean,
    requestId: String,
    transportId: String,
  ): String {
    return (
      "{"
      + "\"command\":\"transport.chunk\","
      + "\"data\":\"${escapeJson(data)}\","
      + "\"final\":${if (isFinal) "true" else "false"},"
      + "\"requestId\":\"${escapeJson(requestId)}\","
      + "\"transportId\":\"${escapeJson(transportId)}\""
      + "}"
    )
  }

  private fun escapeJson(value: String): String {
    return buildString(value.length + 8) {
      for (character in value) {
        when (character) {
          '\\' -> append("\\\\")
          '"' -> append("\\\"")
          '\b' -> append("\\b")
          '\u000C' -> append("\\f")
          '\n' -> append("\\n")
          '\r' -> append("\\r")
          '\t' -> append("\\t")
          else -> append(character)
        }
      }
    }
  }
}
