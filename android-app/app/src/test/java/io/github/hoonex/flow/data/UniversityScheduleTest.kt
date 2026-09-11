package io.github.hoonex.flow.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDateTime

class UniversityScheduleTest {
    private val timetable = Timetable(
        year = 2026,
        semester = "2",
        subjects = listOf(
            Subject("a", "자료구조", credit = 3.0, times = listOf(CourseTime(0, 540, 600, "09:00", "10:00"))),
            Subject("b", "운영체제", credit = 3.0, times = listOf(CourseTime(0, 660, 720, "11:00", "12:00")))
        )
    )

    @Test fun resolvesCurrentAndNextClass() {
        val moment = timetable.classMoment(LocalDateTime.of(2026, 9, 7, 9, 30))
        assertEquals("자료구조", moment.current?.subject?.name)
        assertEquals("운영체제", moment.next?.subject?.name)
    }

    @Test fun resolvesNextBeforeFirstClass() {
        val moment = timetable.classMoment(LocalDateTime.of(2026, 9, 7, 8, 30))
        assertNull(moment.current)
        assertEquals("자료구조", moment.next?.subject?.name)
    }

    @Test fun resolvesNextGapForDashboard() {
        val gap = timetable.nextGap(LocalDateTime.of(2026, 9, 7, 9, 30))
        assertEquals(600, gap?.startMinutes)
        assertEquals(660, gap?.endMinutes)
        assertEquals(60, gap?.durationMinutes)
    }

    @Test fun totalsCreditsAndWeeklyMinutes() {
        assertEquals(6.0, timetable.totalCredits(), 0.0)
        assertEquals(120, timetable.weeklyMinutes())
    }

    @Test fun resolvesNextSurfaceBoundary() {
        assertEquals(
            LocalDateTime.of(2026, 9, 7, 9, 0),
            timetable.nextBoundary(LocalDateTime.of(2026, 9, 7, 8, 30))
        )
        assertEquals(
            LocalDateTime.of(2026, 9, 7, 10, 0),
            timetable.nextBoundary(LocalDateTime.of(2026, 9, 7, 9, 0))
        )
    }

    @Test fun wrapsBoundaryToNextWeek() {
        assertEquals(
            LocalDateTime.of(2026, 9, 14, 9, 0),
            timetable.nextBoundary(LocalDateTime.of(2026, 9, 7, 12, 0))
        )
    }
}
