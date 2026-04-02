package expo.modules.coldguardwifibridge

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ColdGuardBleTransportTest {
  @Test
  fun `keeps small payloads in a single write`() {
    val payload = """{"command":"hello","requestId":"req-1"}"""

    val writes = ColdGuardBleTransport.buildWriteEnvelopes(
      rawPayload = payload,
      requestId = "req-1",
      maxWriteBytes = 244,
    )

    assertEquals(1, writes.size)
    assertEquals(payload, writes.single().payload)
    assertEquals("req-1", writes.single().responseRequestId)
  }

  @Test
  fun `chunks enrollment payloads to the negotiated write budget`() {
    val requestId = "req-1700000000000-123456"
    val payload = buildEnrollPayload(requestId)

    val writes = ColdGuardBleTransport.buildWriteEnvelopes(
      rawPayload = payload,
      requestId = requestId,
      maxWriteBytes = 244,
    )

    assertTrue(writes.size > 1)
    writes.forEachIndexed { index, write ->
      assertTrue(ColdGuardBleTransport.utf8ByteLength(write.payload) <= 244)
      if (index == writes.lastIndex) {
        assertEquals(requestId, write.responseRequestId)
      } else {
        assertNull(write.responseRequestId)
      }
    }
  }

  @Test(expected = IllegalStateException::class)
  fun `throws when mtu is too small for chunk transport`() {
    ColdGuardBleTransport.buildWriteEnvelopes(
      rawPayload = buildEnrollPayload("req-1700000000000-123456"),
      requestId = "req-1700000000000-123456",
      maxWriteBytes = 20,
    )
  }

  private fun buildEnrollPayload(requestId: String): String {
    val actionTicket = """
      {"v":1,"ticketId":"admin-ticket-enroll-CG-ESP32-A100","deviceId":"CG-ESP32-A100","institutionId":"institution-1","action":"enroll","issuedAt":1700000000000,"expiresAt":1700000060000,"counter":1,"operatorId":"firebase-u1","mac":"${"a".repeat(64)}"}
    """.trimIndent()

    return """
      {"command":"enroll.begin","requestId":"$requestId","actionTicket":$actionTicket,"bootstrapToken":"claim-alpha-100","deviceId":"CG-ESP32-A100","handshakeProof":"${"b".repeat(64)}","handshakeToken":"handshake-token","institutionId":"institution-1","nickname":"Cold Room Alpha","proofTimestamp":123456789}
    """.trimIndent()
  }
}
