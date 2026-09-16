package io.github.hoonex.flow

import android.content.Context
import android.content.Intent
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
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FlowShortcutNavigationTest {
    private lateinit var context: Context
    private lateinit var device: UiDevice

    @Before
    fun prepare() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        context = instrumentation.targetContext
        device = UiDevice.getInstance(instrumentation)
        clearState()
        seedSchool()
        device.setOrientationNatural()
    }

    @After
    fun restore() {
        device.pressHome()
        clearState()
        runCatching { device.setOrientationNatural() }
    }

    @Test
    fun launcherShortcutsSwitchExistingTaskWithoutRestoredDestination() {
        context.startActivity(
            Intent(context, MainActivity::class.java)
                .setAction(MainActivity.ACTION_OPEN_SCHOOL)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        )
        waitForText("정동고등학교")

        openShortcut(MainActivity.ACTION_OPEN_UNIVERSITY)
        waitForText("대학 생활을")

        openShortcut(MainActivity.ACTION_OPEN_SCHOOL)
        waitForText("정동고등학교")
    }

    private fun openShortcut(action: String) {
        context.startActivity(
            Intent(context, MainActivity::class.java)
                .setAction(action)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        )
        device.waitForIdle()
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

    private fun waitForText(text: String) {
        assertTrue("Timed out waiting for text containing: $text", device.wait(Until.hasObject(By.textContains(text)), 8_000))
        device.waitForIdle()
    }
}
