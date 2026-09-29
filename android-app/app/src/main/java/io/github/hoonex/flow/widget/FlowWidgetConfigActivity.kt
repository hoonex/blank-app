package io.github.hoonex.flow.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.lifecycle.lifecycleScope
import io.github.hoonex.flow.ui.FlowCard
import io.github.hoonex.flow.ui.FlowPalette
import io.github.hoonex.flow.ui.FlowPrimaryButton
import io.github.hoonex.flow.ui.FlowSectionTitle
import io.github.hoonex.flow.ui.FlowTheme
import kotlinx.coroutines.launch

enum class FlowWidgetSource { AUTO, SCHOOL, UNIVERSITY }
data class FlowWidgetConfig(val source: FlowWidgetSource = FlowWidgetSource.AUTO, val showContext: Boolean = true)

object FlowWidgetPreferences {
    private const val PREFS = "flow-widget-config-v1"
    fun load(context: Context, appWidgetId: Int): FlowWidgetConfig {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val source = prefs.getString("source_$appWidgetId", null)?.let { runCatching { FlowWidgetSource.valueOf(it) }.getOrNull() } ?: FlowWidgetSource.AUTO
        return FlowWidgetConfig(source, prefs.getBoolean("context_$appWidgetId", true))
    }
    fun save(context: Context, appWidgetId: Int, value: FlowWidgetConfig) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("source_$appWidgetId", value.source.name)
            .putBoolean("context_$appWidgetId", value.showContext)
            .apply()
    }
    fun delete(context: Context, appWidgetId: Int) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .remove("source_$appWidgetId")
            .remove("context_$appWidgetId")
            .apply()
    }
}

class FlowWidgetConfigActivity : ComponentActivity() {
    private var appWidgetId: Int = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        )
        appWidgetId = intent?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }
        setResult(Activity.RESULT_CANCELED, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
        val initial = FlowWidgetPreferences.load(this, appWidgetId)
        setContent {
            FlowTheme {
                var source by remember { mutableStateOf(initial.source) }
                var showContext by remember { mutableStateOf(initial.showContext) }
                LazyColumn(
                    Modifier.fillMaxSize().background(FlowPalette.Background).statusBarsPadding().navigationBarsPadding(),
                    contentPadding = PaddingValues(20.dp, 28.dp, 20.dp, 32.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    item {
                        io.github.hoonex.flow.ui.FlowLargeTitle("위젯 설정", "각 위젯의 데이터 소스와 표시 정보를 따로 정할 수 있습니다.")
                    }
                    item { FlowSectionTitle("", "데이터 소스", "하나 선택") }
                    item {
                        FlowCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.fillMaxWidth()) {
                                FlowWidgetSource.entries.forEachIndexed { index, option ->
                                    WidgetSourceRow(
                                        option = option,
                                        selected = source == option,
                                        onClick = { source = option }
                                    )
                                    if (index != FlowWidgetSource.entries.lastIndex) {
                                        Box(Modifier.fillMaxWidth().padding(horizontal = 17.dp).height(1.dp).background(FlowPalette.Stroke))
                                    }
                                }
                            }
                        }
                    }
                    item { FlowSectionTitle("", "표시 정보") }
                    item {
                        FlowCard(Modifier.fillMaxWidth()) {
                            Column(Modifier.fillMaxWidth()) {
                                Row(
                                    Modifier
                                        .fillMaxWidth()
                                        .toggleable(
                                            value = showContext,
                                            role = Role.Switch,
                                            onValueChange = { showContext = it }
                                        )
                                        .padding(horizontal = 17.dp, vertical = 15.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(Modifier.weight(1f)) {
                                        Text("세부 정보 표시", color = FlowPalette.Text, fontWeight = FontWeight.Black)
                                        Text("학교/대학 이름, 강의실 같은 보조 정보를 함께 표시합니다.", color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 4.dp))
                                    }
                                    Box(
                                        Modifier.clip(RoundedCornerShape(14.dp)).background(if (showContext) FlowPalette.Mint else FlowPalette.SurfaceRaised).padding(horizontal = 12.dp, vertical = 7.dp)
                                    ) {
                                        Text(if (showContext) "켬" else "끔", color = if (showContext) Color.White else FlowPalette.Muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                }
                                Box(Modifier.fillMaxWidth().padding(horizontal = 17.dp).height(1.dp).background(FlowPalette.Stroke))
                                Column(Modifier.fillMaxWidth().padding(horizontal = 17.dp, vertical = 15.dp)) {
                                    Text("Galaxy 잠금화면", color = FlowPalette.Text, fontWeight = FontWeight.SemiBold)
                                    Text("기본 목록에 Flow가 보이지 않으면 Good Lock → LockStar에서 잠금화면이나 AOD에 추가할 수 있습니다.", color = FlowPalette.Accent, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 6.dp))
                                }
                            }
                        }
                    }
                    item { FlowPrimaryButton("이 위젯에 적용", { saveAndFinish(FlowWidgetConfig(source, showContext)) }, Modifier.fillMaxWidth()) }
                }
            }
        }
    }

    private fun saveAndFinish(config: FlowWidgetConfig) {
        FlowWidgetPreferences.save(this, appWidgetId, config)
        val provider = AppWidgetManager.getInstance(this).getAppWidgetInfo(appWidgetId)?.provider?.className
        val widget: GlanceAppWidget = when (provider) {
            UniversityTodayWidgetReceiver::class.java.name -> UniversityTodayWidget()
            UniversityWeekWidgetReceiver::class.java.name -> UniversityWeekWidget()
            UniversityMiniWidgetReceiver::class.java.name -> UniversityMiniWidget()
            else -> UniversityWidget()
        }
        lifecycleScope.launch {
            runCatching {
                val glanceId = GlanceAppWidgetManager(this@FlowWidgetConfigActivity).getGlanceIdBy(appWidgetId)
                widget.update(this@FlowWidgetConfigActivity, glanceId)
            }
            setResult(Activity.RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
            finish()
        }
    }
}

@Composable
private fun WidgetSourceRow(option: FlowWidgetSource, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .selectable(
                selected = selected,
                role = Role.RadioButton,
                onClick = onClick
            )
            .padding(horizontal = 17.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(sourceTitle(option), color = FlowPalette.Text, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(sourceDescription(option), color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 4.dp))
        }
        Box(
            Modifier
                .size(28.dp)
                .clip(CircleShape)
                .background(if (selected) FlowPalette.Accent else FlowPalette.SurfaceRaised),
            contentAlignment = Alignment.Center
        ) {
            if (selected) {
                Text("✓", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

private fun sourceTitle(source: FlowWidgetSource) = when (source) {
    FlowWidgetSource.AUTO -> "자동"
    FlowWidgetSource.SCHOOL -> "학교"
    FlowWidgetSource.UNIVERSITY -> "대학교"
}

private fun sourceDescription(source: FlowWidgetSource) = when (source) {
    FlowWidgetSource.AUTO -> "현재 Flow 화면을 따라갑니다."
    FlowWidgetSource.SCHOOL -> "학교 시간표·급식·주간 데이터를 표시합니다."
    FlowWidgetSource.UNIVERSITY -> "대학 시간표와 현재·다음 수업을 표시합니다."
}
