package io.github.hoonex.flow.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
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
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.data.classMoment
import io.github.hoonex.flow.data.classesForDay
import io.github.hoonex.flow.data.todayIndex
import io.github.hoonex.flow.data.totalCredits
import io.github.hoonex.flow.data.weeklyMinutes
import io.github.hoonex.flow.surface.UniversitySurfaceScheduler
import java.util.Locale
import kotlin.math.roundToInt

private val WidgetBackground = ColorProvider(Color(0xFF0D1214))
private val WidgetAccent = ColorProvider(Color(0xFF7BE7D6))
private val WidgetText = ColorProvider(Color.White)
private val WidgetMuted = ColorProvider(Color(0xFFA8B3B8))

class UniversityWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
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
            else -> "FLOW"
        }
        val detail = when {
            moment?.current != null -> "${moment.current.time.end} 종료 · ${moment.current.time.place.ifBlank { moment.current.subject.place }}"
            moment?.next != null -> "${moment.next.time.start} 시작 · ${moment.next.time.place.ifBlank { moment.next.subject.place }}"
            else -> university?.name ?: "Flow University"
        }
        provideContent {
            WidgetShell {
                Text(kicker, style = TextStyle(color = WidgetAccent, fontSize = 10.sp, fontWeight = FontWeight.Bold))
                Spacer(GlanceModifier.height(7.dp))
                Text(headline, style = TextStyle(color = WidgetText, fontSize = 19.sp, fontWeight = FontWeight.Bold))
                Spacer(GlanceModifier.height(5.dp))
                Text(detail, style = TextStyle(color = WidgetMuted, fontSize = 11.sp))
            }
        }
    }
}

class UniversityTodayWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val store = UniversityStore(context)
        val timetable = store.loadTimetable()
        val university = store.loadUniversity()
        val classes = timetable?.classesForDay(todayIndex()).orEmpty()
        provideContent {
            WidgetShell {
                Text("TODAY · ${university?.name ?: "FLOW"}", style = TextStyle(color = WidgetAccent, fontSize = 10.sp, fontWeight = FontWeight.Bold))
                Spacer(GlanceModifier.height(7.dp))
                Text(
                    if (timetable == null) "시간표를 연결하세요" else if (classes.isEmpty()) "오늘은 공강" else "오늘 ${classes.size}개 일정",
                    style = TextStyle(color = WidgetText, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                )
                Spacer(GlanceModifier.height(7.dp))
                if (classes.isEmpty()) {
                    Text("Flow University", style = TextStyle(color = WidgetMuted, fontSize = 11.sp))
                } else {
                    classes.take(3).forEach { item ->
                        Text("${item.time.start}  ${item.subject.name}", style = TextStyle(color = WidgetMuted, fontSize = 11.sp))
                        Spacer(GlanceModifier.height(3.dp))
                    }
                }
            }
        }
    }
}

class UniversityWeekWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val timetable = UniversityStore(context).loadTimetable()
        val days = listOf("월", "화", "수", "목", "금")
        val density = timetable?.let { tt ->
            days.mapIndexed { index, day -> "$day ${tt.classesForDay(index).size}" }.joinToString("  ·  ")
        } ?: "시간표 미등록"
        val credits = timetable?.totalCredits() ?: 0.0
        val minutes = timetable?.weeklyMinutes() ?: 0
        provideContent {
            WidgetShell {
                Text("WEEK LOAD", style = TextStyle(color = WidgetAccent, fontSize = 10.sp, fontWeight = FontWeight.Bold))
                Spacer(GlanceModifier.height(7.dp))
                Text(
                    if (timetable == null) "주간 흐름 준비 중" else "${trim(credits)}학점 · ${minutes / 60}h ${minutes % 60}m",
                    style = TextStyle(color = WidgetText, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                )
                Spacer(GlanceModifier.height(6.dp))
                Text(density, style = TextStyle(color = WidgetMuted, fontSize = 11.sp))
            }
        }
    }
}

class UniversityMiniWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val moment = UniversityStore(context).loadTimetable()?.classMoment()
        val item = moment?.current ?: moment?.next
        val prefix = if (moment?.current != null) "NOW" else if (moment?.next != null) "NEXT" else "FLOW"
        val title = item?.subject?.name ?: "수업 없음"
        val time = item?.let { if (moment?.current != null) "${it.time.end}까지" else it.time.start } ?: "University"
        provideContent {
            Column(
                modifier = GlanceModifier
                    .fillMaxSize()
                    .background(WidgetBackground)
                    .padding(11.dp)
                    .clickable(actionStartActivity<MainActivity>())
            ) {
                Text("$prefix · $time", style = TextStyle(color = WidgetAccent, fontSize = 9.sp, fontWeight = FontWeight.Bold))
                Spacer(GlanceModifier.height(4.dp))
                Text(title, style = TextStyle(color = WidgetText, fontSize = 14.sp, fontWeight = FontWeight.Bold))
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun WidgetShell(content: @androidx.compose.runtime.Composable () -> Unit) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetBackground)
            .padding(16.dp)
            .clickable(actionStartActivity<MainActivity>())
    ) {
        content()
    }
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

class UniversityWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = UniversityWidget()
    override fun onEnabled(context: Context) { super.onEnabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
    override fun onDisabled(context: Context) { super.onDisabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
}

class UniversityTodayWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = UniversityTodayWidget()
    override fun onEnabled(context: Context) { super.onEnabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
    override fun onDisabled(context: Context) { super.onDisabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
}

class UniversityWeekWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = UniversityWeekWidget()
    override fun onEnabled(context: Context) { super.onEnabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
    override fun onDisabled(context: Context) { super.onDisabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
}

class UniversityMiniWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = UniversityMiniWidget()
    override fun onEnabled(context: Context) { super.onEnabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
    override fun onDisabled(context: Context) { super.onDisabled(context); UniversitySurfaceScheduler.scheduleNext(context) }
}
