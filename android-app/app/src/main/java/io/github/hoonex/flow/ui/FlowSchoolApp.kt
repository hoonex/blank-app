package io.github.hoonex.flow.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.hoonex.flow.data.FlowPlannerStore
import io.github.hoonex.flow.data.FlowSchool
import io.github.hoonex.flow.data.SchoolApi
import io.github.hoonex.flow.data.SchoolDashboard
import io.github.hoonex.flow.data.SchoolSelection
import io.github.hoonex.flow.data.SchoolStore
import io.github.hoonex.flow.data.FlowTaskScope
import io.github.hoonex.flow.data.activeForDay
import io.github.hoonex.flow.data.flowAcademicToday
import io.github.hoonex.flow.data.schoolDate8
import io.github.hoonex.flow.update.GitHubUpdateManager
import io.github.hoonex.flow.update.UpdatePhase
import io.github.hoonex.flow.widget.UniversityWidgets
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import java.util.Locale

private enum class SchoolTab(val label: String) {
    TODAY("오늘"), WEEK("시간표"), TRANSIT("교통"), INFO("학교"), SETTINGS("설정")
}

@Composable
fun FlowSchoolRoot(onSwitchUniversity: () -> Unit, checkUpdate: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val store = remember { SchoolStore(context) }
    val scope = rememberCoroutineScope()
    var selection by remember { mutableStateOf(store.loadSelection()) }
    var dashboard by remember { mutableStateOf(store.loadDashboard()) }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var tab by remember { mutableStateOf(SchoolTab.TODAY) }
    val now = rememberFlowMinuteNow()
    val today = schoolDate8(now.toLocalDate())
    val selectionKey = selection?.school?.schoolCode ?: "setup"
    var selectedDateRaw by rememberSaveable(selectionKey) { mutableStateOf(today) }
    var previousTodayRaw by remember { mutableStateOf(today) }
    val selectedDate = remember(selectedDateRaw) {
        runCatching { LocalDate.parse(selectedDateRaw, DateTimeFormatter.BASIC_ISO_DATE) }
            .getOrDefault(now.toLocalDate())
    }

    LaunchedEffect(today) {
        if (selectedDateRaw == previousTodayRaw) selectedDateRaw = today
        previousTodayRaw = today
    }

    suspend fun refresh(force: Boolean = false, targetDate: LocalDate = selectedDate) {
        val selected = selection ?: return
        val targetRaw = schoolDate8(targetDate)
        val cached = dashboard
        val coveredByCache = cached != null && targetRaw >= cached.from && targetRaw <= cached.to
        if (!force && coveredByCache) return
        loading = true
        error = ""
        runCatching { SchoolApi.dashboard(selected, targetDate) }
            .onSuccess {
                dashboard = it
                store.saveDashboard(it)
                UniversityWidgets.updateAll(context)
            }
            .onFailure { error = it.message ?: "학교 데이터를 불러오지 못했습니다." }
        loading = false
    }

    LaunchedEffect(selection, selectedDateRaw) {
        if (selection != null) refresh(targetDate = selectedDate)
    }

    if (selection == null) {
        SchoolSetupScreen { chosen ->
            store.saveSelection(chosen)
            store.clearDashboard()
            selection = chosen
            dashboard = null
        }
        return
    }

    Scaffold(
        containerColor = FlowPalette.Background,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            val tabs = SchoolTab.entries
            FlowBottomNavigation(
                labels = tabs.map { it.label },
                selectedIndex = tabs.indexOf(tab),
                onSelected = { index -> tab = tabs[index] }
            )
        }
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).statusBarsPadding()) {
            when (tab) {
                SchoolTab.TODAY -> SchoolTodayScreen(
                    selection = selection!!,
                    dashboard = dashboard,
                    loading = loading,
                    error = error,
                    selectedDate = selectedDateRaw,
                    actualToday = today,
                    onDateSelected = { selectedDateRaw = it },
                    refresh = { scope.launch { refresh(true) } }
                )
                SchoolTab.WEEK -> SchoolWeekScreen(selection!!, dashboard)
                SchoolTab.TRANSIT -> FlowSchoolTransitScreen(selection!!)
                SchoolTab.INFO -> SchoolInfoScreen(selection!!.school)
                SchoolTab.SETTINGS -> SchoolSettingsScreen(
                    selection = selection!!,
                    cached = dashboard != null,
                    refreshing = loading,
                    onRefresh = { scope.launch { refresh(true) } },
                    onChangeSchool = {
                        store.clear()
                        selection = null
                        dashboard = null
                    },
                    onSwitchUniversity = onSwitchUniversity,
                    checkUpdate = checkUpdate
                )
            }
        }
    }
}

