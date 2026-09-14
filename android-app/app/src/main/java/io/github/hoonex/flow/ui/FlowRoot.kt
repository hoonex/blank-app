package io.github.hoonex.flow.ui

import android.content.Context
import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.graphics.Brush
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
    FlowBackdrop(accent = FlowPalette.School) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 42.dp, bottom = 42.dp),
            verticalArrangement = Arrangement.spacedBy(13.dp)
        ) {
            item {
                FlowBrand()
                Spacer(Modifier.height(28.dp))
                FlowPill("FLOW / DAILY SYSTEM", FlowPalette.Mint)
                Spacer(Modifier.height(13.dp))
                Text("학교도, 대학도", color = FlowPalette.Muted, fontSize = 17.sp, fontWeight = FontWeight.Bold)
                Text(
                    "오늘 필요한\n흐름만.",
                    color = FlowPalette.Text,
                    fontSize = 43.sp,
                    lineHeight = 44.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-1.2).sp,
                    modifier = Modifier.padding(top = 2.dp)
                )
                Text(
                    "시간표부터 급식, 과제, 캠퍼스와 위젯까지. 웹 페이지를 여는 대신 Flow가 직접 기억하고 보여줍니다.",
                    color = FlowPalette.Muted,
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                    modifier = Modifier.padding(top = 13.dp, bottom = 10.dp)
                )
            }

            item {
                ServiceCard(
                    eyebrow = "SCHOOL",
                    title = "Flow School",
                    description = "수업 · 급식 · 학사일정 · 교통",
                    footer = "오늘 학교 생활 바로 보기",
                    accent = FlowPalette.School,
                    mark = "S",
                    onClick = chooseSchool
                )
            }
            item {
                ServiceCard(
                    eyebrow = "UNIVERSITY",
                    title = "Flow University",
                    description = "에브리타임 · 공시 · 학과 · 캠퍼스",
                    footer = "대학 생활 흐름 이어가기",
                    accent = FlowPalette.University,
                    mark = "U",
                    onClick = chooseUniversity
                )
            }
            item {
                Spacer(Modifier.height(5.dp))
                Text("YOUR LAYER", color = FlowPalette.Dim, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.35.sp)
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CompactService(
                        modifier = Modifier.weight(1f),
                        title = "Planner",
                        subtitle = "과제 · 시험 · 할 일",
                        mark = "P",
                        accent = FlowPalette.Planner,
                        onClick = choosePlanner
                    )
                    CompactService(
                        modifier = Modifier.weight(1f),
                        title = "Widgets",
                        subtitle = "홈 화면 · 표시 설정",
                        mark = "W",
                        accent = FlowPalette.Mint,
                        onClick = openWidgets
                    )
                }
            }
            item {
                Text(
                    "뒤로가기를 누르면 이 허브로 돌아와 School · University · Planner를 바로 전환합니다.",
                    color = FlowPalette.Dim,
                    fontSize = 10.sp,
                    lineHeight = 15.sp,
                    modifier = Modifier.padding(top = 9.dp, start = 2.dp, end = 10.dp)
                )
            }
        }
    }
}

@Composable
private fun ServiceCard(
    eyebrow: String,
    title: String,
    description: String,
    footer: String,
    accent: Color,
    mark: String,
    onClick: () -> Unit
) {
    FlowCard(
        modifier = Modifier.fillMaxWidth(),
        accent = true,
        onClick = onClick,
        accentColor = accent
    ) {
        Box(Modifier.fillMaxWidth().padding(18.dp)) {
            Column(Modifier.fillMaxWidth().padding(end = 54.dp)) {
                Text(eyebrow, color = accent, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.35.sp)
                Text(title, color = FlowPalette.Text, fontSize = 25.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.45).sp, modifier = Modifier.padding(top = 6.dp))
                Text(description, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 18.dp)) {
                    Text(footer, color = accent, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text("  →", color = accent, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
            }
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .size(43.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Brush.linearGradient(listOf(accent.copy(alpha = 0.22f), accent.copy(alpha = 0.07f)))),
                contentAlignment = Alignment.Center
            ) {
                Text(mark, color = accent, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

@Composable
private fun CompactService(
    modifier: Modifier,
    title: String,
    subtitle: String,
    mark: String,
    accent: Color,
    onClick: () -> Unit
) {
    FlowCard(modifier = modifier, onClick = onClick, accentColor = accent) {
        Column(Modifier.fillMaxWidth().padding(15.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(31.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(accent.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(mark, color = accent, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                }
                Spacer(Modifier.width(9.dp))
                Text(title, color = FlowPalette.Text, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
            }
            Text(subtitle, color = FlowPalette.Muted, fontSize = 10.sp, lineHeight = 14.sp, modifier = Modifier.padding(top = 12.dp))
            Text("OPEN  ↗", color = accent, fontSize = 8.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.8.sp, modifier = Modifier.padding(top = 14.dp))
        }
    }
}
