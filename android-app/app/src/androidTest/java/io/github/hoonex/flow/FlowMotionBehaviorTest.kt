package io.github.hoonex.flow

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import io.github.hoonex.flow.data.SchoolStore
import io.github.hoonex.flow.data.University
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.ui.FlowMode
import io.github.hoonex.flow.ui.FlowModeStore
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import kotlin.math.abs

@RunWith(AndroidJUnit4::class)
class FlowMotionBehaviorTest {
    private lateinit var context: Context
    private lateinit var device: UiDevice
    private lateinit var instrumentation: android.app.Instrumentation
    private lateinit var motionDir: File

    @Before
    fun prepare() {
        instrumentation = InstrumentationRegistry.getInstrumentation()
        context = instrumentation.targetContext
        device = UiDevice.getInstance(instrumentation)
        motionDir = File(context.getExternalFilesDir(null), "motion-proof").apply {
            mkdirs()
        }
        SchoolStore(context).clear()
        UniversityStore(context).apply {
            clear()
            saveUniversity(
                University(
                    id = "motion-university",
                    name = "Flow 모션대학교",
                    region = "대구",
                    foundation = "사립",
                    campus = "본교",
                    address = "대구광역시 Flow로 1"
                )
            )
        }
        FlowModeStore(context).save(FlowMode.UNIVERSITY)
        device.setOrientationNatural()
    }

    @After
    fun cleanup() {
        SchoolStore(context).clear()
        UniversityStore(context).clear()
        context.getSharedPreferences("flow-native-shell-v1", Context.MODE_PRIVATE).edit().clear().commit()
        runCatching { device.setOrientationNatural() }
    }

    @Test
    fun bottomNavigationIndicatorActuallySlidesInPixels() {
        ActivityScenario.launch(MainActivity::class.java).use {
            assertTrue(
                "university home did not appear",
                device.wait(Until.hasObject(By.textContains("Flow 모션대학교")), 6_000)
            )

            val beforeFile = File(motionDir, "nav-before.png")
            assertTrue("failed to capture nav before frame", device.takeScreenshot(beforeFile))

            val scheduleNodes = device.findObjects(By.text("시간표"))
            val scheduleTab = scheduleNodes.maxByOrNull { it.visibleBounds.centerY() } ?: error("schedule tab missing")
            val bounds = scheduleTab.visibleBounds
            // Inject without UiDevice's accessibility-idle synchronization. Waiting for
            // accessibility idle here can consume the entire 340 ms animation before
            // the first framebuffer sample is taken.
            val eventTime = SystemClock.uptimeMillis()
            val down = MotionEvent.obtain(eventTime, eventTime, MotionEvent.ACTION_DOWN, bounds.centerX().toFloat(), bounds.centerY().toFloat(), 0).apply {
                source = InputDevice.SOURCE_TOUCHSCREEN
            }
            val up = MotionEvent.obtain(eventTime, eventTime + 18, MotionEvent.ACTION_UP, bounds.centerX().toFloat(), bounds.centerY().toFloat(), 0).apply {
                source = InputDevice.SOURCE_TOUCHSCREEN
            }
            try {
                assertTrue("failed to inject nav down", instrumentation.uiAutomation.injectInputEvent(down, false))
                Thread.sleep(18)
                assertTrue("failed to inject nav up", instrumentation.uiAutomation.injectInputEvent(up, false))
            } finally {
                down.recycle()
                up.recycle()
            }

            val candidates = buildList {
                repeat(16) { index ->
                    Thread.sleep(12)
                    val bitmap = instrumentation.uiAutomation.takeScreenshot()
                        ?: error("failed to capture raw nav candidate frame $index")
                    add(bitmap)
                }
            }

            Thread.sleep(180)
            val settledFile = File(motionDir, "nav-settled.png")
            assertTrue("failed to capture nav settled frame", device.takeScreenshot(settledFile))

            val before = BitmapFactory.decodeFile(beforeFile.absolutePath)
            val settled = BitmapFactory.decodeFile(settledFile.absolutePath)
            try {
                val beforeX = accentCentroidX(before)
                val settledX = accentCentroidX(settled)
                assertTrue(
                    "could not locate nav accent: before=$beforeX settled=$settledX",
                    beforeX >= 0 && settledX >= 0
                )
                val minimumTravel = (device.displayWidth / 6).coerceAtLeast(40)
                assertTrue(
                    "nav selection did not move one tab width: before=$beforeX settled=$settledX minimum=$minimumTravel",
                    settledX - beforeX >= minimumTravel
                )

                val midCandidate = candidates.firstOrNull { bitmap ->
                    val x = accentCentroidX(bitmap)
                    x > beforeX + 6 && x < settledX - 6
                }
                assertTrue(
                    "nav selection had no rendered intermediate frame between $beforeX and $settledX",
                    midCandidate != null
                )
                val midFile = File(motionDir, "nav-mid.png")
                midFile.outputStream().use { stream ->
                    assertTrue(
                        "failed to persist nav mid frame",
                        midCandidate!!.compress(Bitmap.CompressFormat.PNG, 100, stream)
                    )
                }
            } finally {
                before.recycle()
                settled.recycle()
                candidates.forEach(Bitmap::recycle)
            }
        }
    }