@Composable
private fun SchoolSetupScreen(onSelected: (SchoolSelection) -> Unit) {
    var query by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<FlowSchool>>(emptyList()) }
    var school by remember { mutableStateOf<FlowSchool?>(null) }
    var grade by remember { mutableStateOf<String?>(null) }
    var classes by remember { mutableStateOf<List<String>>(emptyList()) }
    val scope = rememberCoroutineScope()

    LazyColumn(
        Modifier.fillMaxSize().background(FlowPalette.Background).statusBarsPadding(),
        contentPadding = PaddingValues(22.dp, 34.dp, 22.dp, 44.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            FlowBrand()
            Spacer(Modifier.height(26.dp))
            FlowLargeTitle("학교", "학교를 선택하면 오늘 일정, 급식, 교통까지 한 흐름으로 이어집니다.")
        }
        if (school == null) {
            item { FlowTextField(query, { query = it }, "학교 이름", Modifier.fillMaxWidth(), leading = "⌕") }
            item {
                FlowPrimaryButton(
                    if (loading) "학교 찾는 중…" else "학교 찾기",
                    {
                        if (loading || query.trim().length < 2) return@FlowPrimaryButton
                        loading = true
                        error = ""
                        scope.launch {
                            runCatching { SchoolApi.search(query) }
                                .onSuccess { results = it }
                                .onFailure { error = it.message ?: "검색 실패" }
                            loading = false
                        }
                    },
                    Modifier.fillMaxWidth(),
                    enabled = query.trim().length >= 2 && !loading
                )
            }
            if (results.isNotEmpty()) item { FlowSectionTitle("", "검색 결과", "${results.size}개") }
            items(results, key = { "${it.officeCode}-${it.schoolCode}" }) { item ->
                FlowCard(Modifier.fillMaxWidth(), onClick = { school = item; results = emptyList() }) {
                    Column(Modifier.padding(17.dp)) {
                        Text(item.name, color = FlowPalette.Text, fontSize = 18.sp, fontWeight = FontWeight.Black)
                        Text(listOf(item.kind, item.location, item.type).filter(String::isNotBlank).joinToString(" · "), color = FlowPalette.Mint, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                        if (item.address.isNotBlank()) Text(item.address, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
                    }
                }
            }
        } else if (grade == null) {
            item { FlowSectionTitle("", school!!.name, "학년 선택") }
            val maxGrade = if (school!!.kind.contains("초등")) 6 else 3
            items((1..maxGrade).map(Int::toString)) { value ->
                FlowCard(Modifier.fillMaxWidth(), onClick = {
                    grade = value
                    loading = true
                    error = ""
                    scope.launch {
                        runCatching { SchoolApi.classes(school!!, value) }
                            .onSuccess { classes = it }
                            .onFailure { error = it.message ?: "반 정보를 불러오지 못했습니다." }
                        loading = false
                    }
                }) {
                    Row(Modifier.fillMaxWidth().padding(18.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${value}학년", color = FlowPalette.Text, fontWeight = FontWeight.Black)
                        Text("›", color = FlowPalette.Mint, fontSize = 20.sp)
                    }
                }
            }
            item { FlowSecondaryButton("다른 학교 찾기", { school = null }, Modifier.fillMaxWidth()) }
        } else {
            item { FlowSectionTitle("", "${school!!.name} ${grade}학년", if (loading) "불러오는 중" else "반 선택") }
            if (!loading && classes.isEmpty() && error.isBlank()) item { Text("반 정보가 없습니다. 공개 데이터 상태를 확인하세요.", color = FlowPalette.Muted, fontSize = 13.sp) }
            items(classes) { className ->
                FlowCard(Modifier.fillMaxWidth(), onClick = { onSelected(SchoolSelection(school!!, grade!!, className)) }) {
                    Row(Modifier.fillMaxWidth().padding(18.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${className}반", color = FlowPalette.Text, fontSize = 17.sp, fontWeight = FontWeight.Black)
                        Text("시작", color = FlowPalette.Mint, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            item { FlowSecondaryButton("학년 다시 선택", { grade = null; classes = emptyList() }, Modifier.fillMaxWidth()) }
        }
        if (error.isNotBlank()) item { Text(error, color = FlowPalette.Danger, fontSize = 13.sp) }
    }
}

@Composable
private fun SchoolTodayScreen(
    selection: SchoolSelection,
    dashboard: SchoolDashboard?,
    loading: Boolean,
    error: String,
    selectedDate: String,
    actualToday: String,
    onDateSelected: (String) -> Unit,
    refresh: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val selectedLocalDate = remember(selectedDate) {
        runCatching { LocalDate.parse(selectedDate, DateTimeFormatter.BASIC_ISO_DATE) }
            .getOrDefault(flowAcademicToday())
    }
    val actualTodayDate = remember(actualToday) {
        runCatching { LocalDate.parse(actualToday, DateTimeFormatter.BASIC_ISO_DATE) }
            .getOrDefault(flowAcademicToday())
    }
    val classes = dashboard?.classesOn(selectedDate).orEmpty()
    val meals = dashboard?.mealsOn(selectedDate).orEmpty()
    val events = dashboard?.eventsOn(selectedDate).orEmpty()
    val dayTasks = remember(selectedLocalDate) {
        FlowPlannerStore(context).load().activeForDay(selectedLocalDate, FlowTaskScope.SCHOOL)
    }

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 30.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            FlowLargeTitle(
                title = if (selectedDate == actualToday) "오늘" else selectedLocalDate.format(DateTimeFormatter.ofPattern("M월 d일", Locale.KOREAN)),
                subtitle = "${selection.school.name} · ${selection.grade}학년 ${selection.className}반",
                trailing = selectedLocalDate.format(DateTimeFormatter.ofPattern("E", Locale.KOREAN))
            )
        }
        item {
            SchoolDateSelector(
                selectedDate = selectedLocalDate,
                actualToday = actualTodayDate,
                onSelected = { onDateSelected(schoolDate8(it)) }
            )
        }
        if (error.isNotBlank()) {
            item {
                Text(
                    "새 데이터 연결이 불안정해 저장된 정보를 보여주고 있습니다.",
                    color = FlowPalette.Danger,
                    fontSize = 12.sp,
                    lineHeight = 17.sp
                )
            }
        }
        item {
            SchoolDaySurface(
                classes = classes,
                meals = meals,
                events = events,
                loading = loading && dashboard == null
            )
        }
        if (dayTasks.isNotEmpty()) {
            item { FlowSectionTitle("", "오늘 할 일", "${dayTasks.size}개") }
            item { FlowDayTaskSummary(dayTasks) }
        }
        item {
            FlowSecondaryButton(
                if (loading) "새로고침 중…" else "데이터 새로고침",
                refresh,
                Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun SchoolDaySurface(
    classes: List<io.github.hoonex.flow.data.SchoolPeriod>,
    meals: List<io.github.hoonex.flow.data.SchoolMeal>,
    events: List<io.github.hoonex.flow.data.SchoolEvent>,
    loading: Boolean
) {
    FlowCard(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth()) {
            Row(
                Modifier.fillMaxWidth().padding(start = 17.dp, top = 17.dp, end = 17.dp, bottom = 9.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    when {
                        loading -> "불러오는 중"
                        classes.isEmpty() -> "수업 없음"
                        else -> "오늘 수업"
                    },
                    color = FlowPalette.Text,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                if (classes.isNotEmpty()) {
                    Text("${classes.size}개", color = FlowPalette.Muted, fontSize = 12.sp)
                }
            }

            if (classes.isEmpty()) {
                Text(
                    if (loading) "학교 데이터를 확인하고 있습니다." else "등록된 수업이 없습니다.",
                    color = FlowPalette.Muted,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 17.dp, vertical = 14.dp)
                )
            } else {
                classes.forEach { period ->
                    val subject = period.subject.ifBlank { "과목 정보 없음" }
                    val subjectColor = flowSubjectColor(subject)
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 17.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            Modifier
                                .width(4.dp)
                                .height(34.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(subjectColor)
                        )
                        Text(
                            "${period.period}교시",
                            color = FlowPalette.Muted,
                            fontSize = 11.sp,
                            modifier = Modifier.width(56.dp).padding(start = 10.dp)
                        )
                        Text(
                            subject,
                            color = FlowPalette.Text,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            Box(Modifier.fillMaxWidth().padding(horizontal = 17.dp).height(1.dp).background(FlowPalette.Stroke))

            Row(
                Modifier.fillMaxWidth().padding(horizontal = 17.dp, vertical = 15.dp),
                verticalAlignment = Alignment.Top
            ) {
                Text("급식", color = FlowPalette.Text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(56.dp))
                Column(Modifier.weight(1f)) {
                    val meal = meals.firstOrNull()
                    Text(
                        meal?.dishes?.joinToString(" · ") ?: "급식 정보가 없습니다.",
                        color = if (meal == null) FlowPalette.Muted else FlowPalette.Text,
                        fontSize = 13.sp,
                        lineHeight = 19.sp
                    )
                    meal?.calories?.takeIf(String::isNotBlank)?.let {
                        Text(it, color = FlowPalette.Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }

            if (events.isNotEmpty()) {
                Box(Modifier.fillMaxWidth().padding(horizontal = 17.dp).height(1.dp).background(FlowPalette.Stroke))
                events.forEach { event ->
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 17.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.Top
                    ) {
                        Text("일정", color = FlowPalette.Text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(56.dp))
                        Column(Modifier.weight(1f)) {
                            Text(event.name, color = FlowPalette.Text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            if (event.content.isNotBlank()) {
                                Text(event.content, color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 3.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SchoolDateSelector(
    selectedDate: LocalDate,
    actualToday: LocalDate,
    onSelected: (LocalDate) -> Unit
) {
    val dates = remember(actualToday) { (-3L..10L).map(actualToday::plusDays) }
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = 1)

    LaunchedEffect(selectedDate, dates) {
        val selectedIndex = dates.indexOf(selectedDate)
        if (selectedIndex >= 0) {
            listState.animateScrollToItem((selectedIndex - 2).coerceAtLeast(0))
        }
    }

    LazyRow(
        modifier = Modifier.fillMaxWidth(),
        state = listState,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(horizontal = 1.dp)
    ) {
        items(dates, key = { it.toEpochDay() }) { date ->
            val selected = date == selectedDate
            val today = date == actualToday
            Column(
                modifier = Modifier
                    .width(48.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(if (selected) FlowPalette.Accent.copy(alpha = if (FlowPalette.IsDark) .26f else .14f) else Color.Transparent)
                    .clickable { onSelected(date) }
                    .padding(vertical = 9.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    date.format(DateTimeFormatter.ofPattern("E", Locale.KOREAN)),
                    color = if (selected) FlowPalette.AccentBright else FlowPalette.Muted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    date.dayOfMonth.toString(),
                    color = if (selected) FlowPalette.Text else FlowPalette.Muted,
                    fontSize = 17.sp,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 2.dp)
                )
                if (today) {
                    Box(
                        Modifier
                            .padding(top = 5.dp)
                            .width(4.dp)
                            .height(4.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(FlowPalette.Accent)
                    )
                } else {
                    Spacer(Modifier.height(9.dp))
                }
            }
        }
    }
}

@Composable
private fun SchoolWeekScreen(selection: SchoolSelection, dashboard: SchoolDashboard?) {
    val anchor = remember(dashboard?.selected) {
        runCatching {
            LocalDate.parse(dashboard?.selected.orEmpty(), DateTimeFormatter.BASIC_ISO_DATE)
        }.getOrDefault(flowAcademicToday())
    }
    val weekStart = remember(anchor) { anchor.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)) }
    val weekDates = remember(weekStart) { (0L..4L).map(weekStart::plusDays) }
    val timetable = dashboard?.timetable.orEmpty()
    val classesByDate = remember(timetable) { timetable.groupBy { it.date } }
    val maxPeriod = (timetable.maxOfOrNull { it.period } ?: 7).coerceAtLeast(7)
    val today = flowAcademicToday()

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 30.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            FlowLargeTitle(
                "주간 시간표",
                "${selection.school.name} · ${selection.grade}학년 ${selection.className}반",
                "${weekStart.monthValue}/${weekStart.dayOfMonth}–${weekStart.plusDays(4).dayOfMonth}"
            )
        }
        item {
            FlowCard(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Spacer(Modifier.width(36.dp))
                        weekDates.forEach { date ->
                            Column(
                                Modifier.weight(1f),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    date.format(DateTimeFormatter.ofPattern("E", Locale.KOREAN)),
                                    color = if (date == today) FlowPalette.AccentBright else FlowPalette.Muted,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    date.dayOfMonth.toString(),
                                    color = if (date == today) FlowPalette.Accent else FlowPalette.Text,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(top = 2.dp)
                                )
                            }
                        }
                    }

                    Box(Modifier.fillMaxWidth().height(1.dp).background(FlowPalette.Stroke))

                    (1..maxPeriod).forEach { period ->
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                Modifier
                                    .width(36.dp)
                                    .height(54.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    period.toString(),
                                    color = FlowPalette.Dim,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                            weekDates.forEach { date ->
                                val raw = schoolDate8(date)
                                val periodItem = classesByDate[raw]?.firstOrNull { it.period == period }
                                Box(
                                    Modifier
                                        .weight(1f)
                                        .height(54.dp)
                                        .padding(2.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(
                                            if (periodItem != null) {
                                                flowSubjectColor(periodItem.subject).copy(alpha = if (FlowPalette.IsDark) .24f else .18f)
                                            } else {
                                                Color.Transparent
                                            }
                                        )
                                        .padding(horizontal = 4.dp, vertical = 5.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        periodItem?.subject.orEmpty(),
                                        color = if (periodItem != null) FlowPalette.Text else Color.Transparent,
                                        fontSize = 10.sp,
                                        lineHeight = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                        if (period != maxPeriod) {
                            Box(
                                Modifier
                                    .fillMaxWidth()
                                    .padding(start = 44.dp, end = 8.dp)
                                    .height(1.dp)
                                    .background(FlowPalette.Stroke.copy(alpha = .55f))
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SchoolInfoScreen(school: FlowSchool) {
    val rows = listOf(
        "학교 구분" to school.kind,
        "설립" to school.type,
        "관할" to school.officeName,
        "지역" to school.location,
        "주소" to listOf(school.address, school.addressDetail).filter(String::isNotBlank).joinToString(" "),
        "전화" to school.phone,
        "남녀공학" to school.coed,
        "고교 유형" to school.highSchoolType,
        "계열" to school.highSchoolTrack,
        "개교" to school.founded
    ).filter { it.second.isNotBlank() }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 30.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            FlowLargeTitle(school.name, school.type.ifBlank { "학교 정보" })
            if (school.englishName.isNotBlank()) Text(school.englishName, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
        }
        if (rows.isNotEmpty()) {
            item {
                FlowCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth()) {
                        rows.forEachIndexed { index, (label, value) ->
                            Row(
                                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                                horizontalArrangement = Arrangement.spacedBy(14.dp),
                                verticalAlignment = Alignment.Top
                            ) {
                                Text(label, color = FlowPalette.Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(70.dp))
                                Text(value, color = FlowPalette.Text, fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
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
private fun SchoolSettingsScreen(
    selection: SchoolSelection,
    cached: Boolean,
    refreshing: Boolean,
    onRefresh: () -> Unit,
    onChangeSchool: () -> Unit,
    onSwitchUniversity: () -> Unit,
    checkUpdate: () -> Unit
 ) {
    val updateStatus by GitHubUpdateManager.status.collectAsState()
    val updateBusy = updateStatus.phase in setOf(UpdatePhase.CHECKING, UpdatePhase.DOWNLOADING, UpdatePhase.VERIFYING)
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 34.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { FlowLargeTitle("설정", "${selection.school.name} · ${selection.grade}학년 ${selection.className}반") }
        item { FlowSectionTitle("", "데이터와 모드") }
        item {
            FlowCard(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) {
                    SchoolSettingsActionRow(
                        title = if (refreshing) "학교 데이터 새로고침 중…" else "학교 데이터 새로고침",
                        detail = if (refreshing) "NEIS 데이터를 다시 불러오는 중입니다." else "시간표 · 급식 · 학사일정을 다시 동기화합니다.",
                        action = onRefresh,
                        enabled = !refreshing
                    )
                    Box(Modifier.fillMaxWidth().padding(horizontal = 17.dp).height(1.dp).background(FlowPalette.Stroke))
                    SchoolSettingsActionRow(
                        title = "대학교 모드로 전환",
                        detail = "저장된 학교 데이터는 유지한 채 대학교 화면으로 이동합니다.",
                        action = onSwitchUniversity
                    )
                    Box(Modifier.fillMaxWidth().padding(horizontal = 17.dp).height(1.dp).background(FlowPalette.Stroke))
                    SchoolSettingsActionRow(
                        title = when (updateStatus.phase) {
                            UpdatePhase.CHECKING -> "업데이트 확인 중…"
                            UpdatePhase.DOWNLOADING -> "업데이트 다운로드 중…"
                            UpdatePhase.VERIFYING -> "업데이트 검증 중…"
                            UpdatePhase.AVAILABLE -> "새 업데이트 사용 가능"
                            UpdatePhase.READY -> "업데이트 설치 준비 완료"
                            UpdatePhase.UP_TO_DATE -> "Flow가 최신 버전입니다"
                            else -> "앱 업데이트 확인"
                        },
                        detail = updateStatus.message,
                        action = checkUpdate,
                        enabled = !updateBusy,
                        progress = updateStatus.progress.takeIf { updateStatus.phase == UpdatePhase.DOWNLOADING }
                    )
                }
            }
        }
        item { FlowSectionTitle("", "앱과 데이터") }
        item {
            FlowCard(Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth().padding(horizontal = 17.dp, vertical = 15.dp)) {
                        Text("네이티브 데이터", color = FlowPalette.Text, fontWeight = FontWeight.Black)
                        Text(
                            "학교 정보는 Flow가 직접 저장하고 표시합니다.${if (cached) " 마지막 학교 데이터는 오프라인에서도 열 수 있습니다." else ""}",
                            color = FlowPalette.Muted,
                            fontSize = 12.sp,
                            lineHeight = 18.sp,
                            modifier = Modifier.padding(top = 6.dp)
                        )
                    }
                    Box(Modifier.fillMaxWidth().padding(horizontal = 17.dp).height(1.dp).background(FlowPalette.Stroke))
                    Column(Modifier.fillMaxWidth().padding(horizontal = 17.dp, vertical = 15.dp)) {
                        Text("위젯별 설정", color = FlowPalette.Text, fontWeight = FontWeight.Black)
                        Text(
                            "Flow 위젯을 길게 눌러 자동 · 학교 · 대학교 데이터와 세부정보 표시를 위젯마다 바꿀 수 있습니다.",
                            color = FlowPalette.Muted,
                            fontSize = 12.sp,
                            lineHeight = 18.sp,
                            modifier = Modifier.padding(top = 6.dp)
                        )
                        Text(
                            "Galaxy 잠금화면에서 보이지 않으면 Good Lock → LockStar에서 Flow 위젯을 추가하세요.",
                            color = FlowPalette.Mint,
                            fontSize = 12.sp,
                            lineHeight = 18.sp,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                }
            }
        }
        item { FlowSectionTitle("", "학교 선택 초기화") }
        item {
            FlowCard(Modifier.fillMaxWidth()) {
                SchoolSettingsActionRow(
                    title = "학교/학년/반 다시 선택",
                    detail = "현재 학교 선택과 캐시된 학교 데이터를 초기화합니다.",
                    action = onChangeSchool,
                    danger = true
                )
            }
        }
    }
}

@Composable
private fun SchoolSettingsActionRow(
    title: String,
    detail: String,
    action: () -> Unit,
    danger: Boolean = false,
    enabled: Boolean = true,
    progress: Int? = null
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled, onClick = action)
            .padding(horizontal = 17.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                title,
                color = when {
                    !enabled -> FlowPalette.Dim
                    danger -> FlowPalette.Danger
                    else -> FlowPalette.Text
                },
                fontSize = 15.sp,
                fontWeight = FontWeight.Black
            )
            Text(detail, color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 4.dp))
            progress?.let { value ->
                Box(Modifier.fillMaxWidth().padding(top = 9.dp).height(3.dp).clip(RoundedCornerShape(2.dp)).background(FlowPalette.Stroke)) {
                    Box(Modifier.fillMaxWidth((value.coerceIn(0, 100) / 100f).coerceAtLeast(.01f)).height(3.dp).background(FlowPalette.Mint))
                }
            }
        }
        Text(
            "›",
            color = when {
                !enabled -> FlowPalette.Dim
                danger -> FlowPalette.Danger
                else -> FlowPalette.Mint
            },
            fontSize = 22.sp
        )
    }
}

private fun humanDate(raw: String): String = runCatching {
    LocalDate.parse(raw, DateTimeFormatter.BASIC_ISO_DATE)
        .format(DateTimeFormatter.ofPattern("M월 d일 E", Locale.KOREAN))
}.getOrDefault(raw)
