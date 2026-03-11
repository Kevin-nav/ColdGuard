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
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ColdGuardWifiBridgeModule : Module() {
  private var activeConnectivityManager: ConnectivityManager? = null
  private var activeNetworkCallback: ConnectivityManager.NetworkCallback? = null

  override fun definition() = ModuleDefinition {
    Name("ColdGuardWifiBridge")

    AsyncFunction("connectToAccessPointAsync") Coroutine { ssid: String, password: String ->
      connectToAccessPoint(ssid, password)
    }

    AsyncFunction("releaseNetworkBindingAsync") {
      releaseNetworkBinding()
    }
  }

  private suspend fun connectToAccessPoint(ssid: String, password: String): Map<String, String> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      throw IllegalStateException("WIFI_NETWORK_SPECIFIER_REQUIRES_ANDROID_10")
    }

    val context = appContext.reactContext ?: throw IllegalStateException("WIFI_BRIDGE_CONTEXT_UNAVAILABLE")
    val connectivityManager =
      context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    releaseNetworkBinding()

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
      lateinit var callback: ConnectivityManager.NetworkCallback

      fun clearRequestedNetworkBinding() {
        handler.removeCallbacksAndMessages(null)
        try {
          connectivityManager.unregisterNetworkCallback(callback)
        } catch (_: Exception) {
        }
        connectivityManager.bindProcessToNetwork(null)
        if (activeNetworkCallback === callback) {
          activeNetworkCallback = null
          activeConnectivityManager = null
        }
      }

      callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
          connectivityManager.bindProcessToNetwork(network)
          activeConnectivityManager = connectivityManager
          activeNetworkCallback = callback
          val localIp = connectivityManager
            .getLinkProperties(network)
            ?.linkAddresses
            ?.firstOrNull()
            ?.address
            ?.hostAddress
            ?: "192.168.4.2"

          if (continuation.isActive) {
            continuation.resume(
              mapOf(
                "localIp" to localIp,
                "ssid" to ssid
              )
            )
          }
        }

        override fun onUnavailable() {
          clearRequestedNetworkBinding()
          if (continuation.isActive) continuation.resumeWithException(IllegalStateException("WIFI_AP_UNAVAILABLE"))
        }

        override fun onLost(network: Network) {
          clearRequestedNetworkBinding()
        }
      }

      connectivityManager.requestNetwork(request, callback)
      handler.postDelayed(
        {
          clearRequestedNetworkBinding()
          if (continuation.isActive) continuation.resumeWithException(IllegalStateException("WIFI_AP_TIMEOUT"))
        },
        15_000L
      )

      continuation.invokeOnCancellation {
        clearRequestedNetworkBinding()
      }
    }
  }

  private fun releaseNetworkBinding() {
    activeConnectivityManager?.bindProcessToNetwork(null)
    activeNetworkCallback?.let { callback ->
      try {
        activeConnectivityManager?.unregisterNetworkCallback(callback)
      } catch (_: Exception) {
      }
    }
    activeNetworkCallback = null
    activeConnectivityManager = null
  }
}
