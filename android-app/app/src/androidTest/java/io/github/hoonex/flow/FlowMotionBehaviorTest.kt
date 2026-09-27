package io.github.hoonex.flow

import android.content.Context
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

@RunWith(AndroidJUnit4::class)
class FlowMotionBehaviorTest {
    private lateinit var context: Context
    private lateinit var device: UiDevice

    @Before
    fun prepare() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        context = instrumentation.targetContext
        device = UiDevice.getInstance(instrumentation)
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
    fun everyTimeSheetActuallySlidesUp() {
        ActivityScenario.launch(MainActivity::class.java).use {
            assertTrue(
                "university home did not appear",
                device.wait(Until.hasObject(By.textContains("Flow 모션대학교")), 6_000)
            )
            val connect = device.wait(Until.findObject(By.text("에브리타임 연결")), 5_000)
                ?: error("connect button missing")
            val bounds = connect.visibleBounds
            device.click(bounds.centerX(), bounds.centerY())

            val sampledTops = mutableListOf<Int>()
            repeat(14) {
                device.findObject(By.text("시간표 연결"))?.visibleBounds?.let { rect ->
                    if (rect.height() > 0) sampledTops += rect.top
                }
                Thread.sleep(28)
            }

            assertTrue(
                "sheet title was not observable during animation: $sampledTops",
                sampledTops.size >= 3
            )
            val travel = sampledTops.maxOrNull()!! - sampledTops.minOrNull()!!
            assertTrue(
                "sheet did not visibly travel upward; sampled tops=$sampledTops",
                travel >= 24
            )
            assertTrue(
                "sheet did not finish above its first observed position; sampled tops=$sampledTops",
                sampledTops.first() > sampledTops.last()
            )

            assertTrue(
                "sheet did not settle with close action",
                device.wait(Until.hasObject(By.text("닫기")), 2_000)
            )
        }
    }
}
