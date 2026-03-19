package expo.modules.coldguardwifibridge

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class ColdGuardWifiSession(
  val localIp: String,
  val network: Network,
  val ssid: String,
)

class ColdGuardWifiSessionController(private val context: Context) {
  private val connectivityManager =
    context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
  private var activeNetwork: Network? = null
  private var activeNetworkCallback: ConnectivityManager.NetworkCallback? = null

  suspend fun connect(ssid: String, password: String, bindProcess: Boolean): ColdGuardWifiSession {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      throw IllegalStateException("WIFI_NETWORK_SPECIFIER_REQUIRES_ANDROID_10")
    }

    release(bindProcess)

    val wifiSpecifier = WifiNetworkSpecifier.Builder()
      .setSsid(ssid)
      .setWpa2Passphrase(password)
      .build()

    val request = NetworkRequest.Builder()
      .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
      .setNetworkSpecifier(wifiSpecifier)
      .build()

    return suspendCancellableCoroutine { continuation ->
      val handler = Handler(Looper.getMainLooper())
      lateinit var timeoutRunnable: Runnable
      lateinit var callback: ConnectivityManager.NetworkCallback

      fun clearRequestedNetworkBinding() {
        handler.removeCallbacks(timeoutRunnable)
        try {
          connectivityManager.unregisterNetworkCallback(callback)
        } catch (_: Exception) {
        }

        if (bindProcess) {
          connectivityManager.bindProcessToNetwork(null)
        }

        if (activeNetworkCallback === callback) {
          activeNetworkCallback = null
          activeNetwork = null
        }
      }

      timeoutRunnable = Runnable {
        clearRequestedNetworkBinding()
        if (continuation.isActive) {
          continuation.resumeWithException(IllegalStateException("WIFI_AP_TIMEOUT"))
        }
      }

      callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
          handler.removeCallbacks(timeoutRunnable)
          if (bindProcess) {
            connectivityManager.bindProcessToNetwork(network)
          }
          activeNetwork = network
          activeNetworkCallback = callback
          val localIp = connectivityManager
            .getLinkProperties(network)
            ?.linkAddresses
            ?.firstOrNull()
            ?.address
            ?.hostAddress
            ?: "192.168.4.2"

          if (continuation.isActive) {
            continuation.resume(ColdGuardWifiSession(localIp = localIp, network = network, ssid = ssid))
          }
        }

        override fun onUnavailable() {
          clearRequestedNetworkBinding()
          if (continuation.isActive) {
            continuation.resumeWithException(IllegalStateException("WIFI_AP_UNAVAILABLE"))
          }
        }

        override fun onLost(network: Network) {
          clearRequestedNetworkBinding()
        }
      }

      connectivityManager.requestNetwork(request, callback)
      handler.postDelayed(timeoutRunnable, 15_000L)

      continuation.invokeOnCancellation {
        clearRequestedNetworkBinding()
      }
    }
  }

  fun currentNetwork(): Network? {
    return activeNetwork
  }

  fun release(bindProcess: Boolean) {
    if (bindProcess) {
      connectivityManager.bindProcessToNetwork(null)
    }
    activeNetworkCallback?.let { callback ->
      try {
        connectivityManager.unregisterNetworkCallback(callback)
      } catch (_: Exception) {
      }
    }
    activeNetwork = null
    activeNetworkCallback = null
  }
}
