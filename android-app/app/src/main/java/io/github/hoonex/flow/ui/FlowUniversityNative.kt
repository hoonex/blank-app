package io.github.hoonex.flow.ui

import android.content.Intent
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import io.github.hoonex.flow.BuildConfig
import io.github.hoonex.flow.data.ClassMoment
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
import io.github.hoonex.flow.widget.UniversityWidgets
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

private enum class NativeUniversityTab(val label: String) {
    HOME("홈"), SCHEDULE("시간표"), SCHOOL("학교"), SETTINGS("설정")
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
                        onImport = { importOpen = true },
                        onSchedule = { tab = NativeUniversityTab.SCHEDULE },
                        onSchool = { tab = NativeUniversityTab.SCHOOL },
                        onCampus = { context.startActivity(Intent(context, FlowCampusActivity::class.java)) }
                    )
                    NativeUniversityTab.SCHEDULE -> NativeUniversitySchedule(timetable) { importOpen = true }
                    NativeUniversityTab.SCHOOL -> NativeUniversitySchool(
                        university = university!!,
                        initialProfile = profile,
                        major = major,
                        onProfile = {
                            profile = it
                            store.saveProfile(it)
                        },
                        onChooseMajor = { majorOpen = true },
                        onCampus = { context.startActivity(Intent(context, FlowCampusActivity::class.java)) }
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
            Text("대학 생활을\nFlow로 엮기.", color = FlowPalette.Text, fontSize = 39.sp, lineHeight = 43.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 24.dp))
            Text("시간표·공시·학과·캠퍼스 데이터를 네이티브 화면과 위젯으로 연결합니다.", color = FlowPalette.Muted, fontSize = 14.sp, lineHeight = 21.sp, modifier = Modifier.padding(top = 10.dp))
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
        if (results.isNotEmpty()) item { FlowSectionTitle("SEARCH", "검색 결과", "${results.size}개") }
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
    onImport: () -> Unit,
    onSchedule: () -> Unit,
    onSchool: () -> Unit,
    onCampus: () -> Unit
) {
    val now = remember { LocalDateTime.now() }
    val today = timetable?.classesForDay(todayIndex(now)).orEmpty()
    val moment = timetable?.classMoment(now) ?: ClassMoment(null, null)
    val gap = timetable?.nextGap(now)
    val date = remember { LocalDate.now().format(DateTimeFormatter.ofPattern("M월 d일 EEEE", Locale.KOREAN)) }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 30.dp), verticalArrangement = Arrangement.spacedBy(15.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                FlowBrand(compact = true)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(university.name, color = FlowPalette.Text, fontSize = 19.sp, fontWeight = FontWeight.Black)
                    Text(major?.name ?: date, color = FlowPalette.Muted, fontSize = 12.sp)
                }
            }
        }
        item { NativeNextClass(moment, timetable != null, onImport) }
        item { FlowSectionTitle("DASHBOARD", "오늘 흐름", if (timetable == null) "연결 필요" else "${today.size}개 일정") }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                NativeMetric("TODAY", if (timetable == null) "—" else "${today.size}개", Modifier.weight(1f))
                NativeMetric("CREDITS", timetable?.let { number(it.totalCredits()) } ?: "—", Modifier.weight(1f))
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                NativeMetric("GAP", gap?.let { "${it.durationMinutes}분" } ?: "—", Modifier.weight(1f))
                NativeMetric("WEEK", timetable?.let { "${it.weeklyMinutes() / 60}h ${it.weeklyMinutes() % 60}m" } ?: "—", Modifier.weight(1f))
            }
        }
        if (today.isNotEmpty()) {
            item { FlowSectionTitle("DAY FLOW", "이어지는 일정", "시간표 기준") }
            items(today.take(4)) { NativeClassRow(it) }
        }
        item { FlowSectionTitle("CONNECT", "Flow 허브") }
        item {
            FlowCard(Modifier.fillMaxWidth(), accent = true, onClick = onImport) {
                Column(Modifier.padding(18.dp)) {
                    Text("EVERYTIME", color = FlowPalette.Mint, fontSize = 9.sp, fontWeight = FontWeight.Black)
                    Text(if (timetable == null) "시간표 연결" else "시간표 다시 동기화", color = FlowPalette.Text, fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 5.dp))
                    Text("공개 공유 링크만 사용하며 로그인 정보는 받지 않습니다.", color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                NativeHubCard("시간표", "주간 수업", onSchedule, Modifier.weight(1f))
                NativeHubCard("학교 정보", "공시 · 학과", onSchool, Modifier.weight(1f))
            }
        }
        item { NativeHubCard("캠퍼스", "강의실 · 학식 · 카페 · 도보 경로", onCampus, Modifier.fillMaxWidth()) }
    }
}

