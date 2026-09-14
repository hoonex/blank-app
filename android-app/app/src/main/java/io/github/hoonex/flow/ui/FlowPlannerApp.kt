package io.github.hoonex.flow.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import io.github.hoonex.flow.data.FlowPlannerStore
import io.github.hoonex.flow.data.FlowTask
import io.github.hoonex.flow.data.FlowTaskKind
import io.github.hoonex.flow.data.FlowTaskScope
import io.github.hoonex.flow.data.isDueOn
import io.github.hoonex.flow.data.plannerStats
import io.github.hoonex.flow.data.sortedPlannerTasks
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun FlowPlannerRoot() {
    val context = LocalContext.current
    val store = remember { FlowPlannerStore(context) }
    var tasks by remember { mutableStateOf(store.load()) }
    var addOpen by remember { mutableStateOf(false) }
    val now = LocalDateTime.now()
    val stats = tasks.plannerStats(now)
    val today = now.toLocalDate()
    val openTasks = tasks.sortedPlannerTasks().filterNot { it.done }
    val completed = tasks.sortedPlannerTasks().filter { it.done }

    fun persist(next: List<FlowTask>) {
        val sorted = next.sortedPlannerTasks()
        tasks = sorted
        store.save(sorted)
    }

    FlowBackdrop(accent = FlowPalette.Planner) {
        LazyColumn(
            modifier = Modifier.fillMaxSize().statusBarsPadding(),
            contentPadding = PaddingValues(20.dp, 28.dp, 20.dp, 38.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    FlowBrand(compact = true)
                    Spacer(Modifier.weight(1f))
                    FlowPill("PLANNER", FlowPalette.Planner)
                }
                Text("Planner", color = FlowPalette.Text, fontSize = 36.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.8).sp, modifier = Modifier.padding(top = 18.dp))
                Text("School과 University를 오가도 일정은 한곳에 남습니다.", color = FlowPalette.Muted, fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 5.dp))
            }

            item {
                FlowCard(Modifier.fillMaxWidth(), accent = true, accentColor = FlowPalette.Planner) {
                    Column(Modifier.fillMaxWidth().padding(20.dp)) {
                        Text("THIS WEEK", color = FlowPalette.Planner, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.35.sp)
                        Text(
                            when {
                                stats.overdue > 0 -> "밀린 일정 ${stats.overdue}개"
                                stats.today > 0 -> "오늘 ${stats.today}개 마감"
                                openTasks.isEmpty() -> "남은 일정 없음"
                                else -> "7일 안에 ${stats.nextSevenDays}개"
                            },
                            color = FlowPalette.Text,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = (-0.35).sp,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                        Row(Modifier.fillMaxWidth().padding(top = 9.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            FlowPill("OPEN ${openTasks.size}", FlowPalette.Planner)
                            FlowPill("DONE ${stats.completed}", FlowPalette.Mint)
                            if (stats.overdue > 0) FlowPill("LATE ${stats.overdue}", FlowPalette.Danger)
                        }
                    }
                }
            }

            item { FlowPrimaryButton("새 일정 추가", { addOpen = true }, Modifier.fillMaxWidth()) }

            val todayTasks = openTasks.filter { it.isDueOn(today) }
            if (todayTasks.isNotEmpty()) {
                item { FlowSectionTitle("TODAY", "오늘 마감", "${todayTasks.size}개") }
                items(todayTasks, key = { "today-${it.id}" }) { task ->
                    PlannerTaskCard(task, now, onToggle = { persist(tasks.map { if (it.id == task.id) it.copy(done = !it.done) else it }) }, onDelete = { persist(tasks.filterNot { it.id == task.id }) })
                }
            }

            val upcoming = openTasks.filterNot { it.isDueOn(today) }
            item { FlowSectionTitle("UPCOMING", "다가오는 일정", "${upcoming.size}개") }
            if (upcoming.isEmpty()) {
                item {
                    FlowCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(18.dp)) {
                            Text("일정이 비어 있어요", color = FlowPalette.Text, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                            Text("과제나 시험을 넣어두면 School과 University 어디서든 같은 Planner를 볼 수 있습니다.", color = FlowPalette.Muted, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 5.dp))
                        }
                    }
                }
            } else {
                items(upcoming, key = { "upcoming-${it.id}" }) { task ->
                    PlannerTaskCard(task, now, onToggle = { persist(tasks.map { if (it.id == task.id) it.copy(done = !it.done) else it }) }, onDelete = { persist(tasks.filterNot { it.id == task.id }) })
                }
            }

            if (completed.isNotEmpty()) {
                item { FlowSectionTitle("DONE", "완료", "${completed.size}개") }
                items(completed.take(8), key = { "done-${it.id}" }) { task ->
                    PlannerTaskCard(task, now, onToggle = { persist(tasks.map { if (it.id == task.id) it.copy(done = !it.done) else it }) }, onDelete = { persist(tasks.filterNot { it.id == task.id }) })
                }
            }
        }
    }

    if (addOpen) {
        PlannerAddSheet(
            dismiss = { addOpen = false },
            save = { task ->
                persist(tasks + task)
                addOpen = false
            }
        )
    }
}

