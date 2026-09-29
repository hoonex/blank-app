package io.github.hoonex.flow.data

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime

class FlowPlannerTaskTest {
    @Test
    fun plannerStatsSeparateTodayUpcomingDoneAndOverdue() {
        val now = LocalDateTime.of(2026, 9, 14, 10, 0)
        val tasks = listOf(
            FlowTask(id = "overdue", title = "지난 과제", dueAt = "2026-09-14T09:00:00", kind = FlowTaskKind.ASSIGNMENT),
            FlowTask(id = "today", title = "오늘 시험", dueAt = "2026-09-14T18:00:00", kind = FlowTaskKind.EXAM),
            FlowTask(id = "soon", title = "내일 할 일", dueAt = "2026-09-15T13:00:00"),
            FlowTask(id = "later", title = "나중 일정", dueAt = "2026-09-30T13:00:00"),
            FlowTask(id = "done", title = "완료", dueAt = "2026-09-14T08:00:00", done = true)
        )

        val stats = tasks.plannerStats(now)
        assertEquals(2, stats.today)
        assertEquals(3, stats.nextSevenDays)
        assertEquals(1, stats.completed)
        assertEquals(1, stats.overdue)
    }

    @Test
    fun plannerSortsOpenBeforeDoneThenByDeadline() {
        val tasks = listOf(
            FlowTask(id = "done", title = "완료", dueAt = "2026-09-14T08:00:00", done = true),
            FlowTask(id = "late", title = "늦음", dueAt = "2026-09-16T08:00:00"),
            FlowTask(id = "early", title = "빠름", dueAt = "2026-09-15T08:00:00")
        )

        assertEquals(listOf("early", "late", "done"), tasks.sortedPlannerTasks().map { it.id })
    }
    @Test
    fun activeForDayIncludesFlowAndMatchingAcademicScopeOnly() {
        val date = LocalDate.of(2026, 9, 29)
        val tasks = listOf(
            FlowTask(id = "flow", title = "공통", dueAt = "2026-09-29T08:00:00", scope = FlowTaskScope.FLOW),
            FlowTask(id = "school", title = "학교", dueAt = "2026-09-29T09:00:00", scope = FlowTaskScope.SCHOOL),
            FlowTask(id = "university", title = "대학", dueAt = "2026-09-29T10:00:00", scope = FlowTaskScope.UNIVERSITY),
            FlowTask(id = "done", title = "완료", dueAt = "2026-09-29T11:00:00", scope = FlowTaskScope.SCHOOL, done = true),
            FlowTask(id = "tomorrow", title = "내일", dueAt = "2026-09-30T08:00:00", scope = FlowTaskScope.FLOW)
        )

        assertEquals(listOf("flow", "school"), tasks.activeForDay(date, FlowTaskScope.SCHOOL).map { it.id })
        assertEquals(listOf("flow", "university"), tasks.activeForDay(date, FlowTaskScope.UNIVERSITY).map { it.id })
    }
    @Test
    fun dueWithinGapIncludesOnlyTasksWhoseDeadlineFallsInsideGap() {
        val date = LocalDate.of(2026, 9, 29)
        val tasks = listOf(
            FlowTask(id = "before", title = "수업 직후 전", dueAt = "2026-09-29T10:00:00", scope = FlowTaskScope.FLOW),
            FlowTask(id = "inside", title = "공강 중", dueAt = "2026-09-29T11:30:00", scope = FlowTaskScope.UNIVERSITY),
            FlowTask(id = "edge", title = "공강 끝", dueAt = "2026-09-29T13:00:00", scope = FlowTaskScope.FLOW),
            FlowTask(id = "other", title = "학교 일정", dueAt = "2026-09-29T12:00:00", scope = FlowTaskScope.SCHOOL),
            FlowTask(id = "after", title = "공강 뒤", dueAt = "2026-09-29T14:00:00", scope = FlowTaskScope.UNIVERSITY)
        )

        assertEquals(
            listOf("inside", "edge"),
            tasks.dueWithinGap(date, FlowTaskScope.UNIVERSITY, 615, 780).map { it.id }
        )
        assertEquals(
            listOf("edge"),
            tasks.dueWithinGap(date, FlowTaskScope.UNIVERSITY, 615, 780, nowMinutes = 720).map { it.id }
        )
    }

}

