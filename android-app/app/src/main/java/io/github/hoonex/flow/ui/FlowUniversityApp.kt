package io.github.hoonex.flow.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
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
import io.github.hoonex.flow.data.UniversityMetric
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

private enum class UniversityTab(val label: String) {
    Home("홈"), Schedule("시간표"), School("학교"), Settings("설정")
}

@Composable
fun FlowUniversityRoot(
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
    var tab by remember { mutableStateOf(UniversityTab.Home) }
    var importOpen by remember { mutableStateOf(false) }
    var majorOpen by remember { mutableStateOf(false) }

    suspend fun refreshSurfaces() {
        UniversityWidgets.updateAll(context)
        UniversityNotification.refresh(context)
    }

    if (university == null) {
        UniversitySetupScreen { selected ->
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
            bottomBar = { FlowBottomBar(tab, onTab = { tab = it }) }
        ) { padding ->
            AnimatedContent(
                targetState = tab,
                modifier = Modifier.fillMaxSize().padding(padding),
                transitionSpec = {
                    (slideInHorizontally(tween(260)) { it / 6 } + fadeIn(tween(220))) togetherWith
                        (slideOutHorizontally(tween(220)) { -it / 8 } + fadeOut(tween(170))) using
                        SizeTransform(clip = false)
                },
                label = "university-hub-tab"
            ) { current ->
                when (current) {
                    UniversityTab.Home -> HomeScreen(
                        university = university!!,
                        timetable = timetable,
                        major = major,
                        onImport = { importOpen = true },
                        onSchool = { tab = UniversityTab.School },
                        onSchedule = { tab = UniversityTab.Schedule },
                        onCampus = { openUrl(context, "https://blank-app.agfvrd.workers.dev/university/campus") }
                    )
                    UniversityTab.Schedule -> ScheduleScreen(timetable, onImport = { importOpen = true })
                    UniversityTab.School -> SchoolScreen(
                        university = university!!,
                        initialProfile = profile,
                        major = major,
                        onProfile = {
                            profile = it
                            store.saveProfile(it)
                        },
                        onMajor = {
                            major = it
                            store.saveMajor(it)
                            majorOpen = false
                        },
                        onChooseMajor = { majorOpen = true },
                        onCampus = { openUrl(context, "https://blank-app.agfvrd.workers.dev/university/campus") }
                    )
                    UniversityTab.Settings -> SettingsScreen(
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
        EverytimeSheet(
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
        MajorSheet(
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
private fun UniversitySetupScreen(onSelected: (University) -> Unit) {
    var query by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<University>>(emptyList()) }
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(FlowPalette.Background).statusBarsPadding(),
        contentPadding = PaddingValues(start = 22.dp, end = 22.dp, top = 38.dp, bottom = 42.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item { FlowBrand() }
        item {
            Spacer(Modifier.height(18.dp))
            Text("대학 생활을\nFlow로 엮기.", color = FlowPalette.Text, fontSize = 40.sp, lineHeight = 43.sp, fontWeight = FontWeight.Black)
            Text(
                "에브리타임 시간표, 대학 공시정보, 캠퍼스와 홈 위젯을 하나의 흐름으로 연결합니다.",
                color = FlowPalette.Muted,
                fontSize = 15.sp,
                lineHeight = 22.sp,
                modifier = Modifier.padding(top = 12.dp)
            )
        }
        item {
            FlowTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = "대학교 이름",
                leading = "⌕",
                modifier = Modifier.fillMaxWidth()
            )
        }
        item {
            FlowPrimaryButton(
                text = if (loading) "대학 찾는 중…" else "대학 찾기",
                onClick = {
                    if (query.trim().length < 2 || loading) return@FlowPrimaryButton
                    loading = true
                    error = ""
                    scope.launch {
                        runCatching { UniversityApi.search(query) }
                            .onSuccess { results = it }
                            .onFailure { error = it.message ?: "검색 실패" }
                        loading = false
                    }
                },
                enabled = !loading && query.trim().length >= 2,
                modifier = Modifier.fillMaxWidth()
            )
        }
        if (error.isNotBlank()) item { Text(error, color = FlowPalette.Danger, fontSize = 13.sp) }
        if (results.isNotEmpty()) item { FlowSectionTitle("SEARCH", "검색 결과", "${results.size}개") }
        items(results, key = { "${it.id}-${it.campus}-${it.address}" }) { school ->
            FlowCard(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    onSelected(school)
                }
            ) {
                Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                    FlowInitial(school.name)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(school.name, color = FlowPalette.Text, fontSize = 18.sp, fontWeight = FontWeight.Black)
                        Text(
                            listOf(school.region, school.foundation, school.campus).filter { it.isNotBlank() }.joinToString(" · "),
                            color = FlowPalette.Mint,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                        if (school.address.isNotBlank()) Text(school.address, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
                    }
                    Text("›", color = FlowPalette.Dim, fontSize = 27.sp)
                }
            }
        }
        item {
            Text("공공데이터 · 공개 공유 링크만 사용 · 로그인 정보 수집 안 함", color = FlowPalette.Dim, fontSize = 11.sp, modifier = Modifier.padding(top = 8.dp))
        }
    }
}

@Composable
private fun HomeScreen(
    university: University,
    timetable: Timetable?,
    major: UniversityMajor?,
    onImport: () -> Unit,
    onSchool: () -> Unit,
    onSchedule: () -> Unit,
    onCampus: () -> Unit
) {
    val now = remember { LocalDateTime.now() }
    val date = remember { LocalDate.now() }
    val dateText = remember(date) { date.format(DateTimeFormatter.ofPattern("M월 d일 EEEE", Locale.KOREAN)) }
    val classes = timetable?.classesForDay(todayIndex(now)).orEmpty()
    val moment = timetable?.classMoment(now) ?: ClassMoment(null, null)
    val gap = timetable?.nextGap(now)
    val credits = timetable?.totalCredits() ?: 0.0
    val weekMinutes = timetable?.weeklyMinutes() ?: 0

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp, 26.dp, 20.dp, 28.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                FlowBrand(compact = true)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(university.name, color = FlowPalette.Text, fontWeight = FontWeight.Black, fontSize = 19.sp)
                    Text(major?.name ?: dateText, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
                }
                Text(dateText, color = FlowPalette.Mint, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
        item { NextClassHero(moment, timetable != null, onImport) }
        item { FlowSectionTitle("DASHBOARD", "오늘 흐름", if (timetable == null) "연결 필요" else "${classes.size}개 일정") }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                HomeMetric("TODAY", if (timetable == null) "—" else "${classes.size}개", "오늘 일정", Modifier.weight(1f))
                HomeMetric("CREDITS", if (timetable == null) "—" else trimNumber(credits), "이번 학기 학점", Modifier.weight(1f))
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                HomeMetric(
                    "GAP",
                    gap?.let { "${it.durationMinutes}분" } ?: "—",
                    gap?.let { "${minuteText(it.startMinutes)}부터" } ?: "다음 공강 없음",
                    Modifier.weight(1f)
                )
                HomeMetric("WEEK", if (timetable == null) "—" else formatDuration(weekMinutes), "주간 수업시간", Modifier.weight(1f))
            }
        }
        if (classes.isNotEmpty()) {
            item { FlowSectionTitle("DAY FLOW", "이어지는 일정", "시간표 기준") }
            items(classes.take(4)) { item -> ClassRow(item, compact = true) }
            if (classes.size > 4) item { FlowSecondaryButton("전체 ${classes.size}개 보기", onSchedule, Modifier.fillMaxWidth()) }
        }
        item { FlowSectionTitle("CONNECT", "Flow 허브") }
        item {
            HubAction(
                kicker = "EVERYTIME",
                title = if (timetable == null) "시간표 연결" else "시간표 다시 동기화",
                description = "에브리타임 공개 공유 링크에서 수업을 가져옵니다.",
                accent = true,
                action = onImport
            )
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MiniHubAction("학교 정보", "공시 · 학과", onSchool, Modifier.weight(1f))
                MiniHubAction("캠퍼스", "지도 · 동선", onCampus, Modifier.weight(1f))
            }
        }
        item {
            MiniHubAction("주간 시간표", if (timetable == null) "에브리타임 연결 필요" else "${timetable.year}년 ${semesterLabel(timetable.semester)}", onSchedule, Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun NextClassHero(moment: ClassMoment, hasTimetable: Boolean, onImport: () -> Unit) {
    val item = moment.current ?: moment.next
    val kicker = when {
        moment.current != null -> "NOW"
        moment.next != null -> "NEXT"
        else -> "FLOW"
    }
    val title = item?.subject?.name ?: if (hasTimetable) "오늘 일정 완료" else "시간표를 연결하세요"
    val meta = item?.let {
        listOf(
            if (moment.current != null) "${it.time.end} 종료" else "${it.time.start} 시작",
            it.time.place.ifBlank { it.subject.place },
            it.subject.professor
        ).filter { value -> value.isNotBlank() }.joinToString(" · ")
    } ?: if (hasTimetable) "남은 수업이 없습니다." else "공개 공유 링크 하나면 홈과 위젯이 함께 채워집니다."

    FlowCard(Modifier.fillMaxWidth(), accent = true) {
        Column(Modifier.fillMaxWidth().padding(22.dp)) {
            Text(kicker, color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
            Text(title, color = FlowPalette.Text, fontSize = 27.sp, lineHeight = 31.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 8.dp))
            Text(meta, color = Color(0xFFC3D6D2), fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 7.dp))
            if (!hasTimetable) FlowPrimaryButton("에브리타임 연결", onImport, Modifier.fillMaxWidth().padding(top = 18.dp))
        }
    }
}

@Composable
private fun HomeMetric(kicker: String, value: String, caption: String, modifier: Modifier) {
    FlowCard(modifier) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Text(kicker, color = FlowPalette.Mint, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            Text(value, color = FlowPalette.Text, fontSize = 22.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 7.dp))
            Text(caption, color = FlowPalette.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
        }
    }
}

@Composable
private fun HubAction(kicker: String, title: String, description: String, accent: Boolean, action: () -> Unit) {
    FlowCard(Modifier.fillMaxWidth(), accent = accent, onClick = action) {
        Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(kicker, color = FlowPalette.Mint, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
                Text(title, color = FlowPalette.Text, fontWeight = FontWeight.Black, fontSize = 18.sp, modifier = Modifier.padding(top = 5.dp))
                Text(description, color = FlowPalette.Muted, fontSize = 12.sp, lineHeight = 17.sp, modifier = Modifier.padding(top = 4.dp))
            }
            Text("›", color = FlowPalette.Mint, fontSize = 28.sp)
        }
    }
}

@Composable
private fun MiniHubAction(title: String, subtitle: String, action: () -> Unit, modifier: Modifier) {
    FlowCard(modifier, onClick = action) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Text(title, color = FlowPalette.Text, fontSize = 15.sp, fontWeight = FontWeight.Black)
            Text(subtitle, color = FlowPalette.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
            Text("열기  ↗", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 14.dp))
        }
    }
}

@Composable
private fun ScheduleScreen(timetable: Timetable?, onImport: () -> Unit) {
    val days = listOf("월", "화", "수", "목", "금", "토", "일")
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp, 28.dp, 20.dp, 30.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp)
    ) {
        item {
            Text("시간표", color = FlowPalette.Text, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text(
                timetable?.let { "${it.year}년 ${semesterLabel(it.semester)} · ${trimNumber(it.totalCredits())}학점" } ?: "에브리타임 시간표를 연결하세요.",
                color = FlowPalette.Muted,
                fontSize = 13.sp,
                modifier = Modifier.padding(top = 5.dp)
            )
        }
        item { FlowSecondaryButton(if (timetable == null) "에브리타임에서 가져오기" else "시간표 다시 가져오기", onImport, Modifier.fillMaxWidth()) }
        if (timetable == null) {
            item {
                FlowCard(Modifier.fillMaxWidth(), accent = true) {
                    Column(Modifier.padding(20.dp)) {
                        Text("공개 공유 링크 하나면 끝", color = FlowPalette.Text, fontSize = 19.sp, fontWeight = FontWeight.Black)
                        Text("에브리타임 로그인 정보 없이 공개된 시간표만 가져옵니다.", color = FlowPalette.Muted, fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 6.dp))
                    }
                }
            }
        } else {
            days.forEachIndexed { index, name ->
                val classes = timetable.classesForDay(index)
                if (classes.isNotEmpty()) {
                    item { FlowSectionTitle("DAY ${index + 1}", "${name}요일", "${classes.size}개") }
                    items(classes) { ClassRow(it) }
                }
            }
        }
    }
}

