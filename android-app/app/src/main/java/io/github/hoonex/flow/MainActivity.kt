package io.github.hoonex.flow

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.glance.appwidget.updateAll
import androidx.lifecycle.lifecycleScope
import io.github.hoonex.flow.data.ScheduledClass
import io.github.hoonex.flow.data.Timetable
import io.github.hoonex.flow.data.University
import io.github.hoonex.flow.data.UniversityApi
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.data.classMoment
import io.github.hoonex.flow.data.classesForDay
import io.github.hoonex.flow.data.todayIndex
import io.github.hoonex.flow.notification.UniversityNotification
import io.github.hoonex.flow.update.GitHubUpdateManager
import io.github.hoonex.flow.widget.UniversityWidget
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

class MainActivity : ComponentActivity() {
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) UniversityNotification.refresh(this)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            FlowTheme {
                FlowRoot(
                    enablePinnedNotification = ::enablePinnedNotification,
                    disablePinnedNotification = { UniversityNotification.disable(this) },
                    checkUpdate = { lifecycleScope.launch { GitHubUpdateManager.checkAndMaybeInstall(this@MainActivity, silent = false) } }
                )
            }
        }
        lifecycleScope.launch { GitHubUpdateManager.checkAndMaybeInstall(this@MainActivity, silent = true) }
    }

    override fun onResume() {
        super.onResume()
        GitHubUpdateManager.resumeStagedInstall(this)
    }

    private fun enablePinnedNotification() {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            UniversityNotification.refresh(this)
        }
    }
}

private enum class Tab(val label: String) { Today("오늘"), Week("시간표"), Settings("설정") }

private val FlowColors = darkColorScheme(
    primary = Color(0xFF7BE7D6),
    onPrimary = Color(0xFF00201B),
    background = Color(0xFF0B0D0F),
    onBackground = Color(0xFFF4F6F7),
    surface = Color(0xFF12161A),
    onSurface = Color(0xFFF4F6F7),
    surfaceVariant = Color(0xFF1B2127),
    onSurfaceVariant = Color(0xFFBBC3CA),
    outline = Color(0xFF39434C)
)

@Composable
private fun FlowTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = FlowColors, content = content)
}

@Composable
private fun FlowRoot(
    enablePinnedNotification: () -> Unit,
    disablePinnedNotification: () -> Unit,
    checkUpdate: () -> Unit
) {
    val context = LocalContext.current
    val store = remember { UniversityStore(context) }
    val scope = rememberCoroutineScope()
    var university by remember { mutableStateOf(store.loadUniversity()) }
    var timetable by remember { mutableStateOf(store.loadTimetable()) }
    var tab by remember { mutableStateOf(Tab.Today) }
    var importOpen by remember { mutableStateOf(false) }

    suspend fun refreshSurfaces() {
        UniversityWidget().updateAll(context)
        UniversityNotification.refresh(context)
    }

    if (university == null) {
        UniversitySetupScreen { selected ->
            store.saveUniversity(selected)
            university = selected
            scope.launch { UniversityWidget().updateAll(context) }
        }
        return
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            FlowBottomBar(tab = tab, onTab = { tab = it })
        }
    ) { padding ->
        AnimatedContent(
            targetState = tab,
            modifier = Modifier.fillMaxSize().padding(padding),
            transitionSpec = {
                (slideInHorizontally(tween(260)) { it / 5 } + fadeIn(tween(220))) togetherWith
                    (slideOutHorizontally(tween(220)) { -it / 7 } + fadeOut(tween(180))) using
                    SizeTransform(clip = false)
            },
            label = "flow-tab"
        ) { target ->
            when (target) {
                Tab.Today -> TodayScreen(university!!, timetable, onImport = { importOpen = true })
                Tab.Week -> WeekScreen(timetable, onImport = { importOpen = true })
                Tab.Settings -> SettingsScreen(
                    university = university!!,
                    enablePinnedNotification = enablePinnedNotification,
                    disablePinnedNotification = disablePinnedNotification,
                    checkUpdate = checkUpdate,
                    changeUniversity = {
                        store.clear()
                        university = null
                        timetable = null
                    }
                )
            }
        }
    }

    if (importOpen) {
        ImportDialog(
            dismiss = { importOpen = false },
            imported = { imported ->
                store.saveTimetable(imported)
                timetable = imported
                importOpen = false
                scope.launch { refreshSurfaces() }
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
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 22.dp, end = 22.dp, top = 72.dp, bottom = 40.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text("FLOW", color = MaterialTheme.colorScheme.primary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            Text("대학 생활을\n잠금화면까지.", fontSize = 38.sp, lineHeight = 42.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(10.dp))
            Text("웹 화면을 옮긴 앱이 아니라, 오늘 일정과 다음 행동을 가장 가까운 화면에 두는 Flow University입니다.", color = MaterialTheme.colorScheme.onSurfaceVariant, lineHeight = 21.sp)
        }
        item {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text("대학교 이름") }
            )
        }
        item {
            Button(
                onClick = {
                    if (query.trim().length < 2) return@Button
                    loading = true; error = ""
                    scope.launch {
                        runCatching { UniversityApi.search(query) }
                            .onSuccess { results = it }
                            .onFailure { error = it.message ?: "검색 실패" }
                        loading = false
                    }
                },
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) { if (loading) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp) else Text("대학 찾기") }
        }
        if (error.isNotBlank()) item { Text(error, color = Color(0xFFFFA7A7)) }
        items(results, key = { "${it.id}-${it.campus}-${it.address}" }) { school ->
            Card(
                modifier = Modifier.fillMaxWidth().clickable {
                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                    onSelected(school)
                },
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(22.dp)
            ) {
                Column(Modifier.padding(18.dp)) {
                    Text(school.name, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(5.dp))
                    Text(listOf(school.region, school.foundation, school.campus).filter { it.isNotBlank() }.joinToString(" · "), color = MaterialTheme.colorScheme.primary, fontSize = 12.sp)
                    if (school.address.isNotBlank()) Text(school.address, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, modifier = Modifier.padding(top = 7.dp))
                }
            }
        }
    }
}

