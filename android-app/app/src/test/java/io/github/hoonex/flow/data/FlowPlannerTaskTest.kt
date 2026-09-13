package io.github.hoonex.flow.data

import org.junit.Assert.assertEquals
import org.junit.Test
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
}