@Composable
private fun ClassRow(item: ScheduledClass, compact: Boolean = false) {
    FlowCard(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(if (compact) 14.dp else 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.width(64.dp)) {
                Text(item.time.start, color = FlowPalette.Mint, fontWeight = FontWeight.Black, fontSize = 13.sp)
                Text(item.time.end, color = FlowPalette.Dim, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(item.subject.name, color = FlowPalette.Text, fontWeight = FontWeight.Black, fontSize = if (compact) 15.sp else 17.sp)
                val meta = listOf(item.time.place.ifBlank { item.subject.place }, item.subject.professor).filter { it.isNotBlank() }.joinToString(" · ")
                if (meta.isNotBlank()) Text(meta, color = FlowPalette.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
            }
            if (!compact && item.subject.credit > 0) Text("${trimNumber(item.subject.credit)}학점", color = FlowPalette.Dim, fontSize = 10.sp)
        }
    }
}

@Composable
private fun SchoolScreen(
    university: University,
    initialProfile: UniversityProfile?,
    major: UniversityMajor?,
    onProfile: (UniversityProfile) -> Unit,
    onMajor: (UniversityMajor) -> Unit,
    onChooseMajor: () -> Unit,
    onCampus: () -> Unit
) {
    var profile by remember(university.id, initialProfile) { mutableStateOf(initialProfile) }
    var loading by remember(university.id) { mutableStateOf(initialProfile == null) }
    var error by remember(university.id) { mutableStateOf("") }
    val context = LocalContext.current

    LaunchedEffect(university.id) {
        if (profile == null) {
            loading = true
            runCatching { UniversityApi.profile(university) }
                .onSuccess {
                    profile = it
                    onProfile(it)
                }
                .onFailure { error = it.message ?: "공시정보를 불러오지 못했습니다." }
            loading = false
        }
    }

    val school = profile?.school ?: university
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp, 28.dp, 20.dp, 32.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text("학교", color = FlowPalette.Text, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text("대학 공시정보 · 학과 · 캠퍼스", color = FlowPalette.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 5.dp))
        }
        item {
            FlowCard(Modifier.fillMaxWidth(), accent = true) {
                Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                    FlowInitial(school.name, large = true)
                    Spacer(Modifier.width(15.dp))
                    Column(Modifier.weight(1f)) {
                        Text(school.name, color = FlowPalette.Text, fontSize = 21.sp, fontWeight = FontWeight.Black)
                        if (school.englishName.isNotBlank()) Text(school.englishName, color = FlowPalette.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 3.dp))
                        Text(listOf(school.foundation, school.kind, school.campus).filter { it.isNotBlank() }.joinToString(" · "), color = FlowPalette.Mint, fontSize = 11.sp, modifier = Modifier.padding(top = 6.dp))
                    }
                }
            }
        }
        if (loading) item {
            Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(18.dp), color = FlowPalette.Mint, strokeWidth = 2.dp)
                Text("대학 공시정보 불러오는 중…", color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(start = 10.dp))
            }
        }
        if (error.isNotBlank()) item { Text(error, color = FlowPalette.Danger, fontSize = 12.sp) }
        profile?.let { p ->
            item { FlowSectionTitle("PUBLIC DATA", "공시 지표", if (p.partial) "일부 제한" else "최근 공시") }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ProfileMetric("등록금", metricMoney(p.tuition), p.tuition?.year.orEmpty(), Modifier.weight(1f))
                    ProfileMetric("장학금", metricMoney(p.scholarship), p.scholarship?.year.orEmpty(), Modifier.weight(1f))
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ProfileMetric("기숙사", metricPercent(p.dormitory), "수용률", Modifier.weight(1f))
                    ProfileMetric("도서관", metricPercent(p.library), "공시 지표", Modifier.weight(1f))
                }
            }
        }
        item { FlowSectionTitle("MAJOR", "내 학과", major?.college?.takeIf { it.isNotBlank() }) }
        item {
            FlowCard(Modifier.fillMaxWidth(), onClick = onChooseMajor) {
                Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(major?.name ?: "학과 선택", color = FlowPalette.Text, fontSize = 17.sp, fontWeight = FontWeight.Black)
                        Text(
                            major?.let { listOf(it.college, it.category, it.duration).filter(String::isNotBlank).joinToString(" · ") }.orEmpty().ifBlank { "웹과 같은 대학 학과 데이터를 사용합니다." },
                            color = FlowPalette.Muted,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                    Text("›", color = FlowPalette.Mint, fontSize = 27.sp)
                }
            }
        }
        item { FlowSectionTitle("CAMPUS", "캠퍼스 도구") }
        item {
            HubAction("MAP", "캠퍼스 지도 · 동선", "기존 Flow University 캠퍼스 지도와 경로 편집기를 엽니다.", true, onCampus)
        }
        if (school.homepage.isNotBlank()) item {
            MiniHubAction("학교 홈페이지", school.homepage.removePrefix("https://").removePrefix("http://"), { openUrl(context, school.homepage) }, Modifier.fillMaxWidth())
        }
        val basics = listOf(
            "설립" to school.foundation,
            "구분" to school.division.ifBlank { school.kind },
            "지역" to school.region,
            "캠퍼스" to school.campus,
            "주소" to school.address,
            "전화" to school.phone
        ).filter { it.second.isNotBlank() }
        if (basics.isNotEmpty()) {
            item { FlowSectionTitle("PROFILE", "기본 정보") }
            item {
                FlowCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 8.dp)) {
                        basics.forEachIndexed { index, (label, value) ->
                            Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(label, color = FlowPalette.Dim, fontSize = 11.sp)
                                Text(value, color = FlowPalette.Text, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f).padding(start = 20.dp))
                            }
                            if (index != basics.lastIndex) Spacer(Modifier.height(1.dp).fillMaxWidth().background(FlowPalette.Stroke.copy(alpha = 0.55f)))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileMetric(label: String, value: String, hint: String, modifier: Modifier) {
    FlowCard(modifier) {
        Column(Modifier.fillMaxWidth().padding(15.dp)) {
            Text(label, color = FlowPalette.Muted, fontSize = 10.sp)
            Text(value, color = FlowPalette.Text, fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 5.dp))
            if (hint.isNotBlank()) Text(hint, color = FlowPalette.Dim, fontSize = 9.sp, modifier = Modifier.padding(top = 3.dp))
        }
    }
}

