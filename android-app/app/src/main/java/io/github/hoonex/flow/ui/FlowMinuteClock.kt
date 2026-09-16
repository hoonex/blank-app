package io.github.hoonex.flow.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.LocalDateTime

/**
 * Keeps time-sensitive Flow surfaces aligned to minute boundaries without running
 * a permanent global ticker. The loop only runs while the owning screen is at
 * least STARTED and is cancelled automatically when that composition leaves.
 */
@Composable
internal fun rememberFlowMinuteNow(): LocalDateTime {
    val lifecycleOwner = LocalLifecycleOwner.current
    var now by remember { mutableStateOf(LocalDateTime.now()) }

    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                val current = LocalDateTime.now()
                now = current
                delay(flowMillisUntilNextMinute(current))
            }
        }
    }

    return now
}

internal fun flowMillisUntilNextMinute(now: LocalDateTime): Long {
    val nextMinute = now.withSecond(0).withNano(0).plusMinutes(1)
    return Duration.between(now, nextMinute).toMillis().coerceAtLeast(1L)
}
