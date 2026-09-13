package io.github.hoonex.flow.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.hoonex.flow.ui.FlowCard
import io.github.hoonex.flow.ui.FlowPalette
import io.github.hoonex.flow.ui.FlowPrimaryButton
import io.github.hoonex.flow.ui.FlowSectionTitle
import io.github.hoonex.flow.ui.FlowTheme

private data class WidgetChoice(
    val title: String,
    val subtitle: String,
    val size: String,
    val receiver: Class<*>
)

class FlowWidgetGalleryActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        )
        setContent {
            FlowTheme { WidgetGallery(onPin = ::requestPin) }
        }
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
}

@Composable
private fun WidgetGallery(onPin: (WidgetChoice) -> Unit) {
    val choices = listOf(
        WidgetChoice("다음 흐름", "현재/다음 수업을 가장 빠르게 확인", "2×2 · 크기 조절", UniversityWidgetReceiver::class.java),
        WidgetChoice("오늘 흐름", "오늘 수업을 여러 줄로 확인", "4×3 · 크기 조절", UniversityTodayWidgetReceiver::class.java),
        WidgetChoice("주간 흐름", "요일별 일정 밀도와 주간 부하", "4×2 · 크기 조절", UniversityWeekWidgetReceiver::class.java),
        WidgetChoice("Flow 미니", "한 줄 핵심 정보만 표시", "2×1 · 소형", UniversityMiniWidgetReceiver::class.java)
    )

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(FlowPalette.Background).statusBarsPadding().navigationBarsPadding(),
        contentPadding = PaddingValues(20.dp, 28.dp, 20.dp, 34.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            FlowSectionTitle("WIDGETS", "홈 화면에 Flow 추가", "4종")
            Text(
                "추가한 뒤 위젯을 길게 눌러 설정에서 Auto / School / University와 세부정보 표시를 위젯마다 따로 바꿀 수 있습니다.",
                color = FlowPalette.Muted,
                fontSize = 13.sp,
                lineHeight = 19.sp,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
        choices.forEach { choice ->
            item {
                FlowCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth().padding(18.dp)) {
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(choice.title, color = FlowPalette.Text, fontSize = 19.sp, fontWeight = FontWeight.Black)
                                Text(choice.subtitle, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                            }
                            Text(choice.size, color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                        FlowPrimaryButton("홈 화면에 추가", { onPin(choice) }, Modifier.fillMaxWidth().padding(top = 14.dp))
                    }
                }
            }
        }
        item {
            FlowCard(Modifier.fillMaxWidth(), accent = true) {
                Column(Modifier.padding(18.dp)) {
                    Text("잠금화면은 별도입니다", color = FlowPalette.Text, fontWeight = FontWeight.Black, fontSize = 16.sp)
                    Text(
                        "현행 Android 표준 AppWidget은 홈 화면용입니다. Galaxy에서 잠금화면/AOD에 서드파티 위젯을 쓰려면 지원되는 One UI에서 Good Lock → LockStar 경로를 사용하세요.",
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
