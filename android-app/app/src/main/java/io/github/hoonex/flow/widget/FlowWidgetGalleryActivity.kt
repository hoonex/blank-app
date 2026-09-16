package io.github.hoonex.flow.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.hoonex.flow.ui.FlowCard
import io.github.hoonex.flow.ui.FlowPalette
import io.github.hoonex.flow.ui.FlowSectionTitle
import io.github.hoonex.flow.ui.FlowTheme

private data class WidgetChoice(
    val title: String,
    val subtitle: String,
    val size: String,
    val receiver: Class<*>
)

private data class InstalledFlowWidget(
    val appWidgetId: Int,
    val title: String,
    val config: FlowWidgetConfig
)

class FlowWidgetGalleryActivity : ComponentActivity() {
    private val installedWidgets = mutableStateOf<List<InstalledFlowWidget>>(emptyList())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        )
        setContent {
            FlowTheme {
                WidgetGallery(
                    installed = installedWidgets,
                    onPin = ::requestPin,
                    onConfigure = ::openConfig
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        installedWidgets.value = loadInstalledWidgets()
    }

    private fun requestPin(choice: WidgetChoice) {
        val manager = AppWidgetManager.getInstance(this)
        if (!manager.isRequestPinAppWidgetSupported) {
            Toast.makeText(this, "현재 런처는 앱 내 위젯 추가를 지원하지 않습니다. 홈 화면 위젯 선택기를 사용하세요.", Toast.LENGTH_LONG).show()
            return
        }
        val accepted = manager.requestPinAppWidget(ComponentName(this, choice.receiver), null, null)
        Toast.makeText(
            this,
            if (accepted) "홈 화면에서 추가 위치를 확인하세요." else "런처가 위젯 추가 요청을 받지 않았습니다.",
            Toast.LENGTH_SHORT
        ).show()
    }

    private fun openConfig(widget: InstalledFlowWidget) {
        startActivity(
            Intent(this, FlowWidgetConfigActivity::class.java)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widget.appWidgetId)
        )
    }

    private fun loadInstalledWidgets(): List<InstalledFlowWidget> {
        val manager = AppWidgetManager.getInstance(this)
        val providers = listOf(
            Triple(UniversityWidgetReceiver::class.java, "다음 흐름", UniversityWidgetReceiver::class.java.name),
            Triple(UniversityTodayWidgetReceiver::class.java, "오늘 흐름", UniversityTodayWidgetReceiver::class.java.name),
            Triple(UniversityWeekWidgetReceiver::class.java, "주간 흐름", UniversityWeekWidgetReceiver::class.java.name),
            Triple(UniversityMiniWidgetReceiver::class.java, "Flow 미니", UniversityMiniWidgetReceiver::class.java.name)
        )
        return providers.flatMap { (receiver, title, _) ->
            manager.getAppWidgetIds(ComponentName(this, receiver)).map { id ->
                InstalledFlowWidget(id, title, FlowWidgetPreferences.load(this, id))
            }
        }.sortedBy { it.appWidgetId }
    }
}