@Composable
private fun SettingsScreen(
    university: University,
    enablePinnedNotification: () -> Unit,
    disablePinnedNotification: () -> Unit,
    checkUpdate: () -> Unit,
    reimport: () -> Unit,
    changeUniversity: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp, 28.dp, 20.dp, 32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("설정", color = FlowPalette.Text, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text(university.name, color = FlowPalette.Mint, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
        }
        item { FlowSectionTitle("SURFACES", "화면 밖의 Flow") }
        item { SettingsAction("고정 알림 켜기", "현재/다음 수업과 시간 경계를 잠금화면 알림에도 표시합니다.", enablePinnedNotification) }
        item { SettingsAction("고정 알림 끄기", "Flow University 일정 알림을 제거합니다.", disablePinnedNotification) }
        item { SettingsAction("홈 위젯", "위젯 선택기에서 다음 수업 · 오늘 흐름 · 주간 밀도를 추가할 수 있습니다.", {}) }
        item { FlowSectionTitle("DATA", "연결과 업데이트") }
        item { SettingsAction("에브리타임 다시 가져오기", "공개 공유 링크의 최신 시간표로 교체합니다.", reimport) }
        item { SettingsAction("업데이트 확인", "GitHub Release의 SHA-256과 서명을 검증한 뒤 설치합니다.", checkUpdate) }
        item { SettingsAction("대학교 다시 선택", "저장된 대학·학과·시간표 데이터를 지우고 처음부터 설정합니다.", changeUniversity, danger = true) }
        item {
            FlowCard(Modifier.fillMaxWidth()) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    FlowBrand(compact = true)
                    Column(Modifier.padding(start = 12.dp)) {
                        Text("Flow Android ${BuildConfig.VERSION_NAME}", color = FlowPalette.Text, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text("Native University Hub", color = FlowPalette.Dim, fontSize = 10.sp, modifier = Modifier.padding(top = 2.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsAction(title: String, description: String, action: () -> Unit, danger: Boolean = false) {
    FlowCard(Modifier.fillMaxWidth(), onClick = action) {
        Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, color = if (danger) FlowPalette.Danger else FlowPalette.Text, fontSize = 15.sp, fontWeight = FontWeight.Black)
                Text(description, color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 4.dp))
            }
            Text("›", color = if (danger) FlowPalette.Danger else FlowPalette.Dim, fontSize = 25.sp)
        }
    }
}

@Composable
private fun FlowBottomBar(tab: UniversityTab, onTab: (UniversityTab) -> Unit) {
    Box(Modifier.fillMaxWidth().background(Color(0xF5080B0D)).navigationBarsPadding().padding(horizontal = 12.dp, vertical = 9.dp)) {
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(FlowPalette.SurfaceSoft).padding(5.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            UniversityTab.entries.forEach { item ->
                val selected = item == tab
                Box(
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(18.dp))
                        .background(if (selected) FlowPalette.SurfaceRaised else Color.Transparent)
                        .clickable { onTab(item) }
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        item.label,
                        color = if (selected) FlowPalette.Mint else FlowPalette.Dim,
                        fontSize = 12.sp,
                        fontWeight = if (selected) FontWeight.Black else FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun EverytimeSheet(dismiss: () -> Unit, imported: (Timetable) -> Unit) {
    var url by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    FlowSheet(dismiss) {
        Text("EVERYTIME", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.4.sp)
        Text("시간표 연결", color = FlowPalette.Text, fontSize = 27.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 7.dp))
        Text("에브리타임 시간표의 공개 공유 링크만 읽습니다. 로그인 정보는 받지 않습니다.", color = FlowPalette.Muted, fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 7.dp))
        FlowTextField(
            value = url,
            onValueChange = { url = it },
            placeholder = "https://everytime.kr/@…",
            leading = "↗",
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Uri),
            modifier = Modifier.fillMaxWidth().padding(top = 18.dp)
        )
        AnimatedVisibility(error.isNotBlank(), enter = fadeIn(), exit = fadeOut()) {
            Text(error, color = FlowPalette.Danger, fontSize = 12.sp, modifier = Modifier.padding(top = 9.dp))
        }
        FlowPrimaryButton(
            text = if (loading) "가져오는 중…" else "시간표 가져오기",
            onClick = {
                loading = true
                error = ""
                scope.launch {
                    runCatching { UniversityApi.importEverytime(url) }
                        .onSuccess(imported)
                        .onFailure { error = it.message ?: "가져오기 실패" }
                    loading = false
                }
            },
            enabled = !loading && url.isNotBlank(),
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp)
        )
        FlowSecondaryButton("닫기", dismiss, Modifier.fillMaxWidth().padding(top = 9.dp))
    }
}

@Composable
private fun MajorSheet(
    university: University,
    selected: UniversityMajor?,
    dismiss: () -> Unit,
    onSelected: (UniversityMajor) -> Unit
) {
    var query by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    var majors by remember { mutableStateOf<List<UniversityMajor>>(emptyList()) }

    LaunchedEffect(university.id) {
        loading = true
        runCatching { UniversityApi.majors(university) }
            .onSuccess { majors = it }
            .onFailure { error = it.message ?: "학과 정보를 불러오지 못했습니다." }
        loading = false
    }
    val filtered = remember(majors, query) {
        val key = query.replace(" ", "").lowercase()
        if (key.isBlank()) majors else majors.filter { "${it.college}${it.name}${it.category}".replace(" ", "").lowercase().contains(key) }
    }

    FlowSheet(dismiss, tall = true) {
        Text("MAJOR", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.4.sp)
        Text("학과 선택", color = FlowPalette.Text, fontSize = 27.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 7.dp))
        Text("${university.name}의 공공데이터 학과 목록", color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))
        FlowTextField(query, { query = it }, "학과 또는 단과대학 검색", Modifier.fillMaxWidth().padding(top = 15.dp), leading = "⌕")
        if (loading) {
            Row(Modifier.padding(vertical = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(18.dp), color = FlowPalette.Mint, strokeWidth = 2.dp)
                Text("학과 불러오는 중…", color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(start = 10.dp))
            }
        }
        if (error.isNotBlank()) Text(error, color = FlowPalette.Danger, fontSize = 12.sp, modifier = Modifier.padding(top = 10.dp))
        LazyColumn(
            modifier = Modifier.fillMaxWidth().weight(1f).padding(top = 10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(filtered.take(160), key = { it.id }) { item ->
                FlowCard(
                    Modifier.fillMaxWidth(),
                    accent = selected?.id == item.id,
                    onClick = { onSelected(item) }
                ) {
                    Column(Modifier.fillMaxWidth().padding(14.dp)) {
                        Text(item.name, color = FlowPalette.Text, fontSize = 14.sp, fontWeight = FontWeight.Black)
                        Text(listOf(item.college, item.category, item.duration).filter(String::isNotBlank).joinToString(" · "), color = FlowPalette.Muted, fontSize = 10.sp, modifier = Modifier.padding(top = 3.dp))
                    }
                }
            }
        }
        FlowSecondaryButton("닫기", dismiss, Modifier.fillMaxWidth().padding(top = 10.dp))
    }
}

@Composable
private fun FlowSheet(dismiss: () -> Unit, tall: Boolean = false, content: @Composable Column.() -> Unit) {
    Dialog(onDismissRequest = dismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(
            Modifier.fillMaxSize().background(Color(0xB3000000)).clickable(onClick = dismiss),
            contentAlignment = Alignment.BottomCenter
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .then(if (tall) Modifier.fillMaxHeight(0.86f) else Modifier)
                    .clip(RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp))
                    .background(FlowPalette.SurfaceSoft)
                    .clickable(onClick = {})
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 22.dp),
                content = content
            )
        }
    }
}

