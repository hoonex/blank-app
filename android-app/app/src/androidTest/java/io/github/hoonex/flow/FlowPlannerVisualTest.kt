package io.github.hoonex.flow

import android.content.Context
import android.graphics.BitmapFactory
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import io.github.hoonex.flow.data.FlowPlannerStore
import io.github.hoonex.flow.data.FlowTask
import io.github.hoonex.flow.data.FlowTaskKind
import io.github.hoonex.flow.data.FlowTaskScope
import org.junit.After
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.time.LocalDateTime

@RunWith(AndroidJUnit4::class)
class FlowPlannerVisualTest {
    private lateinit var context: Context
    private lateinit var device: UiDevice
    private lateinit var screenshotDir: File
    private lateinit var store: FlowPlannerStore

    @Before
    fun prepare() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        context = instrumentation.targetContext
        device = UiDevice.getInstance(instrumentation)
        screenshotDir = File(context.getExternalFilesDir(null), "visual-audit").apply { mkdirs() }
        store = FlowPlannerStore(context)
        store.clear()
        context.getSharedPreferences("flow-native-shell-v1", Context.MODE_PRIVATE).edit().clear().commit()
        val now = LocalDateTime.now()
        store.save(
            listOf(
                FlowTask(
                    id = "planner-assignment",
                    title = "영어 수행평가 제출",
                    note = "최종 원고 점검",
                    dueAt = now.toLocalDate().atTime(18, 0).toString(),
                    kind = FlowTaskKind.ASSIGNMENT,
                    scope = FlowTaskScope.SCHOOL
                ),
                FlowTask(
                    id = "planner-exam",
                    title = "자료구조 퀴즈",
                    note = "스택 · 큐 복습",
                    dueAt = now.plusDays(2).toLocalDate().atTime(13, 0).toString(),
                    kind = FlowTaskKind.EXAM,
                    scope = FlowTaskScope.UNIVERSITY
                )
            )
        )
        device.setOrientationNatural()
    }

    @After
    fun restore() {
        store.clear()
        context.getSharedPreferences("flow-native-shell-v1", Context.MODE_PRIVATE).edit().clear().commit()
        runCatching { device.setOrientationNatural() }
    }

    @Test
    fun capturePlannerAndAddSheet() {
        ActivityScenario.launch(MainActivity::class.java).use {
            assertTrue("Flow hub missing", device.wait(Until.hasObject(By.text("과제 · 시험 · 할 일")), 5_000))
            clickText("과제 · 시험 · 할 일")
            assertTrue("planner title missing", device.wait(Until.hasObject(By.text("Planner")), 5_000))
            assertTrue("seeded assignment missing", device.wait(Until.hasObject(By.text("영어 수행평가 제출")), 5_000))
            capture("18-planner")

            clickText("새 일정 추가")
            assertTrue("planner add sheet missing", device.wait(Until.hasObject(By.text("일정 추가")), 5_000))
            assertTrue("planner title input missing", device.wait(Until.hasObject(By.textContains("과제 · 시험 · 할 일 제목")), 5_000))
            capture("19-planner-add")
        }
    }

    private fun clickText(text: String) {
        val node = device.wait(Until.findObject(By.text(text)), 5_000) ?: error("Could not find text: $text")
        val bounds = node.visibleBounds
        assertTrue("text not visible: $text", bounds.width() > 0 && bounds.height() > 0)
        assertTrue("click rejected: $text", device.click(bounds.centerX(), bounds.centerY()))
        device.waitForIdle()
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