@Composable
private fun NativeNextClass(moment: ClassMoment, connected: Boolean, onImport: () -> Unit) {
    val item = moment.current ?: moment.next
    FlowCard(Modifier.fillMaxWidth(), accent = true) {
        Column(Modifier.fillMaxWidth().padding(21.dp)) {
            Text(if (moment.current != null) "NOW" else if (moment.next != null) "NEXT" else "FLOW", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black)
            Text(item?.subject?.name ?: if (connected) "오늘 일정 완료" else "시간표를 연결하세요", color = FlowPalette.Text, fontSize = 26.sp, lineHeight = 31.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 7.dp))
            val detail = item?.let { listOf(if (moment.current != null) "${it.time.end} 종료" else "${it.time.start} 시작", it.time.place.ifBlank { it.subject.place }, it.subject.professor).filter(String::isNotBlank).joinToString(" · ") }
                ?: if (connected) "남은 수업이 없습니다." else "Everytime 공개 링크로 한 번에 가져옵니다."
            Text(detail, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
            if (!connected) FlowPrimaryButton("에브리타임 연결", onImport, Modifier.fillMaxWidth().padding(top = 16.dp))
        }
    }
}

@Composable
private fun NativeMetric(label: String, value: String, modifier: Modifier) {
    FlowCard(modifier) {
        Column(Modifier.fillMaxWidth().padding(15.dp)) {
            Text(label, color = FlowPalette.Mint, fontSize = 9.sp, fontWeight = FontWeight.Black)
            Text(value, color = FlowPalette.Text, fontSize = 20.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 6.dp))
        }
    }
}

@Composable
private fun NativeHubCard(title: String, subtitle: String, onClick: () -> Unit, modifier: Modifier) {
    FlowCard(modifier, onClick = onClick) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Text(title, color = FlowPalette.Text, fontSize = 15.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 4.dp))
            Text("열기  ↗", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
        }
    }
}

@Composable
private fun NativeUniversitySchedule(timetable: Timetable?, onImport: () -> Unit) {
    val days = listOf("월", "화", "수", "목", "금", "토", "일")
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 30.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item {
            FlowSectionTitle("SCHEDULE", "시간표", timetable?.let { "${it.year}년 ${semester(it.semester)} · ${number(it.totalCredits())}학점" })
            Text(timetable?.let { "${it.year}년 ${semester(it.semester)} · ${number(it.totalCredits())}학점" } ?: "에브리타임 시간표를 연결하세요.", color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
        }
        item { FlowSecondaryButton(if (timetable == null) "에브리타임에서 가져오기" else "시간표 다시 가져오기", onImport, Modifier.fillMaxWidth()) }
        if (timetable == null) {
            item { FlowCard(Modifier.fillMaxWidth(), accent = true) { Text("공개 공유 링크 하나면 홈·위젯·알림이 같이 채워집니다.", color = FlowPalette.Text, fontSize = 14.sp, lineHeight = 20.sp, modifier = Modifier.padding(19.dp)) } }
        } else {
            days.forEachIndexed { index, label ->
                val classes = timetable.classesForDay(index)
                if (classes.isNotEmpty()) {
                    item { FlowSectionTitle("DAY ${index + 1}", "${label}요일", "${classes.size}개") }
                    items(classes) { NativeClassRow(it) }
                }
            }
        }
    }
}

