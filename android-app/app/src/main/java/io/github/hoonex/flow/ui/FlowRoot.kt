package io.github.hoonex.flow.ui

import android.content.Context
import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.hoonex.flow.data.SchoolStore
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.widget.FlowWidgetGalleryActivity

enum class FlowMode { SCHOOL, UNIVERSITY }

private enum class FlowDestination { SCHOOL, UNIVERSITY, PLANNER }

class FlowModeStore(context: Context) {
    private val prefs = context.getSharedPreferences("flow-native-shell-v1", Context.MODE_PRIVATE)
    fun load(): FlowMode? = prefs.getString("mode", null)?.let { runCatching { FlowMode.valueOf(it) }.getOrNull() }
    fun save(mode: FlowMode) { prefs.edit().putString("mode", mode.name).apply() }
}

@Composable
fun FlowRoot(enablePinnedNotification: () -> Unit, disablePinnedNotification: () -> Unit, checkUpdate: () -> Unit) {
    val context = LocalContext.current
    val store = remember { FlowModeStore(context) }
    val initialDestination = remember {
        when (store.load()) {
            FlowMode.SCHOOL -> FlowDestination.SCHOOL
            FlowMode.UNIVERSITY -> FlowDestination.UNIVERSITY
            null -> when {
                SchoolStore(context).loadSelection() != null -> FlowDestination.SCHOOL
                UniversityStore(context).loadUniversity() != null -> FlowDestination.UNIVERSITY
                else -> null
            }
        }
    }
    var destination by remember { mutableStateOf(initialDestination) }

    fun chooseAcademic(next: FlowMode) {
        store.save(next)
        destination = when (next) {
            FlowMode.SCHOOL -> FlowDestination.SCHOOL
            FlowMode.UNIVERSITY -> FlowDestination.UNIVERSITY
        }
    }

    BackHandler(enabled = destination != null) { destination = null }

    when (destination) {
        FlowDestination.SCHOOL -> FlowSchoolRoot(onSwitchUniversity = { chooseAcademic(FlowMode.UNIVERSITY) }, checkUpdate = checkUpdate)
        FlowDestination.UNIVERSITY -> FlowUniversityNativeRoot(enablePinnedNotification, disablePinnedNotification, checkUpdate)
        FlowDestination.PLANNER -> FlowPlannerRoot()
        null -> FlowHub(
            chooseSchool = { chooseAcademic(FlowMode.SCHOOL) },
            chooseUniversity = { chooseAcademic(FlowMode.UNIVERSITY) },
            choosePlanner = { destination = FlowDestination.PLANNER },
            openWidgets = { context.startActivity(Intent(context, FlowWidgetGalleryActivity::class.java)) }
        )
    }
}

@Composable
private fun FlowHub(
    chooseSchool: () -> Unit,
    chooseUniversity: () -> Unit,
    choosePlanner: () -> Unit,
    openWidgets: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(FlowPalette.Background),
        contentPadding = PaddingValues(start = 20.dp, top = 40.dp, end = 20.dp, bottom = 36.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        item {
            FlowBrand()
            Spacer(Modifier.height(34.dp))
            Text("FLOW · STUDENT LIFE", color = FlowPalette.Accent, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.25.sp)
            Text(
                "학교도, 대학도\n하나의 Flow.",
                color = FlowPalette.Text,
                fontSize = 36.sp,
                lineHeight = 39.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = (-1.25).sp,
                modifier = Modifier.padding(top = 8.dp)
            )
            Text(
                "시간표만 보는 앱이 아니라 오늘 수업, 일정, 과제, 급식, 공시, 캠퍼스와 위젯까지 학생 생활 전체를 같은 흐름으로 정리합니다.",
                color = FlowPalette.Muted,
                fontSize = 14.sp,
                lineHeight = 21.sp,
                modifier = Modifier.padding(top = 14.dp)
            )
        }

        item {
            FlowSectionTitle("MODE", "어디에서 시작할까요?", "언제든 전환")
            Spacer(Modifier.height(11.dp))
            FlowCard(modifier = Modifier.fillMaxWidth()) {
                Column {
                    FlowModeEntry(
                        badge = "S",
                        title = "학교 찾기 · Flow School",
                        description = "오늘 시간표 · 급식 · 학사일정 · 주간 시간표 · 네이티브 교통",
                        onClick = chooseSchool
                    )
                    Box(Modifier.fillMaxWidth().padding(horizontal = 18.dp).height(1.dp).background(FlowPalette.Stroke))
                    FlowModeEntry(
                        badge = "U",
                        title = "대학 찾기 · Flow University",
                        description = "에브리타임 · 공시 · 학과 · 네이티브 캠퍼스 · 위젯 · 알림",
                        onClick = chooseUniversity
                    )
                }
            }
        }

        item {
            FlowSectionTitle("QUICK ACCESS", "학생 생활 도구")
            Spacer(Modifier.height(11.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                FlowToolTile(
                    modifier = Modifier.weight(1f),
                    kicker = "PLANNER",
                    title = "과제 · 시험",
                    description = "School과 University의 할 일을 한 목록에서 관리",
                    onClick = choosePlanner
                )
                FlowToolTile(
                    modifier = Modifier.weight(1f),
                    kicker = "WIDGETS",
                    title = "Flow 위젯",
                    description = "다음 수업 · 오늘 · 주간 · 미니를 홈 화면에 배치",
                    onClick = openWidgets
                )
            }
        }

        item {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(17.dp))
                    .background(FlowPalette.SurfaceSoft)
                    .border(1.dp, FlowPalette.Stroke, RoundedCornerShape(17.dp))
                    .padding(horizontal = 15.dp, vertical = 13.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    Modifier
                        .size(8.dp)
                        .clip(RoundedCornerShape(99.dp))
                        .background(FlowPalette.Accent)
                )
                Text(
                    "화면은 앱에서 직접 렌더링하고, 서버는 데이터만 제공합니다. 뒤로가기로 이 허브에 돌아와 모드를 바꿀 수 있습니다.",
                    color = FlowPalette.Muted,
                    fontSize = 11.sp,
                    lineHeight = 17.sp,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun FlowModeEntry(
    badge: String,
    title: String,
    description: String,
    onClick: () -> Unit
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Box(
            Modifier
                .size(42.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(FlowPalette.Accent.copy(alpha = 0.12f))
                .border(1.dp, FlowPalette.Accent.copy(alpha = 0.18f), RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text(badge, color = FlowPalette.Accent, fontSize = 14.sp, fontWeight = FontWeight.Black)
        }
        Column(Modifier.weight(1f)) {
            Text(title, color = FlowPalette.Text, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(description, color = FlowPalette.Muted, fontSize = 12.sp, lineHeight = 17.sp, modifier = Modifier.padding(top = 5.dp))
        }
        Text("›", color = FlowPalette.Dim, fontSize = 24.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun FlowToolTile(
    modifier: Modifier,
    kicker: String,
    title: String,
    description: String,
    onClick: () -> Unit
) {
    FlowCard(modifier = modifier, onClick = onClick) {
        Column(Modifier.padding(16.dp)) {
            Text(kicker, color = FlowPalette.Accent, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.05.sp)
            Text(title, color = FlowPalette.Text, fontSize = 16.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 7.dp))
            Text(description, color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 6.dp))
        }
    }
}
