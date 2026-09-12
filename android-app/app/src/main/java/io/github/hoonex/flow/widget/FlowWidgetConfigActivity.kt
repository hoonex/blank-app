package io.github.hoonex.flow.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
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
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("source_$appWidgetId", value.source.name).putBoolean("context_$appWidgetId", value.showContext).apply()
    }
    fun delete(context: Context, appWidgetId: Int) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("source_$appWidgetId").remove("context_$appWidgetId").apply()
    }
}

class FlowWidgetConfigActivity : ComponentActivity() {
    private var appWidgetId: Int = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        appWidgetId = intent?.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID) ?: AppWidgetManager.INVALID_APPWIDGET_ID
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return }
        setResult(Activity.RESULT_CANCELED, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId))
        val initial = FlowWidgetPreferences.load(this, appWidgetId)
        setContent {
            FlowTheme {
                var source by remember { mutableStateOf(initial.source) }
                var showContext by remember { mutableStateOf(initial.showContext) }
                LazyColumn(Modifier.fillMaxSize().background(FlowPalette.Background), contentPadding = PaddingValues(20.dp,36.dp,20.dp,32.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    item {
                        FlowSectionTitle("WIDGET", "위젯 설정", "위젯별 저장")
                        Text("어떤 Flow 프로필을 보여줄지 선택합니다. 자동은 마지막으로 사용한 School / University 모드를 따라갑니다.", color = FlowPalette.Muted, fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 8.dp))
                    }
                    FlowWidgetSource.entries.forEach { item -> item {
                        FlowCard(Modifier.fillMaxWidth(), accent = source == item, onClick = { source = item }) {
                            Column(Modifier.padding(17.dp)) {
                                Text(when(item){ FlowWidgetSource.AUTO->"자동"; FlowWidgetSource.SCHOOL->"School"; FlowWidgetSource.UNIVERSITY->"University" }, color = FlowPalette.Text, fontSize = 17.sp, fontWeight = FontWeight.Black)
                                Text(when(item){ FlowWidgetSource.AUTO->"현재 Flow 모드를 따라갑니다."; FlowWidgetSource.SCHOOL->"학교 시간표·급식·주간 데이터를 표시합니다."; FlowWidgetSource.UNIVERSITY->"대학 시간표와 현재·다음 수업을 표시합니다." }, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
                            }
                        }
                    } }
                    item {
                        FlowCard(Modifier.fillMaxWidth(), onClick = { showContext = !showContext }) {
                            androidx.compose.foundation.layout.Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                                Checkbox(showContext, { showContext = it })
                                Column(Modifier.padding(start = 8.dp)) { Text("세부 정보 표시", color = FlowPalette.Text, fontWeight = FontWeight.Bold); Text("학교/대학 이름, 강의실 같은 보조 정보", color = FlowPalette.Muted, fontSize = 11.sp) }
                            }
                        }
                    }
                    item { FlowCard(Modifier.fillMaxWidth()) { Column(Modifier.padding(17.dp)) {
                        Text("Galaxy S25 잠금화면", color = FlowPalette.Text, fontWeight = FontWeight.Black)
                        Text("삼성 기본 Brief 위젯에는 일반 서드파티 AppWidget이 안 뜰 수 있습니다. Good Lock → LockStar에서 Flow 위젯을 잠금화면/AOD에 추가하세요.", color = FlowPalette.Mint, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 6.dp))
                    } } }
                    item { FlowPrimaryButton("이 위젯에 적용", { saveAndFinish(FlowWidgetConfig(source,showContext)) }, Modifier.fillMaxWidth()) }
                }
            }
        }
    }

    private fun saveAndFinish(config: FlowWidgetConfig) {
        FlowWidgetPreferences.save(this, appWidgetId, config)
        val provider = AppWidgetManager.getInstance(this).getAppWidgetInfo(appWidgetId)?.provider?.className
        val widget: GlanceAppWidget = when(provider) {
            UniversityTodayWidgetReceiver::class.java.name -> UniversityTodayWidget()
            UniversityWeekWidgetReceiver::class.java.name -> UniversityWeekWidget()
            UniversityMiniWidgetReceiver::class.java.name -> UniversityMiniWidget()
            else -> UniversityWidget()
        }
        lifecycleScope.launch {
            runCatching { val glanceId = GlanceAppWidgetManager(this@FlowWidgetConfigActivity).getGlanceIdBy(appWidgetId); widget.update(this@FlowWidgetConfigActivity, glanceId) }
            setResult(Activity.RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)); finish()
        }
    }
}
