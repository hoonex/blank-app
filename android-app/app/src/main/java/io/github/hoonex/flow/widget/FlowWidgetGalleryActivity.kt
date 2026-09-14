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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.hoonex.flow.ui.FlowBackdrop
import io.github.hoonex.flow.ui.FlowCard
import io.github.hoonex.flow.ui.FlowPalette
import io.github.hoonex.flow.ui.FlowPill
import io.github.hoonex.flow.ui.FlowPrimaryButton
import io.github.hoonex.flow.ui.FlowSecondaryButton
import io.github.hoonex.flow.ui.FlowSectionTitle
import io.github.hoonex.flow.ui.FlowTheme

private data class WidgetChoice(
    val title: String,
    val subtitle: String,
    val size: String,
    val receiver: Class<*>,
    val mark: String,
    val accent: Color
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
            Pair(UniversityWidgetReceiver::class.java, "다음 흐름"),
            Pair(UniversityTodayWidgetReceiver::class.java, "오늘 흐름"),
            Pair(UniversityWeekWidgetReceiver::class.java, "주간 흐름"),
            Pair(UniversityMiniWidgetReceiver::class.java, "Flow 미니")
        )
        return providers.flatMap { (receiver, title) ->
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
        WidgetChoice("다음 흐름", "현재/다음 수업을 가장 빠르게 확인", "2×2", UniversityWidgetReceiver::class.java, "N", FlowPalette.Mint),
        WidgetChoice("오늘 흐름", "오늘 수업을 여러 줄로 확인", "4×3", UniversityTodayWidgetReceiver::class.java, "T", FlowPalette.School),
        WidgetChoice("주간 흐름", "요일별 일정 밀도와 주간 부하", "4×2", UniversityWeekWidgetReceiver::class.java, "W", FlowPalette.Planner),
        WidgetChoice("Flow 미니", "한 줄 핵심 정보만 표시", "2×1", UniversityMiniWidgetReceiver::class.java, "M", FlowPalette.Warm)
    )
    val active = installed.value

    FlowBackdrop(accent = FlowPalette.Mint) {
        LazyColumn(
            modifier = Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding(),
            contentPadding = PaddingValues(20.dp, 28.dp, 20.dp, 34.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("WIDGETS", color = FlowPalette.Mint, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.35.sp)
                        Text("Flow 위젯", color = FlowPalette.Text, fontSize = 32.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.65).sp, modifier = Modifier.padding(top = 5.dp))
                    }
                    FlowPill("4 TYPES", FlowPalette.Mint)
                }
                Text(
                    "설치한 위젯마다 School / University 소스와 세부정보 표시를 따로 바꿀 수 있습니다.",
                    color = FlowPalette.Muted,
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            if (active.isNotEmpty()) {
                item { FlowSectionTitle("INSTALLED", "설치된 위젯", "${active.size}개") }
                active.forEach { widget ->
                    item(key = "installed-${widget.appWidgetId}") {
                        val accent = when (widget.config.source) {
                            FlowWidgetSource.SCHOOL -> FlowPalette.School
                            FlowWidgetSource.UNIVERSITY -> FlowPalette.University
                            FlowWidgetSource.AUTO -> FlowPalette.Mint
                        }
                        FlowCard(Modifier.fillMaxWidth(), accent = true, accentColor = accent) {
                            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                    WidgetMark(widget.title.take(1), accent)
                                    Spacer(Modifier.width(12.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(widget.title, color = FlowPalette.Text, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
                                        Text(
                                            "#${widget.appWidgetId} · ${sourceLabel(widget.config.source)}",
                                            color = FlowPalette.Muted,
                                            fontSize = 10.sp,
                                            modifier = Modifier.padding(top = 3.dp)
                                        )
                                    }
                                    FlowPill(if (widget.config.showContext) "DETAIL ON" else "DETAIL OFF", accent)
                                }
                                FlowPrimaryButton(
                                    "이 위젯 설정",
                                    { onConfigure(widget) },
                                    Modifier.fillMaxWidth().padding(top = 13.dp)
                                )
                            }
                        }
                    }
                }
            } else {
                item {
                    FlowCard(Modifier.fillMaxWidth(), accent = true, accentColor = FlowPalette.Mint) {
                        Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                            WidgetMark("+", FlowPalette.Mint)
                            Column(Modifier.padding(start = 13.dp).weight(1f)) {
                                Text("아직 설치된 위젯이 없어요", color = FlowPalette.Text, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                                Text("아래에서 원하는 형태를 골라 홈 화면에 바로 추가할 수 있습니다.", color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 4.dp))
                            }
                        }
                    }
                }
            }

            item { FlowSectionTitle("ADD", "새 위젯 추가", "홈 화면") }
            choices.forEach { choice ->
                item {
                    FlowCard(Modifier.fillMaxWidth(), accentColor = choice.accent) {
                        Column(Modifier.fillMaxWidth().padding(18.dp)) {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                WidgetMark(choice.mark, choice.accent)
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(choice.title, color = FlowPalette.Text, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                                    Text(choice.subtitle, color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 3.dp))
                                }
                                FlowPill(choice.size, choice.accent)
                            }
                            FlowSecondaryButton("홈 화면에 추가", { onPin(choice) }, Modifier.fillMaxWidth().padding(top = 14.dp))
                        }
                    }
                }
            }
            item {
                FlowCard(Modifier.fillMaxWidth(), accentColor = FlowPalette.Dim) {
                    Column(Modifier.padding(18.dp)) {
                        FlowPill("GALAXY", FlowPalette.Dim)
                        Text("잠금화면 / AOD", color = FlowPalette.Text, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, modifier = Modifier.padding(top = 9.dp))
                        Text(
                            "Galaxy 기본 잠금화면 편집기는 일반 서드파티 AppWidget을 숨길 수 있습니다. 지원되는 One UI에서는 Good Lock → LockStar에서 Flow 위젯을 배치할 수 있습니다.",
                            color = FlowPalette.Muted,
                            fontSize = 11.sp,
                            lineHeight = 17.sp,
                            modifier = Modifier.padding(top = 5.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun WidgetMark(mark: String, accent: Color) {
    Box(
        Modifier
            .size(39.dp)
            .clip(RoundedCornerShape(13.dp))
            .background(accent.copy(alpha = 0.13f)),
        contentAlignment = Alignment.Center
    ) {
        Text(mark, color = accent, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
    }
}

private fun sourceLabel(source: FlowWidgetSource): String = when (source) {
    FlowWidgetSource.AUTO -> "AUTO"
    FlowWidgetSource.SCHOOL -> "SCHOOL"
    FlowWidgetSource.UNIVERSITY -> "UNIVERSITY"
}
