package io.github.hoonex.flow.ui

import android.content.Context
import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
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
import io.github.hoonex.flow.data.schoolDate8
import io.github.hoonex.flow.data.totalCredits
import io.github.hoonex.flow.widget.FlowWidgetGalleryActivity
import java.util.Locale
import kotlin.math.roundToInt

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
            null -> null
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
    val context = LocalContext.current
    val schoolStore = remember { SchoolStore(context) }
    val universityStore = remember { UniversityStore(context) }
    val school = remember { schoolStore.loadSelection() }
    val schoolDashboard = remember { schoolStore.loadDashboard() }
    val university = remember { universityStore.loadUniversity() }
    val universityMajor = remember { universityStore.loadMajor() }
    val timetable = remember { universityStore.loadTimetable() }

    val schoolStatus = school?.let { "${it.school.name} · ${it.grade}학년 ${it.className}반" } ?: "학교를 연결해 시작"
    val schoolToday = schoolDashboard?.classesOn(schoolDate8()).orEmpty()
    val schoolMeta = when {
        school == null -> "수업 · 급식 · 학사일정 · 교통"
        schoolDashboard == null -> "학교 연결됨 · 오늘 데이터 새로고침 필요"
        else -> "오늘 ${schoolToday.size}교시 · 급식 ${schoolDashboard.mealsOn(schoolDate8()).size}건"
    }

    val universityStatus = university?.let { uni ->
        listOf(uni.name, universityMajor?.name.orEmpty()).filter(String::isNotBlank).joinToString(" · ")
    } ?: "대학을 연결해 시작"
    val universityMeta = when {
        university == null -> "에브리타임 · 공시 · 학과 · 캠퍼스"
        timetable == null -> "대학 연결됨 · 에브리타임 시간표 연결 필요"
        else -> "${timetable.subjects.size}과목 · ${formatCredits(timetable.totalCredits())}학점 · 네이티브 캠퍼스"
    }

    FlowBackdrop(accent = FlowPalette.School) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 28.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    FlowBrand(modifier = Modifier.weight(1f))
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .clickable { FlowAppearance.toggle(context) }
                    ) {
                        FlowPill(if (FlowAppearance.isLight) "LIGHT" else "DARK", FlowPalette.Mint)
                    }
                }
                Spacer(Modifier.height(15.dp))
                Text("학교도, 대학도", color = FlowPalette.Muted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                Text("두 개의 생활, 하나의 Flow.", color = FlowPalette.Text, fontSize = 28.sp, lineHeight = 32.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.7).sp, modifier = Modifier.padding(top = 2.dp))
                Text(
                    "School은 학교 생활을, University는 대학 생활을 맡습니다. 일정은 각 서비스 안에서 필요한 만큼만 다룹니다.",
                    color = FlowPalette.Muted,
                    fontSize = 10.5.sp,
                    lineHeight = 15.sp,
                    modifier = Modifier.padding(top = 6.dp, bottom = 2.dp)
                )
            }

            item {
                ServiceCard(
                    eyebrow = "SCHOOL",
                    title = "Flow School",
                    status = schoolStatus,
                    description = schoolMeta,
                    footer = if (school == null) "학교 설정" else "오늘 학교 열기",
                    accent = FlowPalette.School,
                    mark = "S",
                    onClick = chooseSchool
                )
            }
            item {
                ServiceCard(
                    eyebrow = "UNIVERSITY",
                    title = "Flow University",
                    status = universityStatus,
                    description = universityMeta,
                    footer = if (university == null) "대학 설정" else "대학 Flow 열기",
                    accent = FlowPalette.University,
                    mark = "U",
                    onClick = chooseUniversity
                )
            }
            item {
                Row(
                    Modifier.fillMaxWidth().padding(top = 2.dp),
                    horizontalArrangement = Arrangement.spacedBy(9.dp)
                ) {
                    CompactService(
                        modifier = Modifier.weight(1f),
                        title = "공통 할 일",
                        subtitle = "School·University 보조",
                        mark = "✓",
                        accent = FlowPalette.Planner,
                        onClick = choosePlanner
                    )
                    CompactService(
                        modifier = Modifier.weight(1f),
                        title = "위젯 관리",
                        subtitle = "소스·표시 방식 설정",
                        mark = "W",
                        accent = FlowPalette.Mint,
                        onClick = openWidgets
                    )
                }
            }
        }
    }
}

@Composable
private fun ServiceCard(
    eyebrow: String,
    title: String,
    status: String,
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
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f).padding(end = 10.dp)) {
                Text(eyebrow, color = accent, fontSize = 8.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.25.sp)
                Text(title, color = FlowPalette.Text, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.35).sp, modifier = Modifier.padding(top = 3.dp))
                Text(status, color = FlowPalette.Text, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                Text(description, color = FlowPalette.Muted, fontSize = 9.5.sp, lineHeight = 13.sp, modifier = Modifier.padding(top = 3.dp))
                Text("$footer  →", color = accent, fontSize = 8.5.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.padding(top = 8.dp))
            }
            Box(
                Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(13.dp))
                    .background(Brush.linearGradient(listOf(accent.copy(alpha = 0.2f), accent.copy(alpha = 0.07f)))),
                contentAlignment = Alignment.Center
            ) {
                Text(mark, color = accent, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
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
        Row(Modifier.fillMaxWidth().padding(11.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(9.dp))
                    .background(accent.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Text(mark, color = accent, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
            }
            Spacer(Modifier.width(7.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = FlowPalette.Text, fontSize = 11.5.sp, fontWeight = FontWeight.ExtraBold)
                Text(subtitle, color = FlowPalette.Muted, fontSize = 7.5.sp, lineHeight = 10.sp, modifier = Modifier.padding(top = 2.dp))
            }
        }
    }
}

private fun formatCredits(value: Double): String = if (value % 1.0 == 0.0) value.roundToInt().toString() else String.format(Locale.US, "%.1f", value)
