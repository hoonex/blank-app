package io.github.hoonex.flow.ui

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDateTime

class FlowMinuteClockTest {
    @Test
    fun waitsToTheNextMinuteBoundary() {
        assertEquals(
            60_000L,
            flowMillisUntilNextMinute(LocalDateTime.of(2026, 9, 16, 12, 34, 0))
        )
        assertEquals(
            29_750L,
            flowMillisUntilNextMinute(LocalDateTime.of(2026, 9, 16, 12, 34, 30, 250_000_000))
        )
        assertEquals(
            100L,
            flowMillisUntilNextMinute(LocalDateTime.of(2026, 9, 16, 23, 59, 59, 900_000_000))
        )
    }
}
