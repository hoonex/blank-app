package io.github.hoonex.flow

import android.os.SystemClock
import androidx.test.uiautomator.UiDevice
import org.junit.Assert.assertTrue

internal fun UiDevice.setNaturalPortraitAndWait(timeoutMs: Long = 4_000L) {
    setOrientationNatural()
    val deadline = SystemClock.uptimeMillis() + timeoutMs
    while (SystemClock.uptimeMillis() < deadline) {
        waitForIdle()
        if (displayHeight >= displayWidth) return
        SystemClock.sleep(100)
    }
    assertTrue(
        "Device did not settle in portrait after natural-orientation request: ${displayWidth}x${displayHeight}",
        displayHeight >= displayWidth
    )
}
