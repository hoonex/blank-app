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
import java.time.LocalDate
import java.time.format.DateTimeFormatter

private const val SCHOOL_EDGE = "https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data"

data class FlowSchool(
    val officeCode: String,
    val officeName: String = "",
    val schoolCode: String,
    val name: String,
    val englishName: String = "",
    val kind: String = "",
    val location: String = "",
    val jurisdiction: String = "",
    val type: String = "",
    val postalCode: String = "",
    val address: String = "",
    val addressDetail: String = "",
    val phone: String = "",
    val fax: String = "",
    val homepage: String = "",
    val coed: String = "",
    val highSchoolType: String = "",
    val highSchoolTrack: String = "",
    val specialPurpose: String = "",
    val admissionTerm: String = "",
    val dayNight: String = "",
    val founded: String = "",
    val anniversary: String = ""
)

data class SchoolSelection(val school: FlowSchool, val grade: String, val className: String)
data class SchoolPeriod(val date: String, val period: Int, val subject: String, val grade: String = "", val className: String = "")
data class SchoolMeal(val date: String, val type: String, val dishes: List<String>, val calories: String = "")
data class SchoolEvent(val date: String, val name: String, val content: String = "", val holidayType: String = "")

data class SchoolDashboard(
    val school: FlowSchool,
    val selected: String,
    val from: String,
    val to: String,
    val timetable: List<SchoolPeriod>,
    val meals: List<SchoolMeal>,
    val events: List<SchoolEvent>
) {
    fun classesOn(date: String): List<SchoolPeriod> = timetable.filter { it.date == date }.sortedBy { it.period }
    fun mealsOn(date: String): List<SchoolMeal> = meals.filter { it.date == date }
    fun eventsOn(date: String): List<SchoolEvent> = events.filter { it.date == date }
}

fun schoolDate8(date: LocalDate = LocalDate.now()): String = date.format(DateTimeFormatter.BASIC_ISO_DATE)

class SchoolStore(context: Context) {
    private val prefs = context.getSharedPreferences("flow-school-native-v1", Context.MODE_PRIVATE)

    fun loadSelection(): SchoolSelection? {
        val schoolRaw = prefs.getString("school", null) ?: return null
        val grade = prefs.getString("grade", null) ?: return null
        val className = prefs.getString("class", null) ?: return null
        return SchoolSelection(parseSchool(JSONObject(schoolRaw)), grade, className)
    }

    fun saveSelection(value: SchoolSelection) {
        prefs.edit().putString("school", schoolJson(value.school).toString()).putString("grade", value.grade).putString("class", value.className).apply()
    }

    fun loadDashboard(): SchoolDashboard? = prefs.getString("dashboard", null)?.let { runCatching { parseDashboard(JSONObject(it)) }.getOrNull() }
    fun saveDashboard(value: SchoolDashboard) { prefs.edit().putString("dashboard", dashboardJson(value).toString()).putLong("dashboard_saved_at", System.currentTimeMillis()).apply() }
    fun dashboardSavedAt(): Long = prefs.getLong("dashboard_saved_at", 0L)
    fun clearDashboard() { prefs.edit().remove("dashboard").remove("dashboard_saved_at").apply() }
    fun clear() { prefs.edit().clear().apply() }
}

object SchoolApi {
    suspend fun search(query: String): List<FlowSchool> = withContext(Dispatchers.IO) {
        val root = getJson("$SCHOOL_EDGE?action=search&q=${enc(query.trim())}")
        root.optJSONArray("schools").toObjectList(::parseSchool)
    }

    suspend fun classes(school: FlowSchool, grade: String): List<String> = withContext(Dispatchers.IO) {
        val root = getJson("$SCHOOL_EDGE?action=classes&office=${enc(school.officeCode)}&school=${enc(school.schoolCode)}&grade=${enc(grade)}")
        root.optJSONArray("classes").toStringList()
    }

    suspend fun dashboard(selection: SchoolSelection, date: LocalDate = LocalDate.now()): SchoolDashboard = withContext(Dispatchers.IO) {
        val s = selection.school
        val url = "$SCHOOL_EDGE?action=dashboard&office=${enc(s.officeCode)}&school=${enc(s.schoolCode)}&grade=${enc(selection.grade)}&class=${enc(selection.className)}&kind=${enc(s.kind.ifBlank { "고등학교" })}&date=${schoolDate8(date)}"
        parseDashboard(getJson(url), fallbackSchool = s)
    }

    private fun enc(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8.toString())

