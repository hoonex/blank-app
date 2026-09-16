package io.github.hoonex.flow

import android.content.Context
import android.graphics.BitmapFactory
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import io.github.hoonex.flow.data.SchoolStore
import io.github.hoonex.flow.data.UniversityStore
import org.junit.After
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class FlowThemeVisualTest {
    private lateinit var context: Context
    private lateinit var device: UiDevice
    private lateinit var screenshotDir: File

    @Before
    fun prepare() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        context = instrumentation.targetContext
        device = UiDevice.getInstance(instrumentation)
        screenshotDir = File(context.getExternalFilesDir(null), "visual-audit").apply { mkdirs() }
        clearState()
        device.setOrientationNatural()
    }

    @After
    fun restore() {
        runCatching { device.executeShellCommand("cmd uimode night auto") }
        runCatching { device.setOrientationNatural() }
        clearState()
    }

    @Test
    fun captureDarkHubAndUniversitySetup() {
        device.executeShellCommand("cmd uimode night yes")
        device.waitForIdle()
        Thread.sleep(700)

        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("학교도, 대학도")
            capture("20-flow-hub-dark")
            clickTextAndWaitForText("대학 찾기 · Flow University", "대학 찾기")
            capture("21-university-setup-dark")
        }
    }

    private fun clearState() {
        UniversityStore(context).clear()
        SchoolStore(context).clear()
        context.getSharedPreferences("flow-native-shell-v1", Context.MODE_PRIVATE).edit().clear().commit()
    }

    private fun waitForText(text: String) {
        assertTrue("Timed out waiting for text: $text", device.wait(Until.hasObject(By.textContains(text)), 7_000))
        device.waitForIdle()
    }

    private fun clickTextAndWaitForText(label: String, expected: String) {
        val node = device.wait(Until.findObject(By.text(label)), 5_000) ?: error("Could not find text: $label")
        val bounds = node.visibleBounds
        assertTrue("text not visible: $label", bounds.width() > 0 && bounds.height() > 0)
        device.click(bounds.centerX(), bounds.centerY())
        waitForText(expected)
    }

    private fun capture(name: String) {
        device.waitForIdle()
        val file = File(screenshotDir, "$name.png")
        assertTrue("screenshot failed: ${file.name}", device.takeScreenshot(file))
        val bitmap = BitmapFactory.decodeFile(file.absolutePath)
        assertNotNull("could not decode ${file.name}", bitmap)
        assertTrue("invalid screenshot size", bitmap.width >= 300 && bitmap.height >= 300)
        bitmap.recycle()
    }
}