    @Test
    fun everyTimeSheetActuallySlidesUpInPixels() {
        ActivityScenario.launch(MainActivity::class.java).use {
            assertTrue(
                "university home did not appear",
                device.wait(Until.hasObject(By.textContains("Flow 모션대학교")), 6_000)
            )
            val connect = device.wait(Until.findObject(By.text("시간표 연결")), 5_000)
                ?: error("timetable connect button missing")
            val bounds = connect.visibleBounds
            val eventTime = SystemClock.uptimeMillis()
            val down = MotionEvent.obtain(eventTime, eventTime, MotionEvent.ACTION_DOWN, bounds.centerX().toFloat(), bounds.centerY().toFloat(), 0).apply {
                source = InputDevice.SOURCE_TOUCHSCREEN
            }
            val up = MotionEvent.obtain(eventTime, eventTime + 18, MotionEvent.ACTION_UP, bounds.centerX().toFloat(), bounds.centerY().toFloat(), 0).apply {
                source = InputDevice.SOURCE_TOUCHSCREEN
            }
            try {
                assertTrue("failed to inject sheet down", instrumentation.uiAutomation.injectInputEvent(down, false))
                Thread.sleep(18)
                assertTrue("failed to inject sheet up", instrumentation.uiAutomation.injectInputEvent(up, false))
            } finally {
                down.recycle()
                up.recycle()
            }

            val candidates = buildList {
                repeat(18) { index ->
                    Thread.sleep(16)
                    val bitmap = instrumentation.uiAutomation.takeScreenshot()
                        ?: error("failed to capture raw sheet candidate frame $index")
                    add(bitmap)
                }
            }

            Thread.sleep(180)
            val settledFile = File(motionDir, "sheet-settled.png")
            assertTrue("failed to capture settled animation frame", device.takeScreenshot(settledFile))

            val settled = BitmapFactory.decodeFile(settledFile.absolutePath)
            try {
                val sheetColor = sheetSurfaceSample(settled)
                val settledTop = findSheetSurfaceTop(settled, sheetColor)
                assertTrue("could not locate settled sheet surface: $settledTop", settledTop >= 0)

                val earlyCandidate = candidates.firstOrNull { bitmap ->
                    val top = findSheetSurfaceTop(bitmap, sheetColor)
                    top >= 0 && top - settledTop >= 20
                }
                assertTrue(
                    "sheet had no rendered intermediate frame before settledTop=$settledTop",
                    earlyCandidate != null
                )
                val earlyFile = File(motionDir, "sheet-early.png")
                earlyFile.outputStream().use { stream ->
                    assertTrue(
                        "failed to persist sheet early frame",
                        earlyCandidate!!.compress(Bitmap.CompressFormat.PNG, 100, stream)
                    )
                }
            } finally {
                settled.recycle()
                candidates.forEach(Bitmap::recycle)
            }

            assertTrue(
                "sheet did not settle with close action",
                device.wait(Until.hasObject(By.text("닫기")), 2_000)
            )
            val close = device.findObject(By.text("닫기")) ?: error("close action missing after settle")
            assertTrue(
                "sheet close action overlaps system navigation: bottom=${close.visibleBounds.bottom} display=${device.displayHeight}",
                close.visibleBounds.bottom <= device.displayHeight - 24
            )
        }
    }

    private fun accentCentroidX(bitmap: Bitmap): Int {
        if (bitmap.width < 20 || bitmap.height < 180) return -1
        val startY = (bitmap.height * .80f).toInt()
        val endY = (bitmap.height - 28).coerceAtLeast(startY + 1)
        var sumX = 0L
        var count = 0L
        for (y in startY until endY) {
            for (x in 0 until bitmap.width) {
                val pixel = bitmap.getPixel(x, y)
                val r = Color.red(pixel)
                val g = Color.green(pixel)
                val b = Color.blue(pixel)
                if (b >= 72 && b - r >= 14 && b - g >= 9) {
                    sumX += x
                    count++
                }
            }
        }
        return if (count >= 20) (sumX / count).toInt() else -1
    }

    private fun sheetSurfaceSample(bitmap: Bitmap): Int {
        val x = minOf(8, bitmap.width - 1)
        val sampleY = (bitmap.height - 90).coerceAtLeast(bitmap.height / 2)
        return bitmap.getPixel(x, sampleY)
    }

    private fun findSheetSurfaceTop(bitmap: Bitmap, target: Int): Int {
        if (bitmap.width < 20 || bitmap.height < 180) return -1
        val x = minOf(8, bitmap.width - 1)
        val run = 14

        for (y in 0 until bitmap.height - run) {
            var matches = true
            for (offset in 0 until run) {
                if (colorDistance(bitmap.getPixel(x, y + offset), target) > 24) {
                    matches = false
                    break
                }
            }
            if (matches) return y
        }
        return -1
    }

    private fun colorDistance(a: Int, b: Int): Int =
        abs(Color.red(a) - Color.red(b)) +
            abs(Color.green(a) - Color.green(b)) +
            abs(Color.blue(a) - Color.blue(b))
}
