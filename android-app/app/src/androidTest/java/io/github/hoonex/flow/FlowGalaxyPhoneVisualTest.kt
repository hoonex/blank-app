package io.github.hoonex.flow

import android.content.Context
import android.graphics.BitmapFactory
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import io.github.hoonex.flow.data.CourseTime
import io.github.hoonex.flow.data.FlowPlannerStore
import io.github.hoonex.flow.data.FlowSchool
import io.github.hoonex.flow.data.FlowTask
import io.github.hoonex.flow.data.FlowTaskKind
import io.github.hoonex.flow.data.FlowTaskScope
import io.github.hoonex.flow.data.SchoolDashboard
import io.github.hoonex.flow.data.SchoolEvent
import io.github.hoonex.flow.data.SchoolMeal
import io.github.hoonex.flow.data.SchoolPeriod
import io.github.hoonex.flow.data.SchoolSelection
import io.github.hoonex.flow.data.SchoolStore
import io.github.hoonex.flow.data.Subject
import io.github.hoonex.flow.data.Timetable
import io.github.hoonex.flow.data.University
import io.github.hoonex.flow.data.UniversityMajor
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.data.schoolDate8
import io.github.hoonex.flow.ui.FlowMode
import io.github.hoonex.flow.ui.FlowModeStore
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime

@RunWith(AndroidJUnit4::class)
class FlowGalaxyPhoneVisualTest {
    private lateinit var context: Context
    private lateinit var device: UiDevice
    private lateinit var screenshotDir: File

    @Before
    fun prepare() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        context = instrumentation.targetContext
        device = UiDevice.getInstance(instrumentation)
        screenshotDir = File(context.getExternalFilesDir(null), "visual-audit/galaxy-s25").apply {
            deleteRecursively()
            mkdirs()
        }
        clearState()
        device.setOrientationNatural()

