package io.github.hoonex.flow.ui

import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import io.github.hoonex.flow.BuildConfig
import io.github.hoonex.flow.data.ClassMoment
import io.github.hoonex.flow.data.FlowPlannerStore
import io.github.hoonex.flow.data.FlowTaskScope
import io.github.hoonex.flow.data.activeForDay
import io.github.hoonex.flow.data.ScheduledClass
import io.github.hoonex.flow.data.Timetable
import io.github.hoonex.flow.data.University
import io.github.hoonex.flow.data.UniversityApi
import io.github.hoonex.flow.data.UniversityMajor
import io.github.hoonex.flow.data.UniversityProfile
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.data.classMoment
import io.github.hoonex.flow.data.classesForDay
import io.github.hoonex.flow.data.nextGap
import io.github.hoonex.flow.data.todayIndex
import io.github.hoonex.flow.data.totalCredits
import io.github.hoonex.flow.data.weeklyMinutes
import io.github.hoonex.flow.notification.UniversityNotification
import io.github.hoonex.flow.update.GitHubUpdateManager
import io.github.hoonex.flow.update.UpdatePhase
import io.github.hoonex.flow.widget.UniversityWidgets
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

private enum class NativeUniversityTab(val label: String) {
    HOME("홈"), SCHEDULE("시간표"), CAMPUS("캠퍼스"), SCHOOL("학교"), SETTINGS("설정")
}

@Composable
fun FlowUniversityNativeRoot(
    enablePinnedNotification: () -> Unit,
    disablePinnedNotification: () -> Unit,
    checkUpdate: () -> Unit
) {
    val context = LocalContext.current
    val store = remember { UniversityStore(context) }
    val scope = rememberCoroutineScope()
    var university by remember { mutableStateOf(store.loadUniversity()) }
    var timetable by remember { mutableStateOf(store.loadTimetable()) }
    var profile by remember { mutableStateOf(store.loadProfile()) }
    var major by remember { mutableStateOf(store.loadMajor()) }
    var tab by remember { mutableStateOf(NativeUniversityTab.HOME) }
    var importOpen by remember { mutableStateOf(false) }
    var majorOpen by remember { mutableStateOf(false) }

    suspend fun refreshSurfaces() {
        UniversityWidgets.updateAll(context)
        UniversityNotification.refresh(context)
    }

    if (university == null) {
        NativeUniversitySetup { selected ->
            store.saveUniversity(selected)
            store.clearUniversityDetails()
            university = selected
            profile = null
            major = null
            scope.launch { UniversityWidgets.updateAll(context) }
            importOpen = true
        }
    } else {
        Scaffold(
            containerColor = FlowPalette.Background,
            contentWindowInsets = WindowInsets(0, 0, 0, 0),
            bottomBar = { NativeUniversityBottomBar(tab) { tab = it } }
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding).statusBarsPadding()) {
                when (tab) {
                    NativeUniversityTab.HOME -> NativeUniversityHome(
                        university = university!!,
                        timetable = timetable,
                        major = major,
                        onImport = { importOpen = true }
                    )
                    NativeUniversityTab.SCHEDULE -> NativeUniversitySchedule(timetable) { importOpen = true }
                    NativeUniversityTab.CAMPUS -> FlowCampusTab()
                    NativeUniversityTab.SCHOOL -> NativeUniversitySchool(
                        university = university!!,
                        initialProfile = profile,
                        major = major,
                        onProfile = {
                            profile = it
                            store.saveProfile(it)
                        },
                        onChooseMajor = { majorOpen = true }
                    )
                    NativeUniversityTab.SETTINGS -> NativeUniversitySettings(
                        university = university!!,
                        enablePinnedNotification = enablePinnedNotification,
                        disablePinnedNotification = disablePinnedNotification,
                        checkUpdate = checkUpdate,
                        reimport = { importOpen = true },
                        changeUniversity = {
                            UniversityNotification.disable(context)
                            store.clear()
                            university = null
                            timetable = null
                            profile = null
                            major = null
                        }
                    )
                }
            }
        }
    }

    if (importOpen && university != null) {
        NativeEverytimeSheet(
            dismiss = { importOpen = false },
            imported = { imported ->
                store.saveTimetable(imported)
                timetable = imported
                importOpen = false
                scope.launch { refreshSurfaces() }
            }
        )
    }

    if (majorOpen && university != null) {
        NativeMajorSheet(
            university = university!!,
            selected = major,
            dismiss = { majorOpen = false },
            onSelected = {
                major = it
                store.saveMajor(it)
                majorOpen = false
            }
        )
    }
}