@Composable
private fun PlannerTaskCard(task: FlowTask, now: LocalDateTime, onToggle: () -> Unit, onDelete: () -> Unit) {
    val due = task.dueDateTime()
    val overdue = !task.done && due?.isBefore(now) == true
    val accent = if (overdue) FlowPalette.Danger else FlowPalette.Planner
    FlowCard(Modifier.fillMaxWidth(), accent = overdue, onClick = onToggle, accentColor = accent) {
        Row(Modifier.fillMaxWidth().padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (task.done) FlowPalette.Mint else FlowPalette.Planner.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Text(if (task.done) "✓" else kindGlyph(task.kind), color = if (task.done) Color(0xFF05211C) else FlowPalette.Planner, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp)
            }
            Column(Modifier.padding(start = 13.dp).fillMaxWidth()) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(task.title, color = if (task.done) FlowPalette.Dim else FlowPalette.Text, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.fillMaxWidth(0.78f))
                    Text("삭제", color = FlowPalette.Dim, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable(onClick = onDelete).padding(6.dp))
                }
                Text(
                    listOf(task.kind.label, task.scope.label, dueLabel(due, overdue)).filter(String::isNotBlank).joinToString(" · "),
                    color = if (overdue) FlowPalette.Danger else FlowPalette.Planner,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 4.dp)
                )
                if (task.note.isNotBlank()) Text(task.note, color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 5.dp))
            }
        }
    }
}

@Composable
private fun PlannerAddSheet(dismiss: () -> Unit, save: (FlowTask) -> Unit) {
    var title by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf(FlowTaskKind.ASSIGNMENT) }
    var scope by remember { mutableStateOf(FlowTaskScope.FLOW) }
    var date by remember { mutableStateOf(LocalDate.now()) }
    var time by remember { mutableStateOf(LocalTime.of(23, 59)) }
    val dates = remember { (0L..13L).map { LocalDate.now().plusDays(it) } }
    val times = listOf(LocalTime.of(8, 0), LocalTime.of(13, 0), LocalTime.of(18, 0), LocalTime.of(23, 59))

    Dialog(onDismissRequest = dismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Color(0xC0000000)), contentAlignment = Alignment.BottomCenter) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp))
                    .background(Color(0xFF0C1114))
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 22.dp)
            ) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    FlowPill("NEW PLAN", FlowPalette.Planner)
                    Spacer(Modifier.weight(1f))
                    Text("FLOW", color = FlowPalette.Dim, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp)
                }
                Text("일정 추가", color = FlowPalette.Text, fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.4).sp, modifier = Modifier.padding(top = 10.dp))
                Text("과제, 시험, 할 일을 한 곳에 정리하세요.", color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 5.dp))

                FlowTextField(title, { title = it }, "과제 · 시험 · 할 일 제목", Modifier.fillMaxWidth().padding(top = 16.dp), leading = "+")
                FlowTextField(note, { note = it }, "메모 (선택)", Modifier.fillMaxWidth().padding(top = 9.dp), singleLine = false)

                Text("종류", color = FlowPalette.Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 15.dp, bottom = 7.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    FlowTaskKind.entries.forEach { item -> PlannerChip(item.label, item == kind) { kind = item } }
                }

                Text("사용 영역", color = FlowPalette.Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 14.dp, bottom = 7.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    FlowTaskScope.entries.forEach { item -> PlannerChip(item.label, item == scope) { scope = item } }
                }

                Text("마감 날짜", color = FlowPalette.Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 14.dp, bottom = 7.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    items(dates, key = { it.toString() }) { item -> PlannerChip(shortDate(item), item == date) { date = item } }
                }

                Text("마감 시간", color = FlowPalette.Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 14.dp, bottom = 7.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    times.forEach { item -> PlannerChip(item.format(DateTimeFormatter.ofPattern("HH:mm")), item == time) { time = item } }
                }

                AnimatedVisibility(title.isBlank(), enter = fadeIn(), exit = fadeOut()) {
                    Text("제목을 입력하면 저장할 수 있습니다.", color = FlowPalette.Dim, fontSize = 11.sp, modifier = Modifier.padding(top = 10.dp))
                }
                FlowPrimaryButton(
                    "Flow에 저장",
                    { save(FlowTask(title = title.trim(), note = note.trim(), dueAt = LocalDateTime.of(date, time).toString(), kind = kind, scope = scope)) },
                    Modifier.fillMaxWidth().padding(top = 14.dp),
                    enabled = title.isNotBlank()
                )
                FlowSecondaryButton("닫기", dismiss, Modifier.fillMaxWidth().padding(top = 8.dp))
            }
        }
    }
}

@Composable
private fun PlannerChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .clip(RoundedCornerShape(13.dp))
            .background(if (selected) FlowPalette.Planner else FlowPalette.SurfaceRaised)
            .clickable(onClick = onClick)
            .padding(horizontal = 11.dp, vertical = 9.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(label, color = if (selected) Color(0xFF181329) else FlowPalette.Muted, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
    }
}

private fun kindGlyph(kind: FlowTaskKind): String = when (kind) {
    FlowTaskKind.ASSIGNMENT -> "A"
    FlowTaskKind.EXAM -> "E"
    FlowTaskKind.TODO -> "T"
}

private fun dueLabel(due: LocalDateTime?, overdue: Boolean): String {
    if (due == null) return "날짜 없음"
    val prefix = when {
        overdue -> "지남"
        due.toLocalDate() == LocalDate.now() -> "오늘"
        due.toLocalDate() == LocalDate.now().plusDays(1) -> "내일"
        else -> due.format(DateTimeFormatter.ofPattern("M/d", Locale.KOREAN))
    }
    return "$prefix ${due.format(DateTimeFormatter.ofPattern("HH:mm"))}"
}

private fun shortDate(date: LocalDate): String = when (date) {
    LocalDate.now() -> "오늘"
    LocalDate.now().plusDays(1) -> "내일"
    else -> date.format(DateTimeFormatter.ofPattern("M/d E", Locale.KOREAN))
}
