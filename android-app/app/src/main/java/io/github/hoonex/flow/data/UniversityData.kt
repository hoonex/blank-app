package io.github.hoonex.flow.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.LocalDateTime

private const val EDGE = "https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/university-data"

data class University(
    val id: String,
    val name: String,
    val region: String = "",
    val foundation: String = "",
    val campus: String = "",
    val address: String = "",
    val englishName: String = "",
    val kind: String = "",
    val division: String = "",
    val founded: String = "",
    val postalCode: String = "",
    val phone: String = "",
    val fax: String = "",
    val homepage: String = ""
)

data class UniversityMetric(val year: String = "", val value: Double = 0.0)

data class UniversityProfile(
    val school: University,
    val tuition: UniversityMetric? = null,
    val scholarship: UniversityMetric? = null,
    val dormitory: UniversityMetric? = null,
    val library: UniversityMetric? = null,
    val partial: Boolean = false,
    val unavailable: List<String> = emptyList()
)

data class UniversityMajor(
    val id: String,
    val name: String,
    val college: String = "",
    val degree: String = "",
    val duration: String = "",
    val category: String = "",
    val dayNight: String = "",
    val characteristic: String = ""
)

data class CourseTime(
    val day: Int,
    val startMinutes: Int,
    val endMinutes: Int,
    val start: String,
    val end: String,
    val place: String = ""
)

data class Subject(
    val id: String,
    val name: String,
    val professor: String = "",
    val place: String = "",
    val credit: Double = 0.0,
    val custom: Boolean = false,
    val times: List<CourseTime> = emptyList()
)

data class Timetable(
    val year: Int,
    val semester: String,
    val subjects: List<Subject>
)

data class ScheduledClass(val subject: Subject, val time: CourseTime)

data class ClassMoment(val current: ScheduledClass?, val next: ScheduledClass?)

data class ScheduleGap(val startMinutes: Int, val endMinutes: Int) {
    val durationMinutes: Int get() = endMinutes - startMinutes
}

fun todayIndex(now: LocalDateTime = LocalDateTime.now()): Int = now.dayOfWeek.value - 1

fun Timetable.classesForDay(day: Int): List<ScheduledClass> = subjects
    .flatMap { subject -> subject.times.map { ScheduledClass(subject, it) } }
    .filter { it.time.day == day }
    .sortedBy { it.time.startMinutes }

fun Timetable.classMoment(now: LocalDateTime = LocalDateTime.now()): ClassMoment {
    val minute = now.hour * 60 + now.minute
    val today = classesForDay(todayIndex(now))
    val current = today.firstOrNull { minute in it.time.startMinutes until it.time.endMinutes }
    val next = today.firstOrNull { it.time.startMinutes > minute }
    return ClassMoment(current, next)
}

fun Timetable.nextGap(now: LocalDateTime = LocalDateTime.now()): ScheduleGap? {
    val minute = now.hour * 60 + now.minute
    val day = classesForDay(todayIndex(now))
    if (day.size < 2) return null
    return day.zipWithNext()
        .mapNotNull { (a, b) ->
            if (b.time.startMinutes - a.time.endMinutes >= 20 && b.time.startMinutes > minute) {
                ScheduleGap(a.time.endMinutes, b.time.startMinutes)
            } else null
        }
        .firstOrNull()
}

fun Timetable.totalCredits(): Double = subjects.filterNot { it.custom }.sumOf { it.credit }

fun Timetable.weeklyMinutes(): Int = subjects.sumOf { subject ->
    subject.times.sumOf { (it.endMinutes - it.startMinutes).coerceAtLeast(0) }
}

fun Timetable.nextBoundary(now: LocalDateTime = LocalDateTime.now()): LocalDateTime? {
    val today = now.toLocalDate()
    return (0L..7L)
        .asSequence()
        .flatMap { dayOffset ->
            val date = today.plusDays(dayOffset)
            classesForDay(date.dayOfWeek.value - 1).asSequence().flatMap { item ->
                sequenceOf(item.time.startMinutes, item.time.endMinutes).map { minute ->
                    date.atStartOfDay().plusMinutes(minute.toLong())
                }
            }
        }
        .filter { it.isAfter(now) }
        .minOrNull()
}

class UniversityStore(context: Context) {
    private val prefs = context.getSharedPreferences("flow-university-native-v1", Context.MODE_PRIVATE)