@Composable
private fun NativeUniversitySetup(onSelected: (University) -> Unit) {
    var query by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<University>>(emptyList()) }
    val scope = rememberCoroutineScope()

    LazyColumn(
        Modifier.fillMaxSize().background(FlowPalette.Background).statusBarsPadding(),
        contentPadding = PaddingValues(22.dp, 34.dp, 22.dp, 42.dp),
        verticalArrangement = Arrangement.spacedBy(15.dp)
    ) {
        item {
            FlowBrand()
            Spacer(Modifier.height(26.dp))
            FlowLargeTitle("대학교", "학교를 선택하면 시간표, 학과, 캠퍼스, 위젯이 연결됩니다.")
        }
        item { FlowTextField(query, { query = it }, "대학교 이름", Modifier.fillMaxWidth(), leading = "⌕") }
        item {
            FlowPrimaryButton(
                if (loading) "대학 찾는 중…" else "대학 찾기",
                {
                    if (loading || query.trim().length < 2) return@FlowPrimaryButton
                    loading = true
                    error = ""
                    scope.launch {
                        runCatching { UniversityApi.search(query) }
                            .onSuccess { results = it }
                            .onFailure { error = it.message ?: "검색 실패" }
                        loading = false
                    }
                },
                Modifier.fillMaxWidth(),
                enabled = !loading && query.trim().length >= 2
            )
        }
        if (error.isNotBlank()) item { Text(error, color = FlowPalette.Danger, fontSize = 12.sp) }
        if (results.isNotEmpty()) item { FlowSectionTitle("", "검색 결과", "${results.size}개") }
        items(results, key = { "${it.id}-${it.campus}-${it.address}" }) { school ->
            FlowCard(Modifier.fillMaxWidth(), onClick = { onSelected(school) }) {
                Column(Modifier.fillMaxWidth().padding(18.dp)) {
                    Text(school.name, color = FlowPalette.Text, fontSize = 18.sp, fontWeight = FontWeight.Black)
                    Text(listOf(school.region, school.foundation, school.campus).filter(String::isNotBlank).joinToString(" · "), color = FlowPalette.Mint, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                    if (school.address.isNotBlank()) Text(school.address, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
                }
            }
        }
    }
}

@Composable
private fun NativeUniversityHome(
    university: University,
    timetable: Timetable?,
    major: UniversityMajor?,
    onImport: () -> Unit
) {
    val context = LocalContext.current
    val now = rememberFlowMinuteNow()
    val today = timetable?.classesForDay(todayIndex(now)).orEmpty()
    val dayTasks = remember(now.toLocalDate()) {
        FlowPlannerStore(context).load().activeForDay(now.toLocalDate(), FlowTaskScope.UNIVERSITY)
    }
    val moment = timetable?.classMoment(now) ?: ClassMoment(null, null)
    val date = remember(now.toLocalDate()) {
        now.toLocalDate().format(DateTimeFormatter.ofPattern("M월 d일 EEEE", Locale.KOREAN))
    }

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 30.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            FlowLargeTitle(
                title = "오늘",
                subtitle = university.name,
                trailing = major?.name ?: date
            )
        }
        item { NativeNextClass(moment, timetable != null, onImport) }

        if (timetable != null) {
            item { FlowSectionTitle("", "오늘 수업", "${today.size}개") }
            if (today.isEmpty()) {
                item {
                    Text(
                        "오늘은 등록된 수업이 없습니다.",
                        color = FlowPalette.Muted,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(horizontal = 2.dp, vertical = 10.dp)
                    )
                }
            } else {
                item { NativeClassSurface(today) }
            }
        }
        if (dayTasks.isNotEmpty()) {
            item { FlowSectionTitle("", "오늘 할 일", "${dayTasks.size}개") }
            item { FlowDayTaskSummary(dayTasks) }
        }
    }
}