        assertEquals("Galaxy profile width override missing", 1080, device.displayWidth)
        assertTrue(
            "Galaxy profile usable height is unexpectedly short: ${device.displayHeight}px",
            device.displayHeight >= 1800
        )
        assertTrue(
            "Galaxy profile should remain a tall phone surface: ${device.displayWidth}x${device.displayHeight}",
            device.displayHeight.toFloat() / device.displayWidth >= 1.7f
        )
        assertTrue(
            "Galaxy profile should expose a narrow phone Compose width, got ${context.resources.configuration.screenWidthDp}dp",
            context.resources.configuration.screenWidthDp in 350..370
        )
    }

    @After
    fun restore() {
        clearState()
        runCatching { device.setOrientationNatural() }
    }

    @Test
    fun captureGalaxyS25LikeCoreSurfacesAndReachability() {
        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("학교도, 대학도")
            capture("22-galaxy-s25-hub")
        }

        seedRepresentativeUniversity()
        FlowModeStore(context).save(FlowMode.UNIVERSITY)
        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("정동대학교")
            capture("23-galaxy-s25-university-home")
            scrollUntilText("시간표 다시 동기화")
            assertAboveBottomNavigation("시간표 다시 동기화", "홈")
        }

        seedRepresentativeSchool()
        FlowModeStore(context).save(FlowMode.SCHOOL)
        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("정동고등학교")
            capture("24-galaxy-s25-school-today")
            scrollUntilText("데이터 새로고침")
            assertAboveBottomNavigation("데이터 새로고침", "오늘")
            clickTextAndWaitForText("설정", "데이터와 모드")
            capture("25-galaxy-s25-school-settings")
            assertTrue("primary manage action missing", device.hasObject(By.textContains("학교 데이터 새로고침")))
        }

        clearState()
        seedPlanner()
        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("학교도, 대학도")
            scrollUntilText("과제 · 시험")
            clickTextAndWaitForText("과제 · 시험", "Planner")
            waitForText("영어 수행평가 제출")
            capture("26-galaxy-s25-planner")
        }

        val captures = screenshotDir.listFiles { file -> file.extension == "png" }.orEmpty()
        assertEquals("expected five Galaxy-profile screenshots", 5, captures.size)
        captures.forEach { file ->
            val bitmap = BitmapFactory.decodeFile(file.absolutePath)
            assertNotNull("could not decode screenshot: ${file.name}", bitmap)
            assertEquals("Galaxy screenshot width drifted: ${file.name}", device.displayWidth, bitmap.width)
            assertEquals("Galaxy screenshot height drifted: ${file.name}", device.displayHeight, bitmap.height)
            bitmap.recycle()
        }
    }

    private fun seedRepresentativeSchool() {
        val today = LocalDate.now()
        val todayRaw = schoolDate8(today)
        val tomorrowRaw = schoolDate8(today.plusDays(1))
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
        SchoolStore(context).saveSelection(selection)
        SchoolStore(context).saveDashboard(
            SchoolDashboard(
                school = school,
                selected = todayRaw,
                from = todayRaw,
                to = tomorrowRaw,
                timetable = listOf(
                    SchoolPeriod(todayRaw, 1, "국어", "2", "6"),
                    SchoolPeriod(todayRaw, 2, "수학", "2", "6"),
                    SchoolPeriod(todayRaw, 3, "영어", "2", "6"),
                    SchoolPeriod(todayRaw, 4, "과학", "2", "6"),
                    SchoolPeriod(tomorrowRaw, 1, "한국사", "2", "6"),
                    SchoolPeriod(tomorrowRaw, 2, "정보", "2", "6")
                ),
                meals = listOf(SchoolMeal(todayRaw, "중식", listOf("현미밥", "미역국", "닭갈비", "김치"), "742 kcal")),
                events = listOf(SchoolEvent(todayRaw, "동아리 활동", "창의융합 프로젝트"))
            )
        )
    }

    private fun seedRepresentativeUniversity() {
        val store = UniversityStore(context)
        val university = University(
            id = "galaxy-visual-university",
            name = "정동대학교",
            region = "대구",
            foundation = "사립",
            campus = "본교",
            address = "대구광역시 동구 Flow로 1",
            englishName = "Jeongdong University",
            kind = "대학교",
            division = "대학",
            founded = "20090301",
            phone = "053-000-0000",
            homepage = "https://example.edu"
        )
        store.saveUniversity(university)
        store.saveMajor(
            UniversityMajor(
                id = "software",
                name = "소프트웨어학과",
                college = "IT융합대학",
                degree = "학사",
                duration = "4년",
                category = "컴퓨터·통신"
            )
        )
        store.saveTimetable(
            Timetable(
                year = 2026,
                semester = "2",
                subjects = listOf(
                    Subject(
                        id = "software-design",
                        name = "소프트웨어설계",
                        professor = "김교수",
                        place = "공학관 301",
                        credit = 3.0,
                        times = (0..4).map { day -> CourseTime(day, 540, 615, "09:00", "10:15", "공학관 301") }
                    ),
                    Subject(
                        id = "data-structures",
                        name = "자료구조",
                        professor = "박교수",
                        place = "IT관 204",
                        credit = 3.0,
                        times = (0..4).map { day -> CourseTime(day, 780, 855, "13:00", "14:15", "IT관 204") }
                    )
                )
            )
        )
    }

    private fun seedPlanner() {
        val now = LocalDateTime.now()
        FlowPlannerStore(context).save(
            listOf(
                FlowTask(
                    id = "galaxy-planner-assignment",
                    title = "영어 수행평가 제출",
                    note = "최종 원고 점검",
                    dueAt = now.toLocalDate().atTime(18, 0).toString(),
                    kind = FlowTaskKind.ASSIGNMENT,
                    scope = FlowTaskScope.SCHOOL
                )
            )
        )
    }

    private fun clearState() {
        SchoolStore(context).clear()
        UniversityStore(context).clear()
        FlowPlannerStore(context).clear()
        context.getSharedPreferences("flow-native-shell-v1", Context.MODE_PRIVATE).edit().clear().commit()
    }

    private fun assertAboveBottomNavigation(targetText: String, tabLabel: String) {
        val target = device.findObject(By.textContains(targetText)) ?: error("Missing target text: $targetText")
        val tab = device.findObject(By.text(tabLabel)) ?: error("Missing bottom-navigation tab: $tabLabel")
        assertTrue(
            "$targetText is overlapped by bottom navigation: ${target.visibleBounds} vs ${tab.visibleBounds}",
            target.visibleBounds.bottom < tab.visibleBounds.top
        )
    }

    private fun clickTextAndWaitForText(label: String, expected: String, attempts: Int = 3) {
        repeat(attempts) {
            val node = device.wait(Until.findObject(By.text(label)), 5_000) ?: error("Could not find text: $label")
            val bounds = node.visibleBounds
            assertTrue("text not visible: $label", bounds.width() > 0 && bounds.height() > 0)
            device.waitForIdle()
            Thread.sleep(250)
            device.click(bounds.centerX(), bounds.centerY())
            if (device.wait(Until.hasObject(By.textContains(expected)), 2_000)) {
                device.waitForIdle()
                return
            }
        }
        assertTrue("Timed out after $attempts click attempts: $label -> $expected", device.hasObject(By.textContains(expected)))
    }

    private fun scrollUntilText(text: String) {
        val selector = By.textContains(text)
        val x = device.displayWidth / 2
        val startY = (device.displayHeight * 0.70f).toInt()
        val endY = (device.displayHeight * 0.24f).toInt()
        val safeBottom = (device.displayHeight * 0.78f).toInt()
        repeat(12) {
            val node = device.findObject(selector)
            if (node != null && node.visibleBounds.centerY() in 1 until safeBottom) {
                device.waitForIdle()
                return
            }
            device.swipe(x, startY, x, endY, 28)
            device.waitForIdle()
        }
        val node = device.findObject(selector)
        assertTrue("Timed out positioning text above bottom navigation: $text", node != null && node.visibleBounds.centerY() in 1 until safeBottom)
    }

    private fun waitForText(text: String) {
        assertTrue("Timed out waiting for text containing: $text", device.wait(Until.hasObject(By.textContains(text)), 5_000))
        device.waitForIdle()
    }

    private fun capture(name: String) {
        device.waitForIdle()
        Thread.sleep(350)
        device.waitForIdle()
        val file = File(screenshotDir, "$name.png")
        assertTrue("screenshot failed: ${file.name}", device.takeScreenshot(file))
    }
}
