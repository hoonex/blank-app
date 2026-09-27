package io.github.hoonex.flow

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
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
    private lateinit var motionDir: File

    @Before
    fun prepare() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        context = instrumentation.targetContext
        device = UiDevice.getInstance(instrumentation)
        motionDir = File(context.getExternalFilesDir(null), "motion-proof").apply {
            deleteRecursively()
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
    fun everyTimeSheetActuallySlidesUpInPixels() {
        ActivityScenario.launch(MainActivity::class.java).use {
            assertTrue(
                "university home did not appear",
                device.wait(Until.hasObject(By.textContains("Flow 모션대학교")), 6_000)
            )
            val connect = device.wait(Until.findObject(By.text("에브리타임 연결")), 5_000)
                ?: error("connect button missing")
            val bounds = connect.visibleBounds
            device.click(bounds.centerX(), bounds.centerY())

            Thread.sleep(60)
            val earlyFile = File(motionDir, "sheet-early.png")
            assertTrue("failed to capture early animation frame", device.takeScreenshot(earlyFile))

            Thread.sleep(360)
            val settledFile = File(motionDir, "sheet-settled.png")
            assertTrue("failed to capture settled animation frame", device.takeScreenshot(settledFile))

            val early = BitmapFactory.decodeFile(earlyFile.absolutePath)
            val settled = BitmapFactory.decodeFile(settledFile.absolutePath)
            try {
                val earlyTop = findSheetSurfaceTop(early)
                val settledTop = findSheetSurfaceTop(settled)
                assertTrue(
                    "could not locate sheet surface in screenshots: early=$earlyTop settled=$settledTop",
                    earlyTop >= 0 && settledTop >= 0
                )
                assertTrue(
                    "sheet did not travel upward in rendered pixels: early=$earlyTop settled=$settledTop",
                    earlyTop - settledTop >= 20
                )
            } finally {
                early.recycle()
                settled.recycle()
            }

            assertTrue(
                "sheet did not settle with close action",
                device.wait(Until.hasObject(By.text("닫기")), 2_000)
            )
        }
    }

    private fun findSheetSurfaceTop(bitmap: Bitmap): Int {
        if (bitmap.width < 20 || bitmap.height < 180) return -1
        val x = minOf(8, bitmap.width - 1)
        val sampleY = (bitmap.height - 90).coerceAtLeast(bitmap.height / 2)
        val target = bitmap.getPixel(x, sampleY)
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
