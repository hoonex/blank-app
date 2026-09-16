package io.github.hoonex.flow

import android.content.Context
import android.content.Intent
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import io.github.hoonex.flow.data.FlowSchool
import io.github.hoonex.flow.data.SchoolDashboard
import io.github.hoonex.flow.data.SchoolSelection
import io.github.hoonex.flow.data.SchoolStore
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.data.schoolDate8
import io.github.hoonex.flow.ui.FlowMode
import io.github.hoonex.flow.ui.FlowModeStore
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FlowRecreationStateTest {
    private lateinit var context: Context
    private lateinit var device: UiDevice

    @Before
    fun prepare() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        context = instrumentation.targetContext
        device = UiDevice.getInstance(instrumentation)
        clearState()
        device.setOrientationNatural()
    }

    @After
    fun restore() {
        clearState()
        runCatching { device.setOrientationNatural() }
    }

    @Test
    fun plannerDestinationSurvivesActivityRecreation() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            waitForText("학교도, 대학도")
            scrollUntilText("과제 · 시험")
            clickText("과제 · 시험")
            waitForText("Planner")

            scenario.recreate()

            waitForText("Planner")
            assertTrue("Planner destination fell back to the hub", !device.hasObject(By.textContains("학교도, 대학도")))
        }
    }

    @Test
    fun schoolTabSurvivesActivityRecreation() {
        seedSchool()
        FlowModeStore(context).save(FlowMode.SCHOOL)

        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            waitForText("정동고등학교")
            clickText("시간표")
            waitForText("주간 시간표")

            scenario.recreate()

            waitForText("주간 시간표")
        }
    }

    @Test
    fun backFromSecondarySchoolTabReturnsToTodayBeforeHub() {
        seedSchool()
        FlowModeStore(context).save(FlowMode.SCHOOL)

        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("정동고등학교")
            clickText("시간표")
            waitForText("주간 시간표")

            assertTrue("System back was rejected on the secondary tab", device.pressBack())
            waitForText("오늘 시간표")

            assertTrue("System back was rejected on the primary tab", device.pressBack())
            waitForText("학교도, 대학도")
        }
    }

    @Test
    fun launcherShortcutsSwitchExistingTaskWithoutRestoredDestination() {
        seedSchool()
        FlowModeStore(context).save(FlowMode.SCHOOL)

        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("정동고등학교")

            openShortcut(MainActivity.ACTION_OPEN_UNIVERSITY)
            waitForText("대학 생활을")

            openShortcut(MainActivity.ACTION_OPEN_SCHOOL)
            waitForText("정동고등학교")
        }
    }

    private fun seedSchool() {
        val today = schoolDate8()
        val school = FlowSchool(
            officeCode = "D10",
            officeName = "대구광역시교육청",
            schoolCode = "7240000",
            name = "정동고등학교",
            englishName = "Jeongdong High School",
            kind = "고등학교",
            location = "대구광역시",
            type = "사립",
            address = "대구광역시 동구 정동로 1",
            phone = "053-000-0000",
            coed = "남녀공학",
            highSchoolType = "일반고"
        )
        val selection = SchoolSelection(school, "2", "6")
        val dashboard = SchoolDashboard(
            school = school,
            selected = today,
            from = today,
            to = today,
            timetable = emptyList(),
            meals = emptyList(),
            events = emptyList()
        )
        SchoolStore(context).saveSelection(selection)
        SchoolStore(context).saveDashboard(dashboard)
    }

    private fun clearState() {
        SchoolStore(context).clear()
        UniversityStore(context).clear()
        context.getSharedPreferences("flow-native-shell-v1", Context.MODE_PRIVATE).edit().clear().commit()
    }

    private fun openShortcut(action: String) {
        context.startActivity(
            Intent(context, MainActivity::class.java)
                .setAction(action)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        )
        device.waitForIdle()
    }

    private fun clickText(label: String) {
        val node = device.wait(Until.findObject(By.text(label)), 5_000) ?: error("Could not find text: $label")
        val bounds = node.visibleBounds
        assertTrue("Text is not visibly clickable: $label", bounds.width() > 0 && bounds.height() > 0)
        assertTrue("UiDevice rejected click for: $label", device.click(bounds.centerX(), bounds.centerY()))
        device.waitForIdle()
    }

    private fun scrollUntilText(text: String) {
        val selector = By.textContains(text)
        val x = device.displayWidth / 2
        val startY = minOf((device.displayHeight * 0.72f).toInt(), device.displayHeight - 120)
        val endY = maxOf((device.displayHeight * 0.24f).toInt(), 100)
        val safeBottom = (device.displayHeight * 0.84f).toInt()
        repeat(10) {
            val node = device.findObject(selector)
            if (node != null && node.visibleBounds.centerY() in 1 until safeBottom) {
                device.waitForIdle()
                return
            }
            device.swipe(x, startY, x, endY, 24)
            device.waitForIdle()
        }
        val node = device.findObject(selector)
        assertTrue("Timed out scrolling to text: $text", node != null && node.visibleBounds.centerY() in 1 until safeBottom)
    }

    private fun waitForText(text: String) {
        assertTrue("Timed out waiting for text containing: $text", device.wait(Until.hasObject(By.textContains(text)), 5_000))
        device.waitForIdle()
    }
}
