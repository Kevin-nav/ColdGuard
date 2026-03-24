package expo.modules.coldguardwifibridge

import org.json.JSONObject

internal class ColdGuardBleJsonAssembler(
  private val maxBufferChars: Int = 8_192,
) {
  private val buffer = StringBuilder()
  private var escaping = false
  private var inString = false
  private var objectDepth = 0
  private var started = false

  fun clear() {
    buffer.setLength(0)
    escaping = false
    inString = false
    objectDepth = 0
    started = false
  }

  fun append(rawValue: String): JSONObject? {
    val sanitizedValue = rawValue.replace("\u0000", "")
    for (character in sanitizedValue) {
      if (!started) {
        if (character != '{') {
          continue
        }
        started = true
        objectDepth = 1
        buffer.append(character)
        continue
      }

      buffer.append(character)
      if (buffer.length > maxBufferChars) {
        clear()
        throw IllegalStateException("BLE_MESSAGE_TOO_LARGE")
      }

      if (escaping) {
        escaping = false
        continue
      }

      if (character == '\\') {
        escaping = true
        continue
      }

      if (character == '"') {
        inString = !inString
        continue
      }

      if (inString) {
        continue
      }

      if (character == '{') {
        objectDepth += 1
        continue
      }

      if (character == '}') {
        objectDepth -= 1
        if (objectDepth < 0) {
          clear()
          throw IllegalStateException("BLE_MESSAGE_JSON_INVALID")
        }
        if (objectDepth == 0) {
          val completeMessage = buffer.toString().trim()
          clear()
          return try {
            JSONObject(completeMessage)
          } catch (_: Exception) {
            throw IllegalStateException("BLE_MESSAGE_JSON_INVALID")
          }
        }
      }
    }

    return null
  }
}
