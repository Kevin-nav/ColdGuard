package expo.modules.coldguardwifibridge

import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class ColdGuardBleJsonAssemblerTest {
  @Test
  fun `reassembles fragmented json responses`() {
    val assembler = ColdGuardBleJsonAssembler()

    assertNull(assembler.append("""{"requestId":"req-1","ok":true"""))

    val response = assembler.append(""","message":"ready"}""")

    assertNotNull(response)
  }

  @Test(expected = IllegalStateException::class)
  fun `rejects oversized payloads`() {
    val assembler = ColdGuardBleJsonAssembler(maxBufferChars = 16)

    assembler.append("""{"requestId":"req-1","message":"too-large"}""")
  }
}
