package io.github.hoonex.flow

import android.content.Context
import android.graphics.BitmapFactory
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import io.github.hoonex.flow.widget.FlowWidgetGalleryActivity
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class FlowWidgetGalleryVisualTest {
    private lateinit var context: Context
    private lateinit var device: UiDevice
    private lateinit var screenshotDir: File

    @Before
    fun prepare() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        context = instrumentation.targetContext
        device = UiDevice.getInstance(instrumentation)
        screenshotDir = File(context.getExternalFilesDir(null), "visual-audit").apply { mkdirs() }
        device.setOrientationNatural()
    }

    @Test
    fun captureWidgetManager() {
        ActivityScenario.launch(FlowWidgetGalleryActivity::class.java).use {
            assertTrue(
                "widget manager title not visible",
                device.wait(Until.hasObject(By.textContains("Flow 위젯")), 5_000)
            )
            assertTrue(
                "installed-widget empty state not visible",
                device.wait(Until.hasObject(By.textContains("아직 설치된 위젯이 없어요")), 5_000)
            )
            device.waitForIdle()
            val file = File(screenshotDir, "17-widget-manager.png")
            assertTrue("UiDevice failed to capture widget manager", device.takeScreenshot(file))
            val bitmap = BitmapFactory.decodeFile(file.absolutePath)
            assertNotNull("could not decode widget manager screenshot", bitmap)
            assertTrue("widget manager screenshot dimensions invalid", bitmap.width >= 300 && bitmap.height >= 300)
            bitmap.recycle()
        }
    }
}