@Composable
private fun FlowInitial(name: String, large: Boolean = false) {
    val clean = name.replace("대학교", "").replace("대학", "").trim().take(1).ifBlank { "F" }
    Box(
        Modifier
            .size(if (large) 58.dp else 44.dp)
            .clip(RoundedCornerShape(if (large) 19.dp else 15.dp))
            .background(Color(0xFF18302B)),
        contentAlignment = Alignment.Center
    ) {
        Text(clean, color = FlowPalette.Mint, fontSize = if (large) 23.sp else 17.sp, fontWeight = FontWeight.Black)
    }
}

private fun openUrl(context: android.content.Context, value: String) {
    runCatching {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(value)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}

private fun trimNumber(value: Double): String = if (value % 1.0 == 0.0) value.roundToInt().toString() else "%.1f".format(Locale.US, value)
private fun semesterLabel(value: String): String = if (value.endsWith("학기")) value else "${value}학기"
private fun minuteText(value: Int): String = "%02d:%02d".format(Locale.US, value / 60, value % 60)
private fun formatDuration(minutes: Int): String = if (minutes < 60) "${minutes}분" else "${minutes / 60}h ${minutes % 60}m"
private fun metricMoney(metric: UniversityMetric?): String = metric?.takeIf { it.value > 0 }?.let { "${it.value.roundToInt().toLocaleString(Locale.KOREA)}원" } ?: "—"
private fun metricPercent(metric: UniversityMetric?): String = metric?.takeIf { it.value > 0 }?.let { "${"%.1f".format(Locale.US, it.value)}%" } ?: "—"