@Composable
private fun NativeNextClass(moment: ClassMoment, connected: Boolean, onImport: () -> Unit) {
    val item = moment.current ?: moment.next
    val subjectColor = item?.subject?.name?.let(::flowSubjectColor) ?: FlowPalette.Accent
    FlowCard(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth()) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .background(subjectColor)
            )
            Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 18.dp)) {
                Text(
                    if (moment.current != null) "지금 수업" else if (moment.next != null) "다음 수업" else "오늘",
                    color = subjectColor,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    item?.subject?.name ?: if (connected) "오늘 수업 종료" else "시간표를 연결하세요",
                    color = FlowPalette.Text,
                    fontSize = 29.sp,
                    lineHeight = 33.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 5.dp)
                )
                val detail = item?.let {
                    listOf(
                        if (moment.current != null) "${it.time.end} 종료" else "${it.time.start} 시작",
                        it.time.place.ifBlank { it.subject.place },
                        it.subject.professor
                    ).filter(String::isNotBlank).joinToString(" · ")
                } ?: if (connected) "오늘 예정된 수업을 모두 마쳤습니다." else "공개 공유 링크로 시간표를 가져올 수 있습니다."
                Text(detail, color = FlowPalette.Muted, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 6.dp))
                if (!connected) {
                    FlowPrimaryButton("시간표 연결", onImport, Modifier.fillMaxWidth().padding(top = 16.dp))
                }
            }
        }
    }
}

@Composable
private fun NativeMetric(label: String, value: String, modifier: Modifier) {
    Column(modifier) {
        Text(label, color = FlowPalette.Muted, fontSize = 11.sp, fontWeight = FontWeight.Medium)
        Text(value, color = FlowPalette.Text, fontSize = 19.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 5.dp))
    }
}

