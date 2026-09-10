package io.github.hoonex.flow.widget

import android.content.Context
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.clickable
import androidx.glance.layout.Column
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.action.actionStartActivity
import io.github.hoonex.flow.MainActivity
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.data.classMoment

class UniversityWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val store = UniversityStore(context)
        val university = store.loadUniversity()
        val moment = store.loadTimetable()?.classMoment()
        val headline = when {
            moment?.current != null -> "지금 · ${moment.current.subject.name}"
            moment?.next != null -> "다음 · ${moment.next.subject.name}"
            else -> "오늘 수업 없음"
        }
        val detail = when {
            moment?.current != null -> "${moment.current.time.end} 종료"
            moment?.next != null -> "${moment.next.time.start} 시작"
            else -> "Flow University"
        }
        provideContent {
            Column(
                modifier = GlanceModifier
                    .fillMaxSize()
                    .background(ColorProvider(Color(0xFF111519)))
                    .padding(16.dp)
                    .clickable(actionStartActivity<MainActivity>())
            ) {
                Text(
                    university?.name ?: "Flow",
                    style = TextStyle(color = ColorProvider(Color(0xFF7BE7D6)), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                )
                Spacer(GlanceModifier.height(7.dp))
                Text(
                    headline,
                    style = TextStyle(color = ColorProvider(Color.White), fontSize = 18.sp, fontWeight = FontWeight.Bold)
                )
                Spacer(GlanceModifier.height(4.dp))
                Text(detail, style = TextStyle(color = ColorProvider(Color(0xFFB9C0C7)), fontSize = 12.sp))
            }
        }
    }
}

class UniversityWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = UniversityWidget()
}
