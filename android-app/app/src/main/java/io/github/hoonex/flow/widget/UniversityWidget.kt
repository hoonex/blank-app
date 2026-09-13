package io.github.hoonex.flow.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalSize
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import io.github.hoonex.flow.MainActivity
import io.github.hoonex.flow.data.SchoolStore
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.data.classMoment
import io.github.hoonex.flow.data.classesForDay
import io.github.hoonex.flow.data.schoolDate8
import io.github.hoonex.flow.data.todayIndex
import io.github.hoonex.flow.data.totalCredits
import io.github.hoonex.flow.data.weeklyMinutes
import io.github.hoonex.flow.surface.UniversitySurfaceScheduler
import io.github.hoonex.flow.ui.FlowMode
import io.github.hoonex.flow.ui.FlowModeStore
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

private val WidgetBackground = ColorProvider(Color(0xFF0D1214))
private val WidgetAccent = ColorProvider(Color(0xFF7BE7D6))
private val WidgetText = ColorProvider(Color.White)
private val WidgetMuted = ColorProvider(Color(0xFFA8B3B8))

private data class WidgetRuntime(val source: FlowWidgetSource, val showContext: Boolean)

private fun widgetRuntime(context: Context, id: GlanceId): WidgetRuntime {
    val appWidgetId = GlanceAppWidgetManager(context).getAppWidgetId(id)
    val config = FlowWidgetPreferences.load(context, appWidgetId)
    val source = if (config.source != FlowWidgetSource.AUTO) {
        config.source
    } else {
        when (FlowModeStore(context).load()) {
            FlowMode.SCHOOL -> FlowWidgetSource.SCHOOL
            FlowMode.UNIVERSITY -> FlowWidgetSource.UNIVERSITY
            null -> if (SchoolStore(context).loadSelection() != null) FlowWidgetSource.SCHOOL else FlowWidgetSource.UNIVERSITY
        }
    }
    return WidgetRuntime(source, config.showContext)
}

private fun compact(width: Dp, height: Dp): Boolean = width < 190.dp || height < 92.dp
private fun roomy(height: Dp): Boolean = height >= 145.dp

class UniversityWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val runtime = widgetRuntime(context, id)
        if (runtime.source == FlowWidgetSource.SCHOOL) {
            val store = SchoolStore(context)
            val selection = store.loadSelection()
            val dashboard = store.loadDashboard()
            val classes = dashboard?.classesOn(schoolDate8()).orEmpty()
            val meals = dashboard?.mealsOn(schoolDate8()).orEmpty()
            val first = classes.firstOrNull()
            val headline = when {
                selection == null -> "School을 설정하세요"
                classes.isEmpty() -> "오늘 수업 없음"
                else -> first?.subject ?: "오늘 ${classes.size}개 수업"
            }
            val detail = when {
                selection == null -> "Flow 앱에서 학교·학년·반 선택"
                first != null -> "${first.period}교시 · 오늘 ${classes.size}개${meals.firstOrNull()?.let { " · ${it.type}" } ?: ""}"
                else -> selection.school.name
            }
            provideContent {
                val size = LocalSize.current
                val small = compact(size.width, size.height)
                WidgetShell(if (small) 10.dp else 16.dp) {
                    Text("SCHOOL", style = TextStyle(color = WidgetAccent, fontSize = if (small) 9.sp else 10.sp, fontWeight = FontWeight.Bold))
                    Spacer(GlanceModifier.height(if (small) 4.dp else 7.dp))
                    Text(headline, maxLines = if (small) 1 else 2, style = TextStyle(color = WidgetText, fontSize = if (small) 15.sp else 19.sp, fontWeight = FontWeight.Bold))
                    if (runtime.showContext && (!small || size.height >= 76.dp)) {
                        Spacer(GlanceModifier.height(4.dp))
                        Text(detail, maxLines = 1, style = TextStyle(color = WidgetMuted, fontSize = if (small) 9.sp else 11.sp))
                    }
                    if (runtime.showContext && roomy(size.height) && meals.isNotEmpty()) {
                        Spacer(GlanceModifier.height(5.dp))
                        Text("급식 · ${meals.first().menu.take(2).joinToString(" · ")}", maxLines = 1, style = TextStyle(color = WidgetMuted, fontSize = 10.sp))
                    }
                }
            }
            return
        }

        val store = UniversityStore(context)
        val university = store.loadUniversity()
        val moment = store.loadTimetable()?.classMoment()
        val headline = when {
            moment?.current != null -> moment.current.subject.name
            moment?.next != null -> moment.next.subject.name
            else -> "오늘 수업 없음"
        }
        val kicker = when {
            moment?.current != null -> "NOW"
            moment?.next != null -> "NEXT"
            else -> "UNIVERSITY"
        }
        val detail = when {
            moment?.current != null -> "${moment.current.time.end} 종료 · ${moment.current.time.place.ifBlank { moment.current.subject.place }}"
            moment?.next != null -> "${moment.next.time.start} 시작 · ${moment.next.time.place.ifBlank { moment.next.subject.place }}"
            else -> university?.name ?: "Flow University"
        }
        provideContent {
            val size = LocalSize.current
            val small = compact(size.width, size.height)
            WidgetShell(if (small) 10.dp else 16.dp) {
                Text(kicker, style = TextStyle(color = WidgetAccent, fontSize = if (small) 9.sp else 10.sp, fontWeight = FontWeight.Bold))
                Spacer(GlanceModifier.height(if (small) 4.dp else 7.dp))
                Text(headline, maxLines = if (small) 1 else 2, style = TextStyle(color = WidgetText, fontSize = if (small) 15.sp else 19.sp, fontWeight = FontWeight.Bold))
                if (runtime.showContext && (!small || size.height >= 76.dp)) {
                    Spacer(GlanceModifier.height(4.dp))
                    Text(detail, maxLines = 1, style = TextStyle(color = WidgetMuted, fontSize = if (small) 9.sp else 11.sp))
                }
            }
        }
    }
}

class UniversityTodayWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val runtime = widgetRuntime(context, id)
        if (runtime.source == FlowWidgetSource.SCHOOL) {
            val store = SchoolStore(context)
            val selection = store.loadSelection()
            val classes = store.loadDashboard()?.classesOn(schoolDate8()).orEmpty()
            provideContent {
                val size = LocalSize.current
                val count = when {
                    size.height >= 210.dp -> 5
                    size.height >= 165.dp -> 4
                    size.height >= 125.dp -> 3
                    else -> 1
                }
                val small = compact(size.width, size.height)
                WidgetShell(if (small) 10.dp else 16.dp) {
                    Text("TODAY · ${selection?.school?.name ?: "FLOW SCHOOL"}", maxLines = 1, style = TextStyle(color = WidgetAccent, fontSize = if (small) 9.sp else 10.sp, fontWeight = FontWeight.Bold))
                    Spacer(GlanceModifier.height(if (small) 4.dp else 7.dp))
                    Text(
                        when {
                            selection == null -> "학교를 설정하세요"
                            classes.isEmpty() -> "오늘 수업 없음"
                            else -> "오늘 ${classes.size}개 수업"
                        },
                        maxLines = 1,
                        style = TextStyle(color = WidgetText, fontSize = if (small) 15.sp else 18.sp, fontWeight = FontWeight.Bold)
                    )
                    if (runtime.showContext && classes.isNotEmpty() && size.height >= 105.dp) {
                        Spacer(GlanceModifier.height(6.dp))
                        classes.take(count).forEach { item ->
                            Text("${item.period}교시  ${item.subject}", maxLines = 1, style = TextStyle(color = WidgetMuted, fontSize = if (small) 9.sp else 11.sp))
                            Spacer(GlanceModifier.height(2.dp))
                        }
                    } else if (runtime.showContext && selection != null && size.height >= 105.dp) {
                        Spacer(GlanceModifier.height(6.dp))
                        Text("${selection.grade}학년 ${selection.className}반", style = TextStyle(color = WidgetMuted, fontSize = 11.sp))
                    }
                }
            }
            return
        }

        val store = UniversityStore(context)
        val timetable = store.loadTimetable()
        val university = store.loadUniversity()
        val classes = timetable?.classesForDay(todayIndex()).orEmpty()
        provideContent {
            val size = LocalSize.current
            val count = when {
                size.height >= 210.dp -> 5
                size.height >= 165.dp -> 4
                size.height >= 125.dp -> 3
                else -> 1
            }
            val small = compact(size.width, size.height)
            WidgetShell(if (small) 10.dp else 16.dp) {
                Text("TODAY · ${university?.name ?: "FLOW"}", maxLines = 1, style = TextStyle(color = WidgetAccent, fontSize = if (small) 9.sp else 10.sp, fontWeight = FontWeight.Bold))
                Spacer(GlanceModifier.height(if (small) 4.dp else 7.dp))
                Text(
                    when {
                        timetable == null -> "시간표를 연결하세요"
                        classes.isEmpty() -> "오늘은 공강"
                        else -> "오늘 ${classes.size}개 일정"
                    },
                    maxLines = 1,
                    style = TextStyle(color = WidgetText, fontSize = if (small) 15.sp else 18.sp, fontWeight = FontWeight.Bold)
                )
                if (runtime.showContext && classes.isNotEmpty() && size.height >= 105.dp) {
                    Spacer(GlanceModifier.height(6.dp))
                    classes.take(count).forEach { item ->
                        Text("${item.time.start}  ${item.subject.name}", maxLines = 1, style = TextStyle(color = WidgetMuted, fontSize = if (small) 9.sp else 11.sp))
                        Spacer(GlanceModifier.height(2.dp))
                    }
                } else if (runtime.showContext && classes.isEmpty() && size.height >= 105.dp) {
                    Spacer(GlanceModifier.height(6.dp))
                    Text("Flow University", style = TextStyle(color = WidgetMuted, fontSize = 11.sp))
                }
            }
        }
    }
}

class UniversityWeekWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val runtime = widgetRuntime(context, id)
        if (runtime.source == FlowWidgetSource.SCHOOL) {
            val dashboard = SchoolStore(context).loadDashboard()
            val entries = dashboard?.timetable.orEmpty().groupBy { it.date }.toSortedMap().entries.toList()
            val total = dashboard?.timetable?.size ?: 0
            provideContent {
                val size = LocalSize.current
                val days = when {
                    size.width >= 360.dp -> 5
                    size.width >= 260.dp -> 4
                    size.width >= 190.dp -> 3
                    else -> 2
                }
                val density = entries.take(days).joinToString("  ·  ") { (date, periods) -> "${weekday(date)} ${periods.size}" }.ifBlank { "주간 시간표 미등록" }
                val small = compact(size.width, size.height)
                WidgetShell(if (small) 10.dp else 16.dp) {
                    Text("SCHOOL WEEK", style = TextStyle(color = WidgetAccent, fontSize = if (small) 9.sp else 10.sp, fontWeight = FontWeight.Bold))
                    Spacer(GlanceModifier.height(if (small) 4.dp else 7.dp))
                    Text(if (dashboard == null) "학교 데이터를 열어주세요" else "이번 주 ${total}교시", maxLines = 1, style = TextStyle(color = WidgetText, fontSize = if (small) 15.sp else 18.sp, fontWeight = FontWeight.Bold))
                    if (runtime.showContext && size.height >= 82.dp) {
                        Spacer(GlanceModifier.height(5.dp))
                        Text(density, maxLines = if (size.height >= 130.dp) 2 else 1, style = TextStyle(color = WidgetMuted, fontSize = if (small) 9.sp else 11.sp))
                    }
                }
            }
            return
        }

        val timetable = UniversityStore(context).loadTimetable()
        val days = listOf("월", "화", "수", "목", "금")
        val credits = timetable?.totalCredits() ?: 0.0
        val minutes = timetable?.weeklyMinutes() ?: 0
        provideContent {
            val size = LocalSize.current
            val visibleDays = when {
                size.width >= 360.dp -> 5
                size.width >= 260.dp -> 4
                size.width >= 190.dp -> 3
                else -> 2
            }
            val density = timetable?.let { table ->
                days.take(visibleDays).mapIndexed { index, day -> "$day ${table.classesForDay(index).size}" }.joinToString("  ·  ")
            } ?: "시간표 미등록"
            val small = compact(size.width, size.height)
            WidgetShell(if (small) 10.dp else 16.dp) {
                Text("UNIVERSITY WEEK", style = TextStyle(color = WidgetAccent, fontSize = if (small) 9.sp else 10.sp, fontWeight = FontWeight.Bold))
                Spacer(GlanceModifier.height(if (small) 4.dp else 7.dp))
                Text(if (timetable == null) "주간 흐름 준비 중" else "${trim(credits)}학점 · ${minutes / 60}h ${minutes % 60}m", maxLines = 1, style = TextStyle(color = WidgetText, fontSize = if (small) 15.sp else 18.sp, fontWeight = FontWeight.Bold))
                if (runtime.showContext && size.height >= 82.dp) {
                    Spacer(GlanceModifier.height(5.dp))
                    Text(density, maxLines = if (size.height >= 130.dp) 2 else 1, style = TextStyle(color = WidgetMuted, fontSize = if (small) 9.sp else 11.sp))
                }
            }
        }
    }
}

class UniversityMiniWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val runtime = widgetRuntime(context, id)
        if (runtime.source == FlowWidgetSource.SCHOOL) {
            val classes = SchoolStore(context).loadDashboard()?.classesOn(schoolDate8()).orEmpty()
            val first = classes.firstOrNull()
            provideContent {
                val size = LocalSize.current
                MiniShell(if (size.height < 58.dp) 8.dp else 11.dp) {
                    Text("SCHOOL · ${first?.let { "${it.period}교시" } ?: "TODAY"}", maxLines = 1, style = TextStyle(color = WidgetAccent, fontSize = 9.sp, fontWeight = FontWeight.Bold))
                    Spacer(GlanceModifier.height(3.dp))
                    Text(first?.subject ?: if (classes.isEmpty()) "수업 없음" else "${classes.size}개 수업", maxLines = 1, style = TextStyle(color = WidgetText, fontSize = if (size.width < 130.dp) 12.sp else 14.sp, fontWeight = FontWeight.Bold))
                }
            }
            return
        }

        val moment = UniversityStore(context).loadTimetable()?.classMoment()
        val item = moment?.current ?: moment?.next
        val prefix = when {
            moment?.current != null -> "NOW"
            moment?.next != null -> "NEXT"
            else -> "FLOW"
        }
        val title = item?.subject?.name ?: "수업 없음"
        val time = item?.let { if (moment?.current != null) "${it.time.end}까지" else it.time.start } ?: "University"
        provideContent {
            val size = LocalSize.current
            MiniShell(if (size.height < 58.dp) 8.dp else 11.dp) {
                Text("$prefix · $time", maxLines = 1, style = TextStyle(color = WidgetAccent, fontSize = 9.sp, fontWeight = FontWeight.Bold))
                Spacer(GlanceModifier.height(3.dp))
                Text(title, maxLines = 1, style = TextStyle(color = WidgetText, fontSize = if (size.width < 130.dp) 12.sp else 14.sp, fontWeight = FontWeight.Bold))
            }
        }
    }
}

@Composable
private fun WidgetShell(padding: Dp, content: @Composable () -> Unit) {
    Column(
        modifier = GlanceModifier.fillMaxSize().background(WidgetBackground).padding(padding).clickable(actionStartActivity<MainActivity>())
    ) { content() }
}

@Composable
private fun MiniShell(padding: Dp, content: @Composable () -> Unit) {
    Column(
        modifier = GlanceModifier.fillMaxSize().background(WidgetBackground).padding(padding).clickable(actionStartActivity<MainActivity>())
    ) { content() }
}

object UniversityWidgets {
    suspend fun updateAll(context: Context) {
        UniversityWidget().updateAll(context)
        UniversityTodayWidget().updateAll(context)
        UniversityWeekWidget().updateAll(context)
        UniversityMiniWidget().updateAll(context)
    }

    fun hasAny(context: Context): Boolean {
        val manager = AppWidgetManager.getInstance(context)
        return listOf(
            UniversityWidgetReceiver::class.java,
            UniversityTodayWidgetReceiver::class.java,
            UniversityWeekWidgetReceiver::class.java,
            UniversityMiniWidgetReceiver::class.java
        ).any { receiver -> manager.getAppWidgetIds(ComponentName(context, receiver)).isNotEmpty() }
    }
}

private fun trim(value: Double): String = if (value % 1.0 == 0.0) value.roundToInt().toString() else String.format(Locale.US, "%.1f", value)

private fun weekday(raw: String): String = runCatching {
    LocalDate.parse(raw, DateTimeFormatter.BASIC_ISO_DATE).dayOfWeek.getDisplayName(java.time.format.TextStyle.SHORT, Locale.KOREAN)
}.getOrDefault(raw)

private fun clearWidgetPrefs(context: Context, appWidgetIds: IntArray) {
    appWidgetIds.forEach { FlowWidgetPreferences.delete(context, it) }
}

class UniversityWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = UniversityWidget()
    override fun onEnabled(context: Context) { super.onEnabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
    override fun onDisabled(context: Context) { super.onDisabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
    override fun onDeleted(context: Context, appWidgetIds: IntArray) { clearWidgetPrefs(context, appWidgetIds); super.onDeleted(context, appWidgetIds) }
}

class UniversityTodayWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = UniversityTodayWidget()
    override fun onEnabled(context: Context) { super.onEnabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
    override fun onDisabled(context: Context) { super.onDisabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
    override fun onDeleted(context: Context, appWidgetIds: IntArray) { clearWidgetPrefs(context, appWidgetIds); super.onDeleted(context, appWidgetIds) }
}

class UniversityWeekWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = UniversityWeekWidget()
    override fun onEnabled(context: Context) { super.onEnabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
    override fun onDisabled(context: Context) { super.onDisabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
    override fun onDeleted(context: Context, appWidgetIds: IntArray) { clearWidgetPrefs(context, appWidgetIds); super.onDeleted(context, appWidgetIds) }
}

class UniversityMiniWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = UniversityMiniWidget()
    override fun onEnabled(context: Context) { super.onEnabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
    override fun onDisabled(context: Context) { super.onDisabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
    override fun onDeleted(context: Context, appWidgetIds: IntArray) { clearWidgetPrefs(context, appWidgetIds); super.onDeleted(context, appWidgetIds) }
}