    private fun getJson(url: String): JSONObject {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"; connectTimeout = 12_000; readTimeout = 18_000
            setRequestProperty("Accept", "application/json"); setRequestProperty("User-Agent", "Flow-Android/0.3")
        }
        try {
            val code = connection.responseCode
            val text = (if (code in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader(StandardCharsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = runCatching { JSONObject(text) }.getOrElse { JSONObject() }
            if (code !in 200..299) throw IllegalStateException(json.optString("error", "학교 데이터를 불러오지 못했습니다."))
            return json
        } finally { connection.disconnect() }
    }
}

private fun parseSchool(o: JSONObject): FlowSchool = FlowSchool(
    officeCode=o.optString("officeCode"), officeName=o.optString("officeName"), schoolCode=o.optString("schoolCode"), name=o.optString("name"),
    englishName=o.optString("englishName"), kind=o.optString("kind"), location=o.optString("location"), jurisdiction=o.optString("jurisdiction"), type=o.optString("type"),
    postalCode=o.optString("postalCode"), address=o.optString("address"), addressDetail=o.optString("addressDetail"), phone=o.optString("phone"), fax=o.optString("fax"), homepage=o.optString("homepage"),
    coed=o.optString("coed"), highSchoolType=o.optString("highSchoolType"), highSchoolTrack=o.optString("highSchoolTrack"), specialPurpose=o.optString("specialPurpose"), admissionTerm=o.optString("admissionTerm"),
    dayNight=o.optString("dayNight"), founded=o.optString("founded"), anniversary=o.optString("anniversary")
)

private fun schoolJson(s: FlowSchool) = JSONObject().put("officeCode",s.officeCode).put("officeName",s.officeName).put("schoolCode",s.schoolCode).put("name",s.name)
    .put("englishName",s.englishName).put("kind",s.kind).put("location",s.location).put("jurisdiction",s.jurisdiction).put("type",s.type).put("postalCode",s.postalCode)
    .put("address",s.address).put("addressDetail",s.addressDetail).put("phone",s.phone).put("fax",s.fax).put("homepage",s.homepage).put("coed",s.coed)
    .put("highSchoolType",s.highSchoolType).put("highSchoolTrack",s.highSchoolTrack).put("specialPurpose",s.specialPurpose).put("admissionTerm",s.admissionTerm).put("dayNight",s.dayNight)
    .put("founded",s.founded).put("anniversary",s.anniversary)

private fun parseDashboard(o: JSONObject, fallbackSchool: FlowSchool? = null): SchoolDashboard {
    val school = o.optJSONObject("school")?.let(::parseSchool) ?: fallbackSchool ?: throw IllegalStateException("학교 정보가 없습니다.")
    return SchoolDashboard(
        school, o.optString("selected"), o.optString("from"), o.optString("to"),
        o.optJSONArray("timetable").toObjectList { SchoolPeriod(it.optString("date"),it.optInt("period"),it.optString("subject"),it.optString("grade"),it.optString("className")) },
        o.optJSONArray("meals").toObjectList { SchoolMeal(it.optString("date"),it.optString("type"),it.optJSONArray("dishes").toStringList(),it.optString("calories")) },
        o.optJSONArray("events").toObjectList { SchoolEvent(it.optString("date"),it.optString("name"),it.optString("content"),it.optString("holidayType")) }
    )
}

private fun dashboardJson(d: SchoolDashboard) = JSONObject().put("school",schoolJson(d.school)).put("selected",d.selected).put("from",d.from).put("to",d.to)
    .put("timetable",JSONArray().apply { d.timetable.forEach { p -> put(JSONObject().put("date",p.date).put("period",p.period).put("subject",p.subject).put("grade",p.grade).put("className",p.className)) } })
    .put("meals",JSONArray().apply { d.meals.forEach { m -> put(JSONObject().put("date",m.date).put("type",m.type).put("dishes",JSONArray(m.dishes)).put("calories",m.calories)) } })
    .put("events",JSONArray().apply { d.events.forEach { e -> put(JSONObject().put("date",e.date).put("name",e.name).put("content",e.content).put("holidayType",e.holidayType)) } })

private inline fun <T> JSONArray?.toObjectList(block: (JSONObject) -> T): List<T> { if (this == null) return emptyList(); return buildList { for (i in 0 until length()) optJSONObject(i)?.let { add(block(it)) } } }
private fun JSONArray?.toStringList(): List<String> { if (this == null) return emptyList(); return buildList { for (i in 0 until length()) optString(i).takeIf { it.isNotBlank() }?.let(::add) } }