@Composable
private fun NativeUniversitySchedule(timetable: Timetable?, onImport: () -> Unit) {
    val now = rememberFlowMinuteNow()
    var mode by rememberSaveable { mutableStateOf(0) }
    val todayClasses = timetable?.classesForDay(todayIndex(now)).orEmpty()
    val todayLabel = remember(now.toLocalDate()) {
        now.toLocalDate().format(DateTimeFormatter.ofPattern("M월 d일 E요일", Locale.KOREAN))
    }

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 30.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp)
    ) {
        item {
            FlowLargeTitle(
                "시간표",
                timetable?.let { "${it.year}년 ${semester(it.semester)} · ${number(it.totalCredits())}학점" }
                    ?: "에브리타임 공개 공유 링크로 연결"
            )
        }

        if (timetable == null) {
            item {
                FlowPrimaryButton("시간표 연결", onImport, Modifier.fillMaxWidth())
            }
            item {
                FlowCard(Modifier.fillMaxWidth(), accent = true) {
                    Text(
                        "공개 공유 링크 하나면 홈 · 위젯 · 알림까지 함께 채워집니다.",
                        color = FlowPalette.Text,
                        fontSize = 14.sp,
                        lineHeight = 20.sp,
                        modifier = Modifier.padding(19.dp)
                    )
                }
            }
        } else {
            item {
                FlowSegmentedControl(
                    options = listOf("오늘", "주간"),
                    selectedIndex = mode,
                    onSelected = { mode = it }
                )
            }

            if (mode == 0) {
                item { FlowSectionTitle("", "오늘 일정", todayLabel) }
                if (todayClasses.isEmpty()) {
                    item {
                        FlowCard(Modifier.fillMaxWidth()) {
                            Text(
                                "오늘은 등록된 수업이 없습니다.",
                                color = FlowPalette.Muted,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(18.dp)
                            )
                        }
                    }
                } else {
                    item { NativeClassSurface(todayClasses) }
                }
            } else {
                item { NativeUniversityWeekGrid(timetable) }
            }

            item {
                FlowSecondaryButton("시간표 다시 가져오기", onImport, Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
private fun NativeUniversityWeekGrid(timetable: Timetable) {
    val dayLabels = listOf("월", "화", "수", "목", "금")
    val week = remember(timetable) { (0..4).associateWith(timetable::classesForDay) }
    val slots = remember(timetable) {
        week.values
            .flatten()
            .map { it.time.startMinutes }
            .distinct()
            .sorted()
    }

    FlowCard(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Spacer(Modifier.width(44.dp))
                dayLabels.forEach { day ->
                    Text(
                        day,
                        color = FlowPalette.Muted,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }

            Box(Modifier.fillMaxWidth().height(1.dp).background(FlowPalette.Stroke))

            slots.forEachIndexed { slotIndex, startMinute ->
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val representative = week.values.flatten().firstOrNull { it.time.startMinutes == startMinute }
                    Box(
                        Modifier.width(44.dp).height(64.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            representative?.time?.start.orEmpty(),
                            color = FlowPalette.Dim,
                            fontSize = 9.sp,
                            lineHeight = 10.sp
                        )
                    }

                    (0..4).forEach { day ->
                        val scheduled = week[day]?.firstOrNull { it.time.startMinutes == startMinute }
                        Box(
                            Modifier
                                .weight(1f)
                                .height(64.dp)
                                .padding(2.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(
                                    if (scheduled != null) {
                                        flowSubjectColor(scheduled.subject.name).copy(alpha = if (FlowPalette.IsDark) .24f else .18f)
                                    } else {
                                        Color.Transparent
                                    }
                                )
                                .padding(horizontal = 4.dp, vertical = 5.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                scheduled?.subject?.name.orEmpty(),
                                color = if (scheduled != null) FlowPalette.Text else Color.Transparent,
                                fontSize = 9.sp,
                                lineHeight = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                }
                if (slotIndex != slots.lastIndex) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .padding(start = 52.dp, end = 8.dp)
                            .height(1.dp)
                            .background(FlowPalette.Stroke.copy(alpha = .55f))
                    )
                }
            }
        }
    }
}

@Composable
private fun NativeClassSurface(classes: List<ScheduledClass>) {
    FlowCard(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth()) {
            classes.forEachIndexed { index, item ->
                NativeClassRowContent(item)
                if (index != classes.lastIndex) {
                    Box(Modifier.fillMaxWidth().padding(horizontal = 15.dp).height(1.dp).background(FlowPalette.Stroke))
                }
            }
        }
    }
}

@Composable
private fun NativeClassRowContent(item: ScheduledClass) {
    val subjectColor = flowSubjectColor(item.subject.name)
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 15.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier
                .width(4.dp)
                .height(38.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(subjectColor)
        )
        Column(Modifier.width(70.dp).padding(start = 10.dp)) {
            Text(item.time.start, color = FlowPalette.Text, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Text(item.time.end, color = FlowPalette.Dim, fontSize = 10.sp)
        }
        Column(Modifier.weight(1f)) {
            Text(item.subject.name, color = FlowPalette.Text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            val detail = listOf(item.time.place.ifBlank { item.subject.place }, item.subject.professor).filter(String::isNotBlank).joinToString(" · ")
            if (detail.isNotBlank()) {
                Text(detail, color = FlowPalette.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
            }
        }
    }
}

@Composable
private fun NativeUniversitySchool(
    university: University,
    initialProfile: UniversityProfile?,
    major: UniversityMajor?,
    onProfile: (UniversityProfile) -> Unit,
    onChooseMajor: () -> Unit
) {
    var profile by remember(university.id, initialProfile) { mutableStateOf(initialProfile) }
    var loading by remember(university.id) { mutableStateOf(initialProfile == null) }
    var error by remember(university.id) { mutableStateOf("") }

    LaunchedEffect(university.id) {
        if (profile == null) {
            loading = true
            runCatching { UniversityApi.profile(university) }
                .onSuccess { profile = it; onProfile(it) }
                .onFailure { error = it.message ?: "공시정보를 불러오지 못했습니다." }
            loading = false
        }
    }

    val school = profile?.school ?: university
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 32.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { FlowLargeTitle(school.name, listOf(school.region, school.campus).filter(String::isNotBlank).joinToString(" · ")) }
        if (loading) item {
            Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(18.dp), color = FlowPalette.Mint, strokeWidth = 2.dp)
                Text("공시정보 불러오는 중…", color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(start = 10.dp))
            }
        }
        if (error.isNotBlank()) item { Text(error, color = FlowPalette.Danger, fontSize = 12.sp) }
        profile?.let { p ->
            item { FlowSectionTitle("", "공시 지표", if (p.partial) "일부 제한" else "최근 공시") }
            item {
                FlowCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth()) {
                        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            NativeInfoMetric("등록금", p.tuition?.value?.takeIf { it > 0 }?.roundToInt()?.let { "${it / 10_000}만원" } ?: "—", Modifier.weight(1f))
                            NativeInfoMetric("장학금", p.scholarship?.value?.takeIf { it > 0 }?.roundToInt()?.let { "${it / 10_000}만원" } ?: "—", Modifier.weight(1f))
                        }
                        Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(1.dp).background(FlowPalette.Stroke))
                        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            NativeInfoMetric("기숙사", p.dormitory?.value?.takeIf { it > 0 }?.let { "${"%.1f".format(Locale.US, it)}%" } ?: "—", Modifier.weight(1f))
                            NativeInfoMetric("도서관", p.library?.value?.takeIf { it > 0 }?.let { "${"%.1f".format(Locale.US, it)}" } ?: "—", Modifier.weight(1f))
                        }
                    }
                }
            }
        }
        item { FlowSectionTitle("", "내 학과", major?.college) }
        item {
            FlowCard(Modifier.fillMaxWidth(), onClick = onChooseMajor) {
                Column(Modifier.fillMaxWidth().padding(17.dp)) {
                    Text(major?.name ?: "학과 선택", color = FlowPalette.Text, fontSize = 17.sp, fontWeight = FontWeight.Black)
                    Text(major?.let { listOf(it.college, it.category, it.duration).filter(String::isNotBlank).joinToString(" · ") } ?: "공공데이터에서 학과를 검색합니다.", color = FlowPalette.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
        val rows = listOf("설립" to school.foundation, "구분" to school.division.ifBlank { school.kind }, "주소" to school.address, "전화" to school.phone).filter { it.second.isNotBlank() }
        if (rows.isNotEmpty()) {
            item { FlowSectionTitle("", "기본 정보") }
            item {
                FlowCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth()) {
                        rows.forEachIndexed { index, (label, value) ->
                            Row(
                                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Text(label, color = FlowPalette.Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(64.dp))
                                Text(value, color = FlowPalette.Text, fontSize = 13.sp, lineHeight = 19.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                            }
                            if (index != rows.lastIndex) {
                                Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(1.dp).background(FlowPalette.Stroke))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NativeInfoMetric(label: String, value: String, modifier: Modifier) {
    Column(modifier) {
        Text(label, color = FlowPalette.Muted, fontSize = 10.sp)
        Text(value, color = FlowPalette.Text, fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 5.dp))
    }
}

@Composable
private fun NativeUniversitySettings(
    university: University,
    enablePinnedNotification: () -> Unit,
    disablePinnedNotification: () -> Unit,
    checkUpdate: () -> Unit,
    reimport: () -> Unit,
    changeUniversity: () -> Unit
 ) {
    val updateStatus by GitHubUpdateManager.status.collectAsState()
    val updateBusy = updateStatus.phase in setOf(UpdatePhase.CHECKING, UpdatePhase.DOWNLOADING, UpdatePhase.VERIFYING)
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 34.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item { FlowLargeTitle("설정", university.name) }

        item { FlowSectionTitle("", "알림") }
        item {
            FlowCard(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) {
                    NativeSettingsRow("고정 알림 켜기", "현재/다음 수업을 시스템 알림으로 유지합니다.", enablePinnedNotification)
                    Box(Modifier.fillMaxWidth().padding(horizontal = 17.dp).height(1.dp).background(FlowPalette.Stroke))
                    NativeSettingsRow("고정 알림 끄기", "Flow 일정 알림을 제거합니다.", disablePinnedNotification)
                }
            }
        }

        item { FlowSectionTitle("", "위젯") }
        item {
            FlowCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(17.dp)) {
                    Text("위젯별 설정", color = FlowPalette.Text, fontWeight = FontWeight.Black)
                    Text("Flow 위젯을 길게 눌러 자동 · 학교 · 대학교 데이터와 세부정보 표시를 위젯마다 바꿀 수 있습니다.", color = FlowPalette.Muted, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 6.dp))
                    Text("Galaxy 잠금화면에서 보이지 않으면 Good Lock → LockStar에서 Flow 위젯을 추가하세요.", color = FlowPalette.Accent, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 8.dp))
                }
            }
        }

        item { FlowSectionTitle("", "연결 · 앱") }
        item {
            FlowCard(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) {
                    NativeSettingsRow("에브리타임 다시 가져오기", "공개 공유 링크의 최신 시간표로 교체합니다.", reimport)
                    Box(Modifier.fillMaxWidth().padding(horizontal = 17.dp).height(1.dp).background(FlowPalette.Stroke))
                    NativeSettingsRow(
                        title = when (updateStatus.phase) {
                            UpdatePhase.CHECKING -> "업데이트 확인 중…"
                            UpdatePhase.DOWNLOADING -> "업데이트 다운로드 중…"
                            UpdatePhase.VERIFYING -> "업데이트 검증 중…"
                            UpdatePhase.AVAILABLE -> "새 업데이트 사용 가능"
                            UpdatePhase.READY -> "업데이트 설치 준비 완료"
                            UpdatePhase.UP_TO_DATE -> "Flow가 최신 버전입니다"
                            else -> "업데이트 확인"
                        },
                        detail = updateStatus.message,
                        action = checkUpdate,
                        enabled = !updateBusy
                    )
                    Box(Modifier.fillMaxWidth().padding(horizontal = 17.dp).height(1.dp).background(FlowPalette.Stroke))
                    NativeSettingsRow("대학교 다시 선택", "대학·학과·시간표 데이터를 초기화합니다.", changeUniversity, danger = true)
                }
            }
        }
        item { Text("Flow ${BuildConfig.VERSION_NAME} · 네이티브 Android", color = FlowPalette.Dim, fontSize = 10.sp) }
    }
}