@Composable
private fun TodayScreen(university: University, timetable: Timetable?, onImport: () -> Unit) {
    val date = remember { LocalDate.now() }
    val dateText = remember(date) { date.format(DateTimeFormatter.ofPattern("M월 d일 EEEE", Locale.KOREAN)) }
    val classes = timetable?.classesForDay(todayIndex()).orEmpty()
    val moment = timetable?.classMoment()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(22.dp, 34.dp, 22.dp, 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text(dateText, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text(university.name, fontSize = 30.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 5.dp))
        }
        item { NextClassCard(moment?.current, moment?.next, timetable != null, onImport) }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("오늘", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                Text(if (timetable == null) "시간표 미등록" else "${classes.size}개", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (classes.isEmpty()) {
            item { EmptySchedule(timetable == null, onImport) }
        } else {
            items(classes) { item -> ClassRow(item) }
        }
    }
}

@Composable
private fun NextClassCard(current: ScheduledClass?, next: ScheduledClass?, hasTimetable: Boolean, onImport: () -> Unit) {
    val item = current ?: next
    val kicker = when {
        current != null -> "NOW"
        next != null -> "NEXT"
        else -> "FLOW"
    }
    val title = item?.subject?.name ?: if (hasTimetable) "오늘 일정 끝" else "시간표를 연결하세요"
    val meta = item?.let {
        listOf(if (current != null) "${it.time.end} 종료" else "${it.time.start} 시작", it.time.place.ifBlank { it.subject.place }, it.subject.professor)
            .filter(String::isNotBlank).joinToString(" · ")
    } ?: if (hasTimetable) "남은 수업이 없습니다." else "에브리타임 공개 공유 링크로 바로 가져올 수 있습니다."

    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF162522)), shape = RoundedCornerShape(28.dp)) {
        Column(Modifier.fillMaxWidth().padding(22.dp)) {
            Text(kicker, color = MaterialTheme.colorScheme.primary, fontSize = 12.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(9.dp))
            Text(title, fontSize = 27.sp, fontWeight = FontWeight.Black)
            Text(meta, color = Color(0xFFC9D7D4), modifier = Modifier.padding(top = 8.dp), lineHeight = 20.sp)
            if (!hasTimetable) {
                Button(onClick = onImport, modifier = Modifier.padding(top = 18.dp), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)) { Text("시간표 가져오기") }
            }
        }
    }
}

