package io.github.hoonex.flow.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

private const val TRANSIT_EDGE = "https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/transit-data"

data class GeoPoint(val x: Double, val y: Double)

data class TransitDestination(
    val id: String,
    val name: String,
    val address: String,
    val category: String,
    val x: Double,
    val y: Double,
    val distanceMeters: Int? = null
)

data class TransitSegment(
    val type: String,
    val minutes: Int,
    val distance: Int,
    val lines: List<String>,
    val startName: String,
    val endName: String,
    val stationCount: Int,
    val direction: String
)

data class TransitRoute(
    val id: String,
    val totalMinutes: Int,
    val transfers: Int,
    val walkMeters: Int,
    val payment: Int,
    val arrivalAt: String,
    val badges: List<String>,
    val segments: List<TransitSegment>
)

data class TransitRouteBundle(
    val destination: TransitDestination?,
    val routes: List<TransitRoute>,
    val realtimeCoverage: String,
    val provider: String,
    val busError: String,
    val mixedError: String
)

object TransitApi {
    suspend fun searchDestinations(query: String, source: GeoPoint? = null): List<TransitDestination> = withContext(Dispatchers.IO) {
        val params = linkedMapOf("action" to "destination-search", "query" to query.trim())
        source?.let {
            params["sx"] = it.x.toString()
            params["sy"] = it.y.toString()
        }
        val root = getJson(url(params))
        root.optJSONArray("suggestions").toDestinationList()
    }

    suspend fun route(
        source: GeoPoint,
        destinationQuery: String,
        resolved: TransitDestination? = null
    ): TransitRouteBundle = withContext(Dispatchers.IO) {
        val params = linkedMapOf(
            "action" to "route",
            "sx" to source.x.toString(),
            "sy" to source.y.toString()
        )
        if (resolved != null) {
            params["ex"] = resolved.x.toString()
            params["ey"] = resolved.y.toString()
            params["destinationName"] = resolved.name
            params["destinationAddress"] = resolved.address
        } else {
            params["destination"] = destinationQuery.trim()
        }
        parseRouteBundle(getJson(url(params)))
    }

    private fun url(params: Map<String, String>): String = buildString {
        append(TRANSIT_EDGE)
        append('?')
        append(params.entries.joinToString("&") { (key, value) -> "${enc(key)}=${enc(value)}" })
    }

    private fun enc(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8.toString())

    private fun getJson(url: String): JSONObject {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 12_000
            readTimeout = 135_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "Flow-Android/0.4")
        }
        try {
            val code = connection.responseCode
            val text = (if (code in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader(StandardCharsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(text) }.getOrElse { JSONObject() }
            if (code !in 200..299) {
                throw IllegalStateException(json.optString("error", "교통 정보를 불러오지 못했습니다."))
            }
            return json
        } finally {
            connection.disconnect()
        }
    }
}

private fun parseRouteBundle(root: JSONObject): TransitRouteBundle {
    val destination = root.optJSONObject("destination")?.let { o ->
        val x = o.optDouble("x", Double.NaN)
        val y = o.optDouble("y", Double.NaN)
        if (x.isFinite() && y.isFinite()) {
            TransitDestination(
                id = "route-destination",
                name = o.optString("name", "목적지"),
                address = o.optString("address"),
                category = "",
                x = x,
                y = y
            )
        } else null
    }
    return TransitRouteBundle(
        destination = destination,
        routes = root.optJSONArray("routes").toRouteList(),
        realtimeCoverage = root.optString("realtimeCoverage", "none"),
        provider = root.optString("provider"),
        busError = root.optString("busError"),
        mixedError = root.optString("mixedError")
    )
}

private fun JSONArray?.toDestinationList(): List<TransitDestination> {
    if (this == null) return emptyList()
    return buildList {
        for (i in 0 until length()) {
            val o = optJSONObject(i) ?: continue
            val x = o.optDouble("x", Double.NaN)
            val y = o.optDouble("y", Double.NaN)
            if (!x.isFinite() || !y.isFinite()) continue
            add(
                TransitDestination(
                    id = o.optString("id", "$x,$y"),
                    name = o.optString("name", "목적지"),
                    address = o.optString("address"),
                    category = o.optString("category"),
                    x = x,
                    y = y,
                    distanceMeters = o.optDouble("distanceMeters", Double.NaN)
                        .takeIf { it.isFinite() }?.toInt()
                )
            )
        }
    }
}

private fun JSONArray?.toRouteList(): List<TransitRoute> {
    if (this == null) return emptyList()
    return buildList {
        for (i in 0 until length()) {
            val o = optJSONObject(i) ?: continue
            add(
                TransitRoute(
                    id = o.optString("id", "route-${i + 1}"),
                    totalMinutes = o.optInt("totalMinutes"),
                    transfers = o.optInt("transfers"),
                    walkMeters = o.optInt("walkMeters"),
                    payment = o.optInt("payment"),
                    arrivalAt = o.optString("arrivalAt"),
                    badges = o.optJSONArray("badges").toStringListTransit(),
                    segments = o.optJSONArray("segments").toSegmentList()
                )
            )
        }
    }
}

private fun JSONArray?.toSegmentList(): List<TransitSegment> {
    if (this == null) return emptyList()
    return buildList {
        for (i in 0 until length()) {
            val o = optJSONObject(i) ?: continue
            add(
                TransitSegment(
                    type = o.optString("type", "walk"),
                    minutes = o.optInt("minutes"),
                    distance = o.optInt("distance"),
                    lines = o.optJSONArray("lines").toStringListTransit(),
                    startName = o.optString("startName"),
                    endName = o.optString("endName"),
                    stationCount = o.optInt("stationCount"),
                    direction = o.optString("direction")
                )
            )
        }
    }
}

private fun JSONArray?.toStringListTransit(): List<String> {
    if (this == null) return emptyList()
    return buildList {
        for (i in 0 until length()) optString(i).takeIf(String::isNotBlank)?.let(::add)
    }
}