@Composable
private fun NativeSettingsRow(title: String, detail: String, action: () -> Unit, danger: Boolean = false, enabled: Boolean = true) {
    Row(
        Modifier.fillMaxWidth().clickable(enabled = enabled, onClick = action).padding(horizontal = 17.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, color = if (!enabled) FlowPalette.Dim else if (danger) FlowPalette.Danger else FlowPalette.Text, fontSize = 15.sp, fontWeight = FontWeight.Black)
            Text(detail, color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 4.dp))
        }
        Text("›", color = if (!enabled) FlowPalette.Dim else if (danger) FlowPalette.Danger else FlowPalette.Mint, fontSize = 22.sp)
    }
}

@Composable
private fun NativeUniversityBottomBar(tab: NativeUniversityTab, onTab: (NativeUniversityTab) -> Unit) {
    val tabs = NativeUniversityTab.entries
    FlowBottomNavigation(
        labels = tabs.map { it.label },
        selectedIndex = tabs.indexOf(tab),
        onSelected = { index -> onTab(tabs[index]) }
    )
}

@Composable
private fun NativeEverytimeSheet(dismiss: () -> Unit, imported: (Timetable) -> Unit) {
    var url by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    NativeFlowSheet(dismiss) { close ->
        FlowLargeTitle("시간표 연결", "공개 공유 링크만 사용합니다.")
        Text("공개 공유 링크만 읽고 로그인 정보는 받지 않습니다.", color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
        FlowTextField(url, { url = it }, "https://everytime.kr/@…", Modifier.fillMaxWidth().padding(top = 16.dp), keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Uri), leading = "↗")
        if (error.isNotBlank()) Text(error, color = FlowPalette.Danger, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
        FlowPrimaryButton(
            if (loading) "가져오는 중…" else "시간표 가져오기",
            {
                if (loading || url.isBlank()) return@FlowPrimaryButton
                loading = true
                error = ""
                scope.launch {
                    runCatching { UniversityApi.importEverytime(url) }
                        .onSuccess(imported)
                        .onFailure { error = it.message ?: "가져오기 실패" }
                    loading = false
                }
            },
            Modifier.fillMaxWidth().padding(top = 14.dp),
            enabled = !loading && url.isNotBlank()
        )
        FlowSecondaryButton("닫기", close, Modifier.fillMaxWidth().padding(top = 8.dp))
    }
}

@Composable
private fun NativeMajorSheet(university: University, selected: UniversityMajor?, dismiss: () -> Unit, onSelected: (UniversityMajor) -> Unit) {
    var query by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    var majors by remember { mutableStateOf<List<UniversityMajor>>(emptyList()) }
    LaunchedEffect(university.id) {
        runCatching { UniversityApi.majors(university) }
            .onSuccess { majors = it }
            .onFailure { error = it.message ?: "학과 정보를 불러오지 못했습니다." }
        loading = false
    }
    val filtered = remember(majors, query) {
        if (query.isBlank()) majors else majors.filter { "${it.college}${it.name}${it.category}".replace(" ", "").contains(query.replace(" ", ""), ignoreCase = true) }
    }
    NativeFlowSheet(dismiss, tall = true) { close ->
        Text("학과 선택", color = FlowPalette.Text, fontSize = 27.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 7.dp))
        FlowTextField(query, { query = it }, "학과 또는 단과대학 검색", Modifier.fillMaxWidth().padding(top = 14.dp), leading = "⌕")
        if (loading) Text("학과 불러오는 중…", color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 12.dp))
        if (error.isNotBlank()) Text(error, color = FlowPalette.Danger, fontSize = 12.sp, modifier = Modifier.padding(top = 10.dp))
        LazyColumn(Modifier.fillMaxWidth().weight(1f).padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(filtered.take(160), key = { it.id }) { item ->
                FlowCard(Modifier.fillMaxWidth(), accent = selected?.id == item.id, onClick = { onSelected(item) }) {
                    Column(Modifier.fillMaxWidth().padding(14.dp)) {
                        Text(item.name, color = FlowPalette.Text, fontSize = 14.sp, fontWeight = FontWeight.Black)
                        Text(listOf(item.college, item.category, item.duration).filter(String::isNotBlank).joinToString(" · "), color = FlowPalette.Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 3.dp))
                    }
                }
            }
        }
        FlowSecondaryButton("닫기", close, Modifier.fillMaxWidth().padding(top = 9.dp))
    }
}

