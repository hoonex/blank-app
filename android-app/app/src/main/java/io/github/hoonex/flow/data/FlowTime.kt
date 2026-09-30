package io.github.hoonex.flow.data

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Flow's school and university sources describe Korean campus-local dates and
 * class times. Keep academic time independent from CI/host/device timezone so a
 * device travelling abroad still evaluates a Korean timetable on Korean time.
 */
internal val FlowAcademicZone: ZoneId = ZoneId.of("Asia/Seoul")

internal fun flowAcademicNow(): LocalDateTime =
    LocalDateTime.now(FlowAcademicZone)

internal fun flowAcademicToday(): LocalDate =
    LocalDate.now(FlowAcademicZone)

internal fun LocalDateTime.toAcademicEpochMillis(): Long =
    atZone(FlowAcademicZone).toInstant().toEpochMilli()