@Composable
private fun NativeClassRow(item: ScheduledClass) {
    FlowCard(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.width(64.dp)) {
                Text(item.time.start, color = FlowPalette.Mint, fontSize = 13.sp, fontWeight = FontWeight.Black)
                Text(item.time.end, color = FlowPalette.Dim, fontSize = 10.sp)
            }
            Column(Modifier.weight(1f)) {
                Text(item.subject.name, color = FlowPalette.Text, fontSize = 15.sp, fontWeight = FontWeight.Black)
                val detail = listOf(item.time.place.ifBlank { item.subject.place }, item.subject.professor).filter(String::isNotBlank).joinToString(" · ")
                if (detail.isNotBlank()) Text(detail, color = FlowPalette.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
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
    onChooseMajor: () -> Unit,
    onCampus: () -> Unit
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
        item { FlowSectionTitle("UNIVERSITY", school.name, listOf(school.region, school.campus).filter(String::isNotBlank).joinToString(" · ")) }
        if (loading) item {
            Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(18.dp), color = FlowPalette.Mint, strokeWidth = 2.dp)
                Text("공시정보 불러오는 중…", color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(start = 10.dp))
            }
        }
        if (error.isNotBlank()) item { Text(error, color = FlowPalette.Danger, fontSize = 12.sp) }
        profile?.let { p ->
            item { FlowSectionTitle("PUBLIC DATA", "공시 지표", if (p.partial) "일부 제한" else "최근 공시") }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    NativeInfoMetric("등록금", p.tuition?.value?.takeIf { it > 0 }?.roundToInt()?.let { "${it / 10_000}만원" } ?: "—", Modifier.weight(1f))
                    NativeInfoMetric("장학금", p.scholarship?.value?.takeIf { it > 0 }?.roundToInt()?.let { "${it / 10_000}만원" } ?: "—", Modifier.weight(1f))
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    NativeInfoMetric("기숙사", p.dormitory?.value?.takeIf { it > 0 }?.let { "${"%.1f".format(Locale.US, it)}%" } ?: "—", Modifier.weight(1f))
                    NativeInfoMetric("도서관", p.library?.value?.takeIf { it > 0 }?.let { "${"%.1f".format(Locale.US, it)}" } ?: "—", Modifier.weight(1f))
                }
            }
        }
        item { FlowSectionTitle("MAJOR", "내 학과", major?.college) }
        item {
            FlowCard(Modifier.fillMaxWidth(), onClick = onChooseMajor) {
                Column(Modifier.fillMaxWidth().padding(17.dp)) {
                    Text(major?.name ?: "학과 선택", color = FlowPalette.Text, fontSize = 17.sp, fontWeight = FontWeight.Black)
                    Text(major?.let { listOf(it.college, it.category, it.duration).filter(String::isNotBlank).joinToString(" · ") } ?: "공공데이터에서 학과를 검색합니다.", color = FlowPalette.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
        item { FlowSectionTitle("CAMPUS", "캠퍼스") }
        item { NativeHubCard("네이티브 캠퍼스 열기", "강의실 · 학식 · 카페 · 편의점 · 도보 경로", onCampus, Modifier.fillMaxWidth()) }
        val rows = listOf("설립" to school.foundation, "구분" to school.division.ifBlank { school.kind }, "주소" to school.address, "전화" to school.phone).filter { it.second.isNotBlank() }
        if (rows.isNotEmpty()) {
            item { FlowSectionTitle("PROFILE", "기본 정보") }
            items(rows) { (label, value) ->
                FlowCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(15.dp)) {
                        Text(label, color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black)
                        Text(value, color = FlowPalette.Text, fontSize = 13.sp, lineHeight = 19.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 5.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun NativeInfoMetric(label: String, value: String, modifier: Modifier) {
    FlowCard(modifier) {
        Column(Modifier.fillMaxWidth().padding(15.dp)) {
            Text(label, color = FlowPalette.Muted, fontSize = 10.sp)
            Text(value, color = FlowPalette.Text, fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 5.dp))
        }
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
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 34.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
        item { FlowSectionTitle("SETTINGS", "Flow University", university.name) }
        item { NativeSettingsAction("고정 알림 켜기", "현재/다음 수업을 시스템 알림으로 유지합니다.", enablePinnedNotification) }
        item { NativeSettingsAction("고정 알림 끄기", "Flow 일정 알림을 제거합니다.", disablePinnedNotification) }
        item {
            FlowCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(17.dp)) {
                    Text("위젯별 설정", color = FlowPalette.Text, fontWeight = FontWeight.Black)
                    Text("Flow 위젯을 길게 누르고 설정을 열면 Auto / School / University와 세부정보 표시를 위젯마다 바꿀 수 있습니다.", color = FlowPalette.Muted, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 6.dp))
                    Text("Galaxy S25 잠금화면은 기본 Brief 위젯 목록이 아니라 Good Lock → LockStar에서 일반 Flow 위젯을 배치해야 합니다.", color = FlowPalette.Mint, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 8.dp))
                }
            }
        }
        item { NativeSettingsAction("에브리타임 다시 가져오기", "공개 공유 링크의 최신 시간표로 교체합니다.", reimport) }
        item { NativeSettingsAction("업데이트 확인", "서명·SHA-256을 검증한 릴리스를 설치합니다.", checkUpdate) }
        item { NativeSettingsAction("대학교 다시 선택", "대학·학과·시간표 데이터를 초기화합니다.", changeUniversity, danger = true) }
        item { Text("Flow Android ${BuildConfig.VERSION_NAME} · School + University unified native app", color = FlowPalette.Dim, fontSize = 10.sp) }
    }
}

@Composable
private fun NativeSettingsAction(title: String, detail: String, action: () -> Unit, danger: Boolean = false) {
    FlowCard(Modifier.fillMaxWidth(), onClick = action) {
        Row(Modifier.fillMaxWidth().padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, color = if (danger) FlowPalette.Danger else FlowPalette.Text, fontSize = 15.sp, fontWeight = FontWeight.Black)
                Text(detail, color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 4.dp))
            }
            Text("›", color = if (danger) FlowPalette.Danger else FlowPalette.Mint, fontSize = 22.sp)
        }
    }
}

