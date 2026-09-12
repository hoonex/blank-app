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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.hoonex.flow.data.FlowSchool
import io.github.hoonex.flow.data.SchoolApi
import io.github.hoonex.flow.data.SchoolDashboard
import io.github.hoonex.flow.data.SchoolSelection
import io.github.hoonex.flow.data.SchoolStore
import io.github.hoonex.flow.data.schoolDate8
import io.github.hoonex.flow.widget.UniversityWidgets
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
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

    suspend fun refresh(force: Boolean = false) {
        val selected = selection ?: return
        if (!force && dashboard?.selected == schoolDate8()) return
        loading = true
        error = ""
        runCatching { SchoolApi.dashboard(selected) }
            .onSuccess {
                dashboard = it
                store.saveDashboard(it)
                UniversityWidgets.updateAll(context)
            }
            .onFailure { error = it.message ?: "학교 데이터를 불러오지 못했습니다." }
        loading = false
    }

    LaunchedEffect(selection) { if (selection != null) refresh() }

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
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(FlowPalette.Surface)
                    .navigationBarsPadding()
                    .padding(horizontal = 5.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                SchoolTab.entries.forEach { item ->
                    val active = item == tab
                    Text(
                        item.label,
                        color = if (active) FlowPalette.Mint else FlowPalette.Muted,
                        fontSize = 11.sp,
                        fontWeight = if (active) FontWeight.Black else FontWeight.SemiBold,
                        modifier = Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .clickable { tab = item }
                            .padding(horizontal = 11.dp, vertical = 10.dp)
                    )
                }
            }
        }
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).statusBarsPadding()) {
            when (tab) {
                SchoolTab.TODAY -> SchoolTodayScreen(selection!!, dashboard, loading, error) { scope.launch { refresh(true) } }
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
            FlowBrand(compact = true)
            Text("학교 생활을\n앱 안에서.", color = FlowPalette.Text, fontSize = 38.sp, lineHeight = 42.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 18.dp))
            Text("NEIS 데이터는 JSON으로만 받아옵니다. 시간표·급식·학사일정은 앱이 직접 저장하고 그립니다.", color = FlowPalette.Muted, fontSize = 14.sp, lineHeight = 21.sp, modifier = Modifier.padding(top = 10.dp))
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
            if (results.isNotEmpty()) item { FlowSectionTitle("SCHOOL", "검색 결과", "${results.size}개") }
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
            item { FlowSectionTitle("GRADE", school!!.name, "학년 선택") }
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
            item { FlowSectionTitle("CLASS", "${school!!.name} ${grade}학년", if (loading) "불러오는 중" else "반 선택") }
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
private fun SchoolTodayScreen(selection: SchoolSelection, dashboard: SchoolDashboard?, loading: Boolean, error: String, refresh: () -> Unit) {
    val today = schoolDate8()
    val classes = dashboard?.classesOn(today).orEmpty()
    val meals = dashboard?.mealsOn(today).orEmpty()
    val events = dashboard?.eventsOn(today).orEmpty()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 30.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                FlowBrand(compact = true)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(selection.school.name, color = FlowPalette.Text, fontSize = 19.sp, fontWeight = FontWeight.Black)
                    Text("${selection.grade}학년 ${selection.className}반 · ${humanDate(today)}", color = FlowPalette.Muted, fontSize = 12.sp)
                }
                Text(if (dashboard != null) "CACHED" else "LIVE", color = FlowPalette.Mint, fontSize = 9.sp, fontWeight = FontWeight.Black)
            }
        }
        if (error.isNotBlank()) item {
            FlowCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text("새 데이터를 못 가져왔습니다.", color = FlowPalette.Danger, fontWeight = FontWeight.Bold)
                    Text("저장 데이터가 있으면 그대로 표시합니다. $error", color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
                }
            }
        }
        item {
            FlowCard(Modifier.fillMaxWidth(), accent = true) {
                Column(Modifier.padding(20.dp)) {
                    Text("TODAY", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    Text(if (loading && dashboard == null) "불러오는 중…" else if (classes.isEmpty()) "오늘 수업 없음" else "${classes.size}교시 일정", color = FlowPalette.Text, fontSize = 26.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 7.dp))
                    Text(if (meals.isEmpty()) "급식 정보 없음" else meals.first().dishes.take(3).joinToString(" · "), color = FlowPalette.Muted, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 7.dp))
                }
            }
        }
        item { FlowSectionTitle("TIMETABLE", "오늘 시간표", "${classes.size}개") }
        if (classes.isEmpty()) item { Text("등록된 수업이 없습니다.", color = FlowPalette.Muted, fontSize = 13.sp) }
        items(classes) { period ->
            FlowCard(Modifier.fillMaxWidth()) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("${period.period}", color = FlowPalette.Mint, fontSize = 20.sp, fontWeight = FontWeight.Black, modifier = Modifier.width(36.dp))
                    Column {
                        Text(period.subject.ifBlank { "과목 정보 없음" }, color = FlowPalette.Text, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Text("${period.period}교시", color = FlowPalette.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
                    }
                }
            }
        }
        item { FlowSectionTitle("MEAL", "급식", meals.firstOrNull()?.calories?.takeIf(String::isNotBlank)) }
        if (meals.isEmpty()) item { Text("오늘 급식 정보가 없습니다.", color = FlowPalette.Muted, fontSize = 13.sp) }
        items(meals) { meal ->
            FlowCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(17.dp)) {
                    Text(meal.type.ifBlank { "급식" }, color = FlowPalette.Mint, fontSize = 11.sp, fontWeight = FontWeight.Black)
                    Text(meal.dishes.joinToString(" · "), color = FlowPalette.Text, fontSize = 14.sp, lineHeight = 21.sp, modifier = Modifier.padding(top = 7.dp))
                }
            }
        }
        if (events.isNotEmpty()) {
            item { FlowSectionTitle("EVENT", "오늘 일정", "${events.size}개") }
            items(events) { event ->
                FlowCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(17.dp)) {
                        Text(event.name, color = FlowPalette.Text, fontWeight = FontWeight.Black)
                        if (event.content.isNotBlank()) Text(event.content, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
                    }
                }
            }
        }
        item { FlowSecondaryButton(if (loading) "새로고침 중…" else "데이터 새로고침", refresh, Modifier.fillMaxWidth()) }
    }
}

