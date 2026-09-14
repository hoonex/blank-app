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
import io.github.hoonex.flow.ui.FlowAppearance
import io.github.hoonex.flow.ui.FlowThemeMode
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
        SchoolStore(context).clear()
        UniversityStore(context).clear()
        context.getSharedPreferences("flow-native-shell-v1", Context.MODE_PRIVATE).edit().clear().commit()
        FlowAppearance.set(context, FlowThemeMode.LIGHT)
        device.setOrientationNatural()
    }

    @After
    fun restore() {
        FlowAppearance.set(context, FlowThemeMode.DARK)
    }

    @Test
    fun captureLightHub() {
        ActivityScenario.launch(MainActivity::class.java).use {
            assertTrue("light hub did not show School", device.wait(Until.hasObject(By.text("Flow School")), 5_000))
            assertTrue("light hub did not show University", device.wait(Until.hasObject(By.text("Flow University")), 5_000))
            assertTrue("light appearance indicator missing", device.wait(Until.hasObject(By.text("LIGHT")), 5_000))
            device.waitForIdle()
            val file = File(screenshotDir, "20-flow-hub-light.png")
            assertTrue("UiDevice failed to capture light hub", device.takeScreenshot(file))
            val bitmap = BitmapFactory.decodeFile(file.absolutePath)
            assertNotNull("could not decode light hub screenshot", bitmap)
            assertTrue("light hub screenshot dimensions invalid", bitmap.width >= 300 && bitmap.height >= 300)
            bitmap.recycle()
        }
    }
}
