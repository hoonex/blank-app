package io.github.hoonex.flow.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

private const val CAMPUS_EDGE = "https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/university-campus"

data class CampusPlace(
    val id: String,
    val name: String,
    val address: String,
    val roadAddress: String,
    val category: String,
    val phone: String,
    val x: String,
    val y: String,
    val distance: Int
)

data class CampusLecturePlace(
    val raw: String,
    val resolved: Boolean,
    val confidence: Int,
    val place: CampusPlace?
)

data class CampusNearby(
    val stores: List<CampusPlace>,
    val cafes: List<CampusPlace>,
    val food: List<CampusPlace>,
    val dining: List<CampusPlace>
)

data class CampusSnapshot(
    val center: CampusPlace,
    val places: List<CampusLecturePlace>,
    val nearby: CampusNearby
)

data class CampusWalkRoute(
    val status: String,
    val distance: Int,
    val timeSeconds: Int,
    val landingUrl: String
)

object UniversityCampusApi {
    suspend fun load(university: University, timetable: Timetable?): CampusSnapshot = withContext(Dispatchers.IO) {
        val items = JSONArray()
        val seen = linkedSetOf<String>()
        timetable?.subjects.orEmpty().forEach { subject ->
            listOf(subject.place).plus(subject.times.map { it.place }).forEach { raw ->
                val place = raw.trim()
                if (place.isNotBlank() && seen.add(place)) items.put(JSONObject().put("place", place))
            }
        }
        val payload = JSONObject()
            .put("schoolName", university.name)
            .put("address", university.address)
            .put("items", items)
        parseSnapshot(postJson("$CAMPUS_EDGE?action=campus", payload))
    }

    suspend fun walk(start: CampusPlace, end: CampusPlace): CampusWalkRoute? = withContext(Dispatchers.IO) {
        if (start.x.isBlank() || start.y.isBlank() || end.x.isBlank() || end.y.isBlank()) return@withContext null
        val payload = JSONObject()
            .put("start", JSONObject().put("x", start.x).put("y", start.y))
            .put("end", JSONObject().put("x", end.x).put("y", end.y))
            .put("startName", start.name)
            .put("endName", end.name)
        val route = postJson("$CAMPUS_EDGE?action=route", payload).optJSONObject("route") ?: return@withContext null
        CampusWalkRoute(
            status = route.optString("status"),
            distance = route.optInt("distance"),
            timeSeconds = route.optInt("time"),
            landingUrl = route.optString("landingUrl")
        )
    }

    private fun postJson(url: String, payload: JSONObject): JSONObject {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 12_000
            readTimeout = 30_000
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("User-Agent", "Flow-Android/0.4")
        }
        try {
            connection.outputStream.use { it.write(payload.toString().toByteArray(StandardCharsets.UTF_8)) }
            val code = connection.responseCode
            val text = (if (code in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader(StandardCharsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(text) }.getOrElse { JSONObject() }
            if (code !in 200..299) throw IllegalStateException(json.optString("error", "캠퍼스 정보를 불러오지 못했습니다."))
            return json
        } finally {
            connection.disconnect()
        }
    }
}

private fun parseSnapshot(root: JSONObject): CampusSnapshot {
    val center = root.optJSONObject("center")?.let(::parseCampusPlace)
        ?: throw IllegalStateException("캠퍼스 중심 정보를 찾지 못했습니다.")
    val nearby = root.optJSONObject("nearby") ?: JSONObject()
    return CampusSnapshot(
        center = center,
        places = root.optJSONArray("places").toLecturePlaces(),
        nearby = CampusNearby(
            stores = nearby.optJSONArray("stores").toCampusPlaces(),
            cafes = nearby.optJSONArray("cafes").toCampusPlaces(),
            food = nearby.optJSONArray("food").toCampusPlaces(),
            dining = nearby.optJSONArray("dining").toCampusPlaces()
        )
    )
}

private fun parseCampusPlace(o: JSONObject) = CampusPlace(
    id = o.optString("id"),
    name = o.optString("name"),
    address = o.optString("address"),
    roadAddress = o.optString("roadAddress"),
    category = o.optString("category"),
    phone = o.optString("phone"),
    x = o.optString("x"),
    y = o.optString("y"),
    distance = o.optInt("distance")
)

private fun JSONArray?.toCampusPlaces(): List<CampusPlace> {
    if (this == null) return emptyList()
    return buildList {
        for (i in 0 until length()) optJSONObject(i)?.let { add(parseCampusPlace(it)) }
    }
}

private fun JSONArray?.toLecturePlaces(): List<CampusLecturePlace> {
    if (this == null) return emptyList()
    return buildList {
        for (i in 0 until length()) {
            val o = optJSONObject(i) ?: continue
            add(
                CampusLecturePlace(
                    raw = o.optString("raw"),
                    resolved = o.optBoolean("resolved"),
                    confidence = o.optInt("confidence"),
                    place = o.optJSONObject("place")?.let(::parseCampusPlace)
                )
            )
        }
    }
}