    fun loadUniversity(): University? = prefs.getString("university", null)?.let(::parseUniversity)
    fun loadTimetable(): Timetable? = prefs.getString("timetable", null)?.let(::parseTimetable)
    fun loadProfile(): UniversityProfile? = prefs.getString("profile", null)?.let(::parseProfile)
    fun loadMajor(): UniversityMajor? = prefs.getString("major", null)?.let(::parseMajor)

    fun saveUniversity(value: University) {
        prefs.edit().putString("university", universityJson(value).toString()).apply()
    }

    fun saveTimetable(value: Timetable) {
        prefs.edit().putString("timetable", timetableJson(value).toString()).apply()
    }

    fun saveProfile(value: UniversityProfile) {
        prefs.edit().putString("profile", profileJson(value).toString()).apply()
    }

    fun saveMajor(value: UniversityMajor?) {
        prefs.edit().apply {
            if (value == null) remove("major") else putString("major", majorJson(value).toString())
        }.apply()
    }

    fun clearUniversityDetails() {
        prefs.edit().remove("profile").remove("major").apply()
    }

    fun clear() {
        prefs.edit().clear().apply()
    }
}

object UniversityApi {
    suspend fun search(query: String): List<University> = withContext(Dispatchers.IO) {
        val q = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8.toString())
        val root = getJson("$EDGE?action=search&q=$q")
        val schools = root.optJSONArray("schools") ?: JSONArray()
        buildList {
            for (i in 0 until schools.length()) {
                val item = schools.optJSONObject(i) ?: continue
                add(parseUniversity(item))
            }
        }
    }

    suspend fun profile(university: University): UniversityProfile = withContext(Dispatchers.IO) {
        val id = URLEncoder.encode(university.id, StandardCharsets.UTF_8.toString())
        val name = URLEncoder.encode(university.name, StandardCharsets.UTF_8.toString())
        parseProfile(getJson("$EDGE?action=profile&id=$id&name=$name"), university)
    }

    suspend fun majors(university: University, query: String = ""): List<UniversityMajor> = withContext(Dispatchers.IO) {
        val id = URLEncoder.encode(university.id, StandardCharsets.UTF_8.toString())
        val name = URLEncoder.encode(university.name, StandardCharsets.UTF_8.toString())
        val q = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8.toString())
        val root = getJson("$EDGE?action=majors&id=$id&name=$name&q=$q")
        val items = root.optJSONArray("majors") ?: JSONArray()
        buildList {
            for (i in 0 until items.length()) {
                items.optJSONObject(i)?.let { add(parseMajor(it)) }
            }
        }
    }

    suspend fun importEverytime(sharedUrl: String): Timetable = withContext(Dispatchers.IO) {
        val body = JSONObject().put("url", sharedUrl.trim()).toString()
        val root = requestJson("$EDGE?action=import-everytime", "POST", body)
        parseTimetable(root.getJSONObject("timetable"))
    }

    private fun getJson(url: String) = requestJson(url, "GET", null)

    private fun requestJson(url: String, method: String, body: String?): JSONObject {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 12_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "Flow-Android/0.2")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                outputStream.use { it.write(body.toByteArray(StandardCharsets.UTF_8)) }
            }
        }
        try {
            val code = connection.responseCode
            val text = (if (code in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader(StandardCharsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(text) }.getOrElse { JSONObject() }
            if (code !in 200..299) throw IllegalStateException(json.optString("error", "데이터를 불러오지 못했습니다."))
            return json
        } finally {
            connection.disconnect()
        }
    }
}

private fun parseUniversity(raw: String): University = parseUniversity(JSONObject(raw))
private fun parseUniversity(o: JSONObject) = University(
    id = o.optString("id"),
    name = o.optString("name"),
    region = o.optString("region"),
    foundation = o.optString("foundation"),
    campus = o.optString("campus"),
    address = o.optString("address"),
    englishName = o.optString("englishName"),
    kind = o.optString("kind"),
    division = o.optString("division"),
    founded = o.optString("founded"),
    postalCode = o.optString("postalCode"),
    phone = o.optString("phone"),
    fax = o.optString("fax"),
    homepage = o.optString("homepage")
)

private fun parseMetric(o: JSONObject?, key: String): UniversityMetric? {
    val item = o?.optJSONObject(key) ?: return null
    return UniversityMetric(item.optString("year"), item.optDouble("value", 0.0))
}

