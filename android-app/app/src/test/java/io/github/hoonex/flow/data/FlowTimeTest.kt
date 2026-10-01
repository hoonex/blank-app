package io.github.hoonex.flow.data

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.TimeZone

class FlowTimeTest {
    @Test
    fun academicEpochConversionIgnoresSystemDefaultZone() {
        val previous = TimeZone.getDefault()
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles"))
            val local = LocalDateTime.of(2026, 9, 30, 9, 0)
            val expected = local.atZone(ZoneId.of("Asia/Seoul")).toInstant().toEpochMilli()

            assertEquals(expected, local.toAcademicEpochMillis())
        } finally {
            TimeZone.setDefault(previous)
        }
    }
    @Test
    fun nextAcademicMidnightRollsToNextDate() {
        val now = LocalDateTime.of(2026, 9, 30, 23, 59)

        assertEquals(LocalDateTime.of(2026, 10, 1, 0, 0), nextAcademicMidnight(now))
    }

}