@Composable
private fun WidgetGallery(
    installed: State<List<InstalledFlowWidget>>,
    onPin: (WidgetChoice) -> Unit,
    onConfigure: (InstalledFlowWidget) -> Unit
) {
    val choices = listOf(
        WidgetChoice("다음 흐름", "현재/다음 수업을 가장 빠르게 확인", "2×2 · 크기 조절", UniversityWidgetReceiver::class.java),
        WidgetChoice("오늘 흐름", "오늘 수업을 여러 줄로 확인", "4×3 · 크기 조절", UniversityTodayWidgetReceiver::class.java),
        WidgetChoice("주간 흐름", "요일별 일정 밀도와 주간 부하", "4×2 · 크기 조절", UniversityWeekWidgetReceiver::class.java),
        WidgetChoice("Flow 미니", "한 줄 핵심 정보만 표시", "2×1 · 소형", UniversityMiniWidgetReceiver::class.java)
    )
    val active = installed.value

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(FlowPalette.Background).statusBarsPadding().navigationBarsPadding(),
        contentPadding = PaddingValues(20.dp, 28.dp, 20.dp, 34.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            FlowSectionTitle("WIDGETS", "Flow 위젯", "4종")
            Text(
                "홈 화면에 추가한 뒤에도 이 화면에서 설치된 위젯마다 Auto / School / University와 세부정보 표시를 따로 바꿀 수 있습니다.",
                color = FlowPalette.Muted,
                fontSize = 13.sp,
                lineHeight = 19.sp,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        if (active.isNotEmpty()) {
            item { FlowSectionTitle("INSTALLED", "설치된 위젯", "${active.size}개") }
            item {
                FlowCard(Modifier.fillMaxWidth(), accent = true) {
                    Column(Modifier.fillMaxWidth()) {
                        active.forEachIndexed { index, widget ->
                            InstalledWidgetRow(widget, onConfigure)
                            if (index != active.lastIndex) {
                                Box(Modifier.fillMaxWidth().padding(horizontal = 17.dp).height(1.dp).background(FlowPalette.Stroke))
                            }
                        }
                    }
                }
            }
        } else {
            item {
                FlowCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(18.dp)) {
                        Text("설치된 Flow 위젯 없음", color = FlowPalette.Text, fontWeight = FontWeight.Black)
                        Text("아래에서 위젯을 추가하면 여기에서 각 위젯의 데이터 소스와 세부정보를 바로 관리할 수 있습니다.", color = FlowPalette.Muted, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 5.dp))
                    }
                }
            }
        }

        item { FlowSectionTitle("ADD", "새 위젯 추가", "홈 화면") }
        item {
            FlowCard(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) {
                    choices.forEachIndexed { index, choice ->
                        WidgetChoiceRow(choice, onPin)
                        if (index != choices.lastIndex) {
                            Box(Modifier.fillMaxWidth().padding(horizontal = 17.dp).height(1.dp).background(FlowPalette.Stroke))
                        }
                    }
                }
            }
        }
        item {
            FlowCard(Modifier.fillMaxWidth(), accent = true) {
                Column(Modifier.padding(18.dp)) {
                    Text("Galaxy 잠금화면 / AOD", color = FlowPalette.Text, fontWeight = FontWeight.Black, fontSize = 16.sp)
                    Text(
                        "Galaxy의 기본 잠금화면 위젯 목록은 일반 서드파티 AppWidget을 그대로 노출하지 않을 수 있습니다. 지원되는 One UI에서는 Good Lock → LockStar에서 Flow 위젯을 배치하세요. 앱이 잠금화면 호스트를 강제로 등록할 수는 없습니다.",
                        color = FlowPalette.Muted,
                        fontSize = 12.sp,
                        lineHeight = 18.sp,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun InstalledWidgetRow(widget: InstalledFlowWidget, onConfigure: (InstalledFlowWidget) -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 17.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(widget.title, color = FlowPalette.Text, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(
                "#${widget.appWidgetId} · ${sourceLabel(widget.config.source)} · 세부정보 ${if (widget.config.showContext) "ON" else "OFF"}",
                color = FlowPalette.Muted,
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
        WidgetCompactAction("설정") { onConfigure(widget) }
    }
}

@Composable
private fun WidgetChoiceRow(choice: WidgetChoice, onPin: (WidgetChoice) -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 17.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Column(Modifier.weight(1f)) {
            Text(choice.title, color = FlowPalette.Text, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(choice.subtitle, color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 4.dp))
            Text(choice.size, color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 5.dp))
        }
        WidgetCompactAction("추가") { onPin(choice) }
    }
}

@Composable
private fun WidgetCompactAction(label: String, onClick: () -> Unit) {
    Box(
        Modifier
            .clip(RoundedCornerShape(13.dp))
            .background(FlowPalette.SurfaceRaised)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(label, color = FlowPalette.Mint, fontSize = 11.sp, fontWeight = FontWeight.Black)
    }
}

private fun sourceLabel(source: FlowWidgetSource): String = when (source) {
    FlowWidgetSource.AUTO -> "AUTO"
    FlowWidgetSource.SCHOOL -> "SCHOOL"
    FlowWidgetSource.UNIVERSITY -> "UNIVERSITY"
}