@Composable
private fun NativeFlowSheet(
    dismiss: () -> Unit,
    tall: Boolean = false,
    content: @Composable ColumnScope.(close: () -> Unit) -> Unit
) {
    var visible by remember { mutableStateOf(false) }
    var closing by remember { mutableStateOf(false) }
    var handleDrag by remember { mutableFloatStateOf(0f) }
    val scope = rememberCoroutineScope()
    val dimAlpha by animateFloatAsState(
        targetValue = if (visible) .62f else 0f,
        animationSpec = tween(220),
        label = "flow-sheet-dim"
    )

    fun requestClose() {
        if (closing) return
        closing = true
        visible = false
        scope.launch {
            delay(260)
            dismiss()
        }
    }

    LaunchedEffect(Unit) {
        visible = true
    }

    Dialog(
        onDismissRequest = { requestClose() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = dimAlpha))
                .clickable(onClick = { requestClose() }),
            contentAlignment = Alignment.BottomCenter
        ) {
            AnimatedVisibility(
                visible = visible,
                enter = slideInVertically(
                    initialOffsetY = { fullHeight -> fullHeight },
                    animationSpec = tween(360, easing = FastOutSlowInEasing)
                ) + fadeIn(animationSpec = tween(180)),
                exit = slideOutVertically(
                    targetOffsetY = { fullHeight -> fullHeight },
                    animationSpec = tween(240, easing = FastOutSlowInEasing)
                ) + fadeOut(animationSpec = tween(160))
            ) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .then(if (tall) Modifier.fillMaxHeight(0.86f) else Modifier)
                        .clip(RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp))
                        .background(FlowPalette.Surface)
                        .clickable(onClick = {})
                        .navigationBarsPadding()
                        .padding(horizontal = 20.dp, vertical = 14.dp)
                ) {
                    Box(
                        Modifier
                            .align(Alignment.CenterHorizontally)
                            .padding(bottom = 12.dp)
                            .width(38.dp)
                            .height(5.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(FlowPalette.Dim.copy(alpha = .72f))
                            .pointerInput(Unit) {
                                detectVerticalDragGestures(
                                    onDragStart = { handleDrag = 0f },
                                    onVerticalDrag = { _, dragAmount ->
                                        handleDrag = (handleDrag + dragAmount).coerceAtLeast(0f)
                                    },
                                    onDragEnd = {
                                        if (handleDrag >= 72f) requestClose()
                                        handleDrag = 0f
                                    },
                                    onDragCancel = { handleDrag = 0f }
                                )
                            }
                    )
                    content(::requestClose)
                }
            }
        }
    }
}

private fun number(value: Double): String = if (value % 1.0 == 0.0) value.roundToInt().toString() else "%.1f".format(Locale.US, value)
private fun semester(value: String): String = if (value.endsWith("학기")) value else "${value}학기"
