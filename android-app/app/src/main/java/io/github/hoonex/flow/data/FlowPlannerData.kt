package io.github.hoonex.flow.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit
import java.util.UUID

enum class FlowTaskKind(val label: String) {
    ASSIGNMENT("과제"),
    EXAM("시험"),
    TODO("할 일")
}

enum class FlowTaskScope(val label: String) {
    FLOW("Flow"),
    SCHOOL("School"),
    UNIVERSITY("University")
}

data class FlowTask(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val note: String = "",
    val dueAt: String,
    val kind: FlowTaskKind = FlowTaskKind.TODO,
    val scope: FlowTaskScope = FlowTaskScope.FLOW,
    val done: Boolean = false
) {
    fun dueDateTime(): LocalDateTime? = runCatching { LocalDateTime.parse(dueAt) }.getOrNull()
}

data class FlowTaskStats(
    val today: Int,
    val nextSevenDays: Int,
    val completed: Int,
    val overdue: Int
)

fun List<FlowTask>.plannerStats(now: LocalDateTime = LocalDateTime.now()): FlowTaskStats {
    val today = now.toLocalDate()
    var todayCount = 0
    var nextSeven = 0
    var completed = 0
    var overdue = 0
    forEach { task ->
        if (task.done) {
            completed += 1
        } else {
            val due = task.dueDateTime() ?: return@forEach
            val day = due.toLocalDate()
            if (day == today) todayCount += 1
            val days = ChronoUnit.DAYS.between(today, day)
            if (days in 0..7) nextSeven += 1
            if (due.isBefore(now)) overdue += 1
        }
    }
    return FlowTaskStats(todayCount, nextSeven, completed, overdue)
}

fun List<FlowTask>.sortedPlannerTasks(): List<FlowTask> = sortedWith(
    compareBy<FlowTask> { it.done }
        .thenBy { it.dueDateTime() ?: LocalDateTime.MAX }
        .thenBy { it.title.lowercase() }
)

fun FlowTask.isDueOn(date: LocalDate): Boolean = dueDateTime()?.toLocalDate() == date

class FlowPlannerStore(context: Context) {
    private val prefs = context.getSharedPreferences("flow-planner-v1", Context.MODE_PRIVATE)

    fun load(): List<FlowTask> {
        val raw = prefs.getString("tasks", null) ?: return emptyList()
        return runCatching {
            val array = JSONArray(raw)
            buildList {
                for (i in 0 until array.length()) {
                    val item = array.optJSONObject(i) ?: continue
                    val title = item.optString("title").trim()
                    val dueAt = item.optString("dueAt").trim()
                    if (title.isEmpty() || dueAt.isEmpty()) continue
                    add(
                        FlowTask(
                            id = item.optString("id").ifBlank { UUID.randomUUID().toString() },
                            title = title,
                            note = item.optString("note"),
                            dueAt = dueAt,
                            kind = runCatching { FlowTaskKind.valueOf(item.optString("kind")) }.getOrDefault(FlowTaskKind.TODO),
                            scope = runCatching { FlowTaskScope.valueOf(item.optString("scope")) }.getOrDefault(FlowTaskScope.FLOW),
                            done = item.optBoolean("done", false)
                        )
                    )
                }
            }.sortedPlannerTasks()
        }.getOrDefault(emptyList())
    }

    fun save(tasks: List<FlowTask>) {
        val array = JSONArray()
        tasks.sortedPlannerTasks().forEach { task ->
            array.put(
                JSONObject()
                    .put("id", task.id)
                    .put("title", task.title)
                    .put("note", task.note)
                    .put("dueAt", task.dueAt)
                    .put("kind", task.kind.name)
                    .put("scope", task.scope.name)
                    .put("done", task.done)
            )
        }
        prefs.edit().putString("tasks", array.toString()).apply()
    }

    fun clear() {
        prefs.edit().clear().apply()
    }
}