@Composable
private fun SchoolWeekScreen(selection: SchoolSelection, dashboard: SchoolDashboard?) {
    val days = dashboard?.timetable.orEmpty().groupBy { it.date }.toSortedMap()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 30.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            FlowSectionTitle("WEEK", "주간 시간표", "${selection.grade}학년 ${selection.className}반")
            Text("NEIS 주간 데이터 · 앱 내부 캐시", color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
        }
        if (days.isEmpty()) item { FlowCard(Modifier.fillMaxWidth()) { Text("주간 시간표가 아직 없습니다. 오늘 화면에서 새로고침하세요.", color = FlowPalette.Muted, fontSize = 13.sp, modifier = Modifier.padding(18.dp)) } }
        days.forEach { (date, periods) ->
            item { Text(humanDate(date), color = FlowPalette.Mint, fontWeight = FontWeight.Black, fontSize = 12.sp) }
            item {
                FlowCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                        periods.sortedBy { it.period }.forEach { p ->
                            Row(Modifier.fillMaxWidth()) {
                                Text("${p.period}교시", color = FlowPalette.Dim, fontSize = 12.sp, modifier = Modifier.width(52.dp))
                                Text(p.subject, color = FlowPalette.Text, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            }
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
            FlowSectionTitle("SCHOOL", school.name, school.type)
            if (school.englishName.isNotBlank()) Text(school.englishName, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
        }
        items(rows) { (label, value) ->
            FlowCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text(label, color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    Text(value, color = FlowPalette.Text, fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 6.dp))
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
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 34.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { FlowSectionTitle("SETTINGS", "Flow School", "${selection.grade}학년 ${selection.className}반") }
        item {
            FlowCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(17.dp)) {
                    Text("네이티브 데이터", color = FlowPalette.Text, fontWeight = FontWeight.Black)
                    Text("웹페이지를 렌더링하지 않습니다. NEIS와 교통 JSON만 받아 앱이 직접 저장·표시합니다.${if (cached) " 마지막 학교 데이터는 오프라인에서도 열립니다." else ""}", color = FlowPalette.Muted, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 6.dp))
                }
            }
        }
        item {
            FlowCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(17.dp)) {
                    Text("위젯별 설정", color = FlowPalette.Text, fontWeight = FontWeight.Black)
                    Text("홈 화면에서 Flow 위젯을 길게 누른 뒤 설정을 누르면 Auto / School / University와 세부정보 표시를 위젯마다 바꿀 수 있습니다.", color = FlowPalette.Muted, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 6.dp))
                    Text("Galaxy S25 기본 잠금화면 위젯 목록에 일반 앱 위젯이 안 뜨면 Good Lock → LockStar에서 Flow 위젯을 배치해야 합니다.", color = FlowPalette.Mint, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 8.dp))
                }
            }
        }
        item { FlowSecondaryButton(if (refreshing) "새로고침 중…" else "학교 데이터 새로고침", onRefresh, Modifier.fillMaxWidth()) }
        item { FlowSecondaryButton("University로 전환", onSwitchUniversity, Modifier.fillMaxWidth()) }
        item { FlowSecondaryButton("앱 업데이트 확인", checkUpdate, Modifier.fillMaxWidth()) }
        item { FlowSecondaryButton("학교/학년/반 다시 선택", onChangeSchool, Modifier.fillMaxWidth(), danger = true) }
    }
}

private fun humanDate(raw: String): String = runCatching {
    LocalDate.parse(raw, DateTimeFormatter.BASIC_ISO_DATE)
        .format(DateTimeFormatter.ofPattern("M월 d일 E", Locale.KOREAN))
}.getOrDefault(raw)