@Composable
private fun NativeUniversityBottomBar(tab: NativeUniversityTab, onTab: (NativeUniversityTab) -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(FlowPalette.Surface).navigationBarsPadding().padding(horizontal = 8.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        NativeUniversityTab.entries.forEach { item ->
            val active = item == tab
            Text(
                item.label,
                color = if (active) FlowPalette.Mint else FlowPalette.Muted,
                fontSize = 12.sp,
                fontWeight = if (active) FontWeight.Black else FontWeight.SemiBold,
                modifier = Modifier.clip(RoundedCornerShape(15.dp)).clickable { onTab(item) }.padding(horizontal = 17.dp, vertical = 10.dp)
            )
        }
    }
}

@Composable
private fun NativeEverytimeSheet(dismiss: () -> Unit, imported: (Timetable) -> Unit) {
    var url by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    NativeFlowSheet(dismiss) {
        Text("EVERYTIME", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black)
        Text("시간표 연결", color = FlowPalette.Text, fontSize = 27.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 7.dp))
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
        FlowSecondaryButton("닫기", dismiss, Modifier.fillMaxWidth().padding(top = 8.dp))
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
    NativeFlowSheet(dismiss, tall = true) {
        Text("MAJOR", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black)
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
        FlowSecondaryButton("닫기", dismiss, Modifier.fillMaxWidth().padding(top = 9.dp))
    }
}

@Composable
private fun NativeFlowSheet(dismiss: () -> Unit, tall: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    Dialog(onDismissRequest = dismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Color(0xB3000000)).clickable(onClick = dismiss), contentAlignment = Alignment.BottomCenter) {
            Column(
                Modifier.fillMaxWidth().then(if (tall) Modifier.fillMaxHeight(0.86f) else Modifier)
                    .clip(RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp))
                    .background(FlowPalette.Surface)
                    .clickable(onClick = {})
                    .navigationBarsPadding()
                    .padding(20.dp),
                content = content
            )
        }
    }
}

private fun number(value: Double): String = if (value % 1.0 == 0.0) value.roundToInt().toString() else "%.1f".format(Locale.US, value)
private fun semester(value: String): String = if (value.endsWith("학기")) value else "${value}학기"