@Composable
private fun ClassRow(item: ScheduledClass) {
    Row(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(MaterialTheme.colorScheme.surface).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.size(66.dp), verticalArrangement = Arrangement.Center) {
            Text(item.time.start, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            Text(item.time.end, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        }
        Column(Modifier.weight(1f)) {
            Text(item.subject.name, fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Text(listOf(item.time.place.ifBlank { item.subject.place }, item.subject.professor).filter { it.isNotBlank() }.joinToString(" · "), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, modifier = Modifier.padding(top = 3.dp))
        }
    }
}

@Composable
private fun EmptySchedule(missing: Boolean, onImport: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(22.dp)) {
        Column(Modifier.fillMaxWidth().padding(20.dp)) {
            Text(if (missing) "아직 시간표가 없습니다." else "오늘은 공강입니다.", fontWeight = FontWeight.Bold)
            if (missing) TextButton(onClick = onImport) { Text("에브리타임에서 가져오기") }
        }
    }
}

@Composable
private fun WeekScreen(timetable: Timetable?, onImport: () -> Unit) {
    val days = listOf("월", "화", "수", "목", "금", "토", "일")
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(22.dp, 34.dp, 22.dp, 28.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text("시간표", fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text(timetable?.let { "${it.year}년 ${it.semester}학기" } ?: "에브리타임 시간표를 연결하세요.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
        }
        if (timetable == null) {
            item { Button(onClick = onImport) { Text("시간표 가져오기") } }
        } else {
            days.forEachIndexed { index, name ->
                val classes = timetable.classesForDay(index)
                if (classes.isNotEmpty()) {
                    item { Text("${name}요일", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold) }
                    items(classes) { ClassRow(it) }
                }
            }
        }
    }
}

@Composable
private fun SettingsScreen(
    university: University,
    enablePinnedNotification: () -> Unit,
    disablePinnedNotification: () -> Unit,
    checkUpdate: () -> Unit,
    changeUniversity: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(22.dp, 34.dp, 22.dp, 28.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("설정", fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text(university.name, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 6.dp))
        }
        item { SettingsAction("고정 알림 켜기", "앱을 열지 않아도 현재/다음 수업을 계속 표시합니다.", enablePinnedNotification) }
        item { SettingsAction("고정 알림 끄기", "Flow University 알림을 제거합니다.", disablePinnedNotification) }
        item { SettingsAction("업데이트 확인", "GitHub Release의 서명·패키지·SHA-256을 검증한 뒤 설치합니다.", checkUpdate) }
        item { SettingsAction("대학교 다시 선택", "저장된 대학과 시간표를 지우고 처음부터 설정합니다.", changeUniversity) }
        item { Text("Flow Android ${BuildConfig.VERSION_NAME}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, modifier = Modifier.padding(top = 12.dp)) }
    }
}

@Composable
private fun SettingsAction(title: String, description: String, action: () -> Unit) {
    Surface(modifier = Modifier.fillMaxWidth().clickable(onClick = action), color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(20.dp)) {
        Column(Modifier.padding(18.dp)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 4.dp))
        }
    }
}

@Composable
private fun FlowBottomBar(tab: Tab, onTab: (Tab) -> Unit) {
    Surface(color = Color(0xF20E1114)) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Tab.entries.forEach { item ->
                val selected = item == tab
                Box(
                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(18.dp))
                        .background(if (selected) MaterialTheme.colorScheme.surfaceVariant else Color.Transparent)
                        .clickable { onTab(item) }.padding(vertical = 13.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(item.label, color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium)
                }
            }
        }
    }
}

@Composable
private fun ImportDialog(dismiss: () -> Unit, imported: (Timetable) -> Unit) {
    var url by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = dismiss,
        title = { Text("시간표 가져오기") },
        text = {
            Column {
                Text("에브리타임에서 시간표를 공개 공유한 뒤 링크를 붙여 넣으세요.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedTextField(value = url, onValueChange = { url = it }, label = { Text("https://everytime.kr/@…") }, modifier = Modifier.fillMaxWidth().padding(top = 12.dp), singleLine = true)
                AnimatedVisibility(error.isNotBlank(), enter = fadeIn(), exit = fadeOut()) { Text(error, color = Color(0xFFFFA7A7), fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp)) }
            }
        },
        confirmButton = {
            Button(enabled = !loading && url.isNotBlank(), onClick = {
                loading = true; error = ""
                scope.launch {
                    runCatching { UniversityApi.importEverytime(url) }
                        .onSuccess(imported)
                        .onFailure { error = it.message ?: "가져오기 실패" }
                    loading = false
                }
            }) { Text(if (loading) "가져오는 중" else "가져오기") }
        },
        dismissButton = { OutlinedButton(onClick = dismiss) { Text("취소") } }
    )
}
