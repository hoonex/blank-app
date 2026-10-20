package io.github.hoonex.flow.ui

import android.content.Context
import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
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
    fun requestPlannerEntry() { prefs.edit().putBoolean("planner-entry-once", true).apply() }
    fun consumePlannerEntry(): Boolean {
        val requested = prefs.getBoolean("planner-entry-once", false)
        if (requested) prefs.edit().remove("planner-entry-once").apply()
        return requested
    }
}

@Composable
fun FlowRoot(enablePinnedNotification: () -> Unit, disablePinnedNotification: () -> Unit, checkUpdate: () -> Unit) {
    val context = LocalContext.current
    val store = remember { FlowModeStore(context) }
    val initialDestination = remember {
        if (store.consumePlannerEntry()) {
            FlowDestination.PLANNER
        } else {
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
    }
    var destinationName by rememberSaveable { mutableStateOf(initialDestination?.name) }
    var plannerReturnName by rememberSaveable { mutableStateOf<String?>(null) }
    val destination = destinationName?.let { saved -> runCatching { FlowDestination.valueOf(saved) }.getOrNull() }

    fun setDestination(next: FlowDestination?) {
        destinationName = next?.name
    }

    fun openPlannerFrom(origin: FlowDestination?) {
        plannerReturnName = origin?.name
        setDestination(FlowDestination.PLANNER)
    }

    fun chooseAcademic(next: FlowMode) {
        store.save(next)
        setDestination(if (next == FlowMode.SCHOOL) FlowDestination.SCHOOL else FlowDestination.UNIVERSITY)
    }

    BackHandler(enabled = destination != null) {
        if (destination == FlowDestination.PLANNER) {
            val returnDestination = plannerReturnName?.let { saved ->
                runCatching { FlowDestination.valueOf(saved) }.getOrNull()
            }
            plannerReturnName = null
            setDestination(returnDestination)
        } else {
            setDestination(null)
        }
    }

    when (destination) {
        FlowDestination.SCHOOL -> FlowSchoolRoot(
            onSwitchUniversity = { chooseAcademic(FlowMode.UNIVERSITY) },
            checkUpdate = checkUpdate,
            openPlanner = { openPlannerFrom(FlowDestination.SCHOOL) }
        )
        FlowDestination.UNIVERSITY -> FlowUniversityNativeRoot(
            enablePinnedNotification,
            disablePinnedNotification,
            checkUpdate,
            openPlanner = { openPlannerFrom(FlowDestination.UNIVERSITY) }
        )
        FlowDestination.PLANNER -> FlowPlannerRoot()
        null -> FlowHub(
            chooseSchool = { chooseAcademic(FlowMode.SCHOOL) },
            chooseUniversity = { chooseAcademic(FlowMode.UNIVERSITY) },
            choosePlanner = { openPlannerFrom(null) },
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
    val wash = if (FlowPalette.IsDark) {
        Brush.verticalGradient(listOf(FlowPalette.Accent.copy(alpha = .11f), FlowPalette.Background, FlowPalette.Background))
    } else {
        Brush.verticalGradient(listOf(FlowPalette.Accent.copy(alpha = .075f), FlowPalette.Background, FlowPalette.Background))
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(wash),
        contentPadding = PaddingValues(start = 20.dp, top = 34.dp, end = 20.dp, bottom = 42.dp),
        verticalArrangement = Arrangement.spacedBy(22.dp)
    ) {
        item {
            FlowBrand()
            Spacer(Modifier.height(34.dp))
            FlowLargeTitle(
                title = "하루를 한 흐름으로.",
                subtitle = "학교도, 대학도. 시간표부터 과제와 위젯까지 필요한 것만 Flow에 모았습니다."
            )
        }

        item {
            FlowSectionTitle("", "내 공간")
            Spacer(Modifier.height(9.dp))
            FlowCard(Modifier.fillMaxWidth()) {
                Column {
                    FlowListRow(
                        title = "학교",
                        subtitle = "오늘 시간표 · 급식 · 일정 · 교통",
                        glyph = FlowGlyph.SCHOOL,
                        onClick = chooseSchool
                    )
                    FlowDivider()
                    FlowListRow(
                        title = "대학교",
                        subtitle = "시간표 · 학과 · 공시 · 캠퍼스",
                        glyph = FlowGlyph.UNIVERSITY,
                        onClick = chooseUniversity
                    )
                }
            }
        }

        item {
            FlowSectionTitle("", "도구")
            Spacer(Modifier.height(9.dp))
            FlowCard(Modifier.fillMaxWidth()) {
                Column {
                    FlowListRow(
                        title = "과제 · 시험",
                        subtitle = "해야 할 일을 한 곳에서 정리",
                        glyph = FlowGlyph.PLANNER,
                        onClick = choosePlanner
                    )
                    FlowDivider()
                    FlowListRow(
                        title = "위젯",
                        subtitle = "다음 수업과 오늘 일정을 홈 화면에",
                        glyph = FlowGlyph.WIDGETS,
                        onClick = openWidgets
                    )
                }
            }
        }

        item {
            FlowGlassSurface(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(horizontal = 17.dp, vertical = 15.dp)) {
                    Text("Flow", color = FlowPalette.Text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                    Text(
                        "중요한 정보는 선명하게, 조작 요소는 가볍게. Flow는 하루의 흐름을 방해하지 않도록 설계했습니다.",
                        color = FlowPalette.Muted,
                        fontSize = 11.5.sp,
                        lineHeight = 17.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun FlowDivider() {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(start = 63.dp)
            .height(.5.dp)
            .background(FlowPalette.StrokeStrong)
    )
}
