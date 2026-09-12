package io.github.hoonex.flow.data

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.Executor
import kotlin.coroutines.resume

object FlowLocation {
    @SuppressLint("MissingPermission")
    suspend fun current(context: Context): GeoPoint? {
        val manager = context.getSystemService(LocationManager::class.java) ?: return null
        val providers = listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)
            .filter { runCatching { manager.isProviderEnabled(it) }.getOrDefault(false) }
        if (providers.isEmpty()) return null

        val cached = providers.mapNotNull { provider ->
            runCatching { manager.getLastKnownLocation(provider) }.getOrNull()
        }.maxByOrNull(Location::getTime)
        if (cached != null && System.currentTimeMillis() - cached.time <= 5 * 60_000L) {
            return cached.toGeoPoint()
        }

        for (provider in providers) {
            val fresh = currentFromProvider(manager, provider)
            if (fresh != null) return fresh.toGeoPoint()
        }
        return cached?.toGeoPoint()
    }

    @SuppressLint("MissingPermission")
    private suspend fun currentFromProvider(manager: LocationManager, provider: String): Location? =
        suspendCancellableCoroutine { continuation ->
            if (Build.VERSION.SDK_INT >= 30) {
                val signal = CancellationSignal()
                val executor = Executor { command -> Handler(Looper.getMainLooper()).post(command) }
                continuation.invokeOnCancellation { signal.cancel() }
                manager.getCurrentLocation(provider, signal, executor) { location ->
                    if (continuation.isActive) continuation.resume(location)
                }
            } else {
                val handler = Handler(Looper.getMainLooper())
                lateinit var listener: LocationListener
                val timeout = Runnable {
                    runCatching { manager.removeUpdates(listener) }
                    if (continuation.isActive) continuation.resume(null)
                }
                listener = object : LocationListener {
                    override fun onLocationChanged(location: Location) {
                        handler.removeCallbacks(timeout)
                        runCatching { manager.removeUpdates(this) }
                        if (continuation.isActive) continuation.resume(location)
                    }
                    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
                    override fun onProviderEnabled(provider: String) = Unit
                    override fun onProviderDisabled(provider: String) = Unit
                }
                continuation.invokeOnCancellation {
                    handler.removeCallbacks(timeout)
                    runCatching { manager.removeUpdates(listener) }
                }
                runCatching {
                    manager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
                    handler.postDelayed(timeout, 8_000L)
                }.onFailure {
                    handler.removeCallbacks(timeout)
                    if (continuation.isActive) continuation.resume(null)
                }
            }
        }

    private fun Location.toGeoPoint() = GeoPoint(longitude, latitude)
}