private fun parseProfile(raw: String): UniversityProfile = parseProfile(JSONObject(raw), University("", "대학교"))
private fun parseProfile(o: JSONObject, fallback: University): UniversityProfile {
    val school = o.optJSONObject("school")?.let(::parseUniversity) ?: fallback
    val metrics = o.optJSONObject("metrics")
    val unavailable = o.optJSONArray("unavailable") ?: JSONArray()
    return UniversityProfile(
        school = school,
        tuition = parseMetric(metrics, "tuition"),
        scholarship = parseMetric(metrics, "scholarship"),
        dormitory = parseMetric(metrics, "dormitory"),
        library = parseMetric(metrics, "library"),
        partial = o.optBoolean("partial", false),
        unavailable = buildList {
            for (i in 0 until unavailable.length()) add(unavailable.optString(i))
        }
    )
}

private fun parseMajor(raw: String): UniversityMajor = parseMajor(JSONObject(raw))
private fun parseMajor(o: JSONObject) = UniversityMajor(
    id = o.optString("id"),
    name = o.optString("name"),
    college = o.optString("college"),
    degree = o.optString("degree"),
    duration = o.optString("duration"),
    category = o.optString("category"),
    dayNight = o.optString("dayNight"),
    characteristic = o.optString("characteristic")
)

private fun parseTimetable(raw: String): Timetable = parseTimetable(JSONObject(raw))
private fun parseTimetable(o: JSONObject): Timetable {
    val subjects = o.optJSONArray("subjects") ?: JSONArray()
    return Timetable(
        year = o.optInt("year"),
        semester = o.optString("semester"),
        subjects = buildList {
            for (i in 0 until subjects.length()) {
                val subject = subjects.optJSONObject(i) ?: continue
                val times = subject.optJSONArray("times") ?: JSONArray()
                add(
                    Subject(
                        id = subject.optString("id"),
                        name = subject.optString("name", "일정"),
                        professor = subject.optString("professor"),
                        place = subject.optString("place"),
                        credit = subject.optDouble("credit", 0.0),
                        custom = subject.optBoolean("custom", false),
                        times = buildList {
                            for (j in 0 until times.length()) {
                                val time = times.optJSONObject(j) ?: continue
                                add(
                                    CourseTime(
                                        day = time.optInt("day"),
                                        startMinutes = time.optInt("startMinutes"),
                                        endMinutes = time.optInt("endMinutes"),
                                        start = time.optString("start"),
                                        end = time.optString("end"),
                                        place = time.optString("place")
                                    )
                                )
                            }
                        }
                    )
                )
            }
        }
    )
}

private fun universityJson(value: University) = JSONObject()
    .put("id", value.id).put("name", value.name).put("region", value.region)
    .put("foundation", value.foundation).put("campus", value.campus).put("address", value.address)
    .put("englishName", value.englishName).put("kind", value.kind).put("division", value.division)
    .put("founded", value.founded).put("postalCode", value.postalCode).put("phone", value.phone)
    .put("fax", value.fax).put("homepage", value.homepage)

private fun metricJson(value: UniversityMetric?) = value?.let { JSONObject().put("year", it.year).put("value", it.value) }

private fun profileJson(value: UniversityProfile) = JSONObject()
    .put("school", universityJson(value.school))
    .put("metrics", JSONObject()
        .put("tuition", metricJson(value.tuition))
        .put("scholarship", metricJson(value.scholarship))
        .put("dormitory", metricJson(value.dormitory))
        .put("library", metricJson(value.library)))
    .put("partial", value.partial)
    .put("unavailable", JSONArray(value.unavailable))

private fun majorJson(value: UniversityMajor) = JSONObject()
    .put("id", value.id).put("name", value.name).put("college", value.college)
    .put("degree", value.degree).put("duration", value.duration).put("category", value.category)
    .put("dayNight", value.dayNight).put("characteristic", value.characteristic)

private fun timetableJson(value: Timetable): JSONObject = JSONObject()
    .put("year", value.year)
    .put("semester", value.semester)
    .put("subjects", JSONArray().apply {
        value.subjects.forEach { subject ->
            put(JSONObject()
                .put("id", subject.id).put("name", subject.name).put("professor", subject.professor)
                .put("place", subject.place).put("credit", subject.credit).put("custom", subject.custom)
                .put("times", JSONArray().apply {
                    subject.times.forEach { time ->
                        put(JSONObject()
                            .put("day", time.day).put("startMinutes", time.startMinutes).put("endMinutes", time.endMinutes)
                            .put("start", time.start).put("end", time.end).put("place", time.place))
                    }
                }))
        }
    })