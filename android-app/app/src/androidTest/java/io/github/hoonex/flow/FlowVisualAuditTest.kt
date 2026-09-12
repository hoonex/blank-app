package io.github.hoonex.flow

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import io.github.hoonex.flow.data.CourseTime
import io.github.hoonex.flow.data.FlowSchool
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
import io.github.hoonex.flow.data.UniversityMetric
import io.github.hoonex.flow.data.UniversityProfile
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.data.schoolDate8
import io.github.hoonex.flow.ui.FlowMode
import io.github.hoonex.flow.ui.FlowModeStore
import io.github.hoonex.flow.widget.FlowWidgetConfigActivity
import org.junit.After
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.time.LocalDate

@RunWith(AndroidJUnit4::class)
class FlowVisualAuditTest {
    private lateinit var context: Context
    private lateinit var device: UiDevice
    private lateinit var screenshotDir: File

    @Before
    fun prepare() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        context = instrumentation.targetContext
        device = UiDevice.getInstance(instrumentation)
        screenshotDir = File(context.getExternalFilesDir(null), "visual-audit").apply {
            deleteRecursively()
            mkdirs()
        }
        clearState()
        device.setOrientationNatural()
    }

    @After
    fun restore() {
        runCatching { device.setOrientationNatural() }
        clearState()
    }

    @Test
    fun captureCoreNativeSurfaces() {
        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("학교도, 대학도")
            capture("01-flow-hub")
            clickTextAndWaitForText("대학 찾기 · Flow University", "대학 찾기")
            capture("02-university-setup")
        }

        seedRepresentativeUniversity()
        FlowModeStore(context).save(FlowMode.UNIVERSITY)

        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("정동대학교")
            capture("03-university-home")

            scrollUntilText("시간표 다시 동기화")
            clickTextAndWaitForText("시간표 다시 동기화", "시간표 연결")
            capture("04-everytime-sheet")
            clickTextUntilGone("닫기")

            clickTextAndWaitForText("시간표", "2026년 2학기")
            capture("05-university-schedule")

            clickTextAndWaitForText("학교", "공시 지표")
            capture("06-university-profile")

            clickTextAndWaitForText("설정", "고정 알림 켜기")
            capture("07-university-settings")

            clickTab("홈")
            waitForText("정동대학교")
            device.setOrientationLeft()
            waitForText("정동대학교")
            device.waitForIdle()
            capture("08-university-home-landscape")
            device.setOrientationNatural()
        }

        seedRepresentativeSchool()
        FlowModeStore(context).save(FlowMode.SCHOOL)

        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("정동고등학교")
            capture("09-school-today")

            clickTextAndWaitForText("시간표", "주간 시간표")
            capture("10-school-week")

            clickTextAndWaitForText("교통", "대구 버스")
            capture("11-school-transit")

            clickTextAndWaitForText("학교", "SCHOOL")
            capture("12-school-info")

            clickTextAndWaitForText("설정", "위젯별 설정")
            capture("13-school-settings")
        }

        val widgetIntent = Intent(context, FlowWidgetConfigActivity::class.java)
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 4242)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ActivityScenario.launch<FlowWidgetConfigActivity>(widgetIntent).use {
            waitForText("위젯 설정")
            capture("14-widget-config")
        }

        FlowModeStore(context).save(FlowMode.UNIVERSITY)
        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("정동대학교")
            clickTextAndWaitForText("학교", "네이티브 캠퍼스 열기")
            capture("15-native-campus-entry")
        }

        val captures = screenshotDir.listFiles { file -> file.extension == "png" }.orEmpty()
        assertTrue("expected fifteen visual-audit screenshots, found ${captures.size}", captures.size == 15)
        captures.forEach { file ->
            val bitmap = BitmapFactory.decodeFile(file.absolutePath)
            assertNotNull("could not decode screenshot: ${file.name}", bitmap)
            assertTrue(
                "screenshot dimensions are invalid: ${file.name} ${bitmap.width}x${bitmap.height}",
                bitmap.width >= 300 && bitmap.height >= 300
            )
            bitmap.recycle()
        }
    }

    private fun clearState() {
        UniversityStore(context).clear()
        SchoolStore(context).clear()
        context.getSharedPreferences("flow-native-shell-v1", Context.MODE_PRIVATE).edit().clear().commit()
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
        val periods = listOf(
            SchoolPeriod(todayRaw, 1, "국어", "2", "6"),
            SchoolPeriod(todayRaw, 2, "수학", "2", "6"),
            SchoolPeriod(todayRaw, 3, "영어", "2", "6"),
            SchoolPeriod(todayRaw, 4, "과학", "2", "6"),
            SchoolPeriod(tomorrowRaw, 1, "한국사", "2", "6"),
            SchoolPeriod(tomorrowRaw, 2, "정보", "2", "6")
        )
        val dashboard = SchoolDashboard(
            school = school,
            selected = todayRaw,
            from = todayRaw,
            to = tomorrowRaw,
            timetable = periods,
            meals = listOf(SchoolMeal(todayRaw, "중식", listOf("현미밥", "미역국", "닭갈비", "김치"), "742 kcal")),
            events = listOf(SchoolEvent(todayRaw, "동아리 활동", "창의융합 프로젝트"))
        )
        SchoolStore(context).saveSelection(selection)
        SchoolStore(context).saveDashboard(dashboard)
    }

    private fun seedRepresentativeUniversity() {
        val store = UniversityStore(context)
        val university = University(
            id = "visual-audit-university",
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
        store.saveProfile(
            UniversityProfile(
                school = university,
                tuition = UniversityMetric("2025", 4_120_000.0),
                scholarship = UniversityMetric("2025", 2_030_000.0),
                dormitory = UniversityMetric("2025", 18.4),
                library = UniversityMetric("2025", 12.7)
            )
        )
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
                        times = (0..4).map { day ->
                            CourseTime(day, 540, 615, "09:00", "10:15", "공학관 301")
                        }
                    ),
                    Subject(
                        id = "data-structures",
                        name = "자료구조",
                        professor = "박교수",
                        place = "IT관 204",
                        credit = 3.0,
                        times = (0..4).map { day ->
                            CourseTime(day, 780, 855, "13:00", "14:15", "IT관 204")
                        }
                    )
                )
            )
        )
    }

    private fun clickTab(label: String) = clickText(label)

    private fun clickText(label: String) {
        val textNode = device.wait(Until.findObject(By.text(label)), 5_000) ?: error("Could not find text: $label")
        val bounds = textNode.visibleBounds
        assertTrue("Text is not visibly clickable: $label", bounds.width() > 0 && bounds.height() > 0)
        device.waitForIdle()
        Thread.sleep(200)
        assertTrue("UiDevice rejected click for: $label", device.click(bounds.centerX(), bounds.centerY()))
        device.waitForIdle()
    }

    private fun clickTextAndWaitForText(label: String, expected: String, attempts: Int = 3) {
        repeat(attempts) {
            val textNode = device.wait(Until.findObject(By.text(label)), 5_000) ?: error("Could not find text: $label")
            val bounds = textNode.visibleBounds
            assertTrue("Text is not visibly clickable: $label", bounds.width() > 0 && bounds.height() > 0)
            device.waitForIdle()
            Thread.sleep(250)
            device.click(bounds.centerX(), bounds.centerY())
            if (device.wait(Until.hasObject(By.textContains(expected)), 2_000)) {
                device.waitForIdle()
                return
            }
            device.waitForIdle()
            Thread.sleep(250)
        }
        assertTrue("Timed out after $attempts click attempts: $label -> $expected", device.hasObject(By.textContains(expected)))
    }

    private fun clickTextUntilGone(label: String, attempts: Int = 3) {
        repeat(attempts) {
            val textNode = device.wait(Until.findObject(By.text(label)), 5_000) ?: return
            val bounds = textNode.visibleBounds
            assertTrue("Text is not visibly clickable: $label", bounds.width() > 0 && bounds.height() > 0)
            device.waitForIdle()
            Thread.sleep(200)
            device.click(bounds.centerX(), bounds.centerY())
            if (device.wait(Until.gone(By.text(label)), 2_000)) {
                device.waitForIdle()
                return
            }
        }
        assertTrue("Text did not disappear after $attempts click attempts: $label", !device.hasObject(By.text(label)))
    }

    private fun scrollUntilText(text: String) {
        val selector = By.textContains(text)
        val x = device.displayWidth / 2
        val startY = minOf((device.displayHeight * 0.68f).toInt(), device.displayHeight - 180)
        val endY = maxOf((device.displayHeight * 0.22f).toInt(), 100)
        val safeTextBottom = (device.displayHeight * 0.72f).toInt()
        repeat(12) {
            val node = device.findObject(selector)
            if (node != null && node.visibleBounds.centerY() in 1 until safeTextBottom) {
                device.waitForIdle()
                return
            }
            device.swipe(x, startY, x, endY, 28)
            device.waitForIdle()
        }
        val node = device.findObject(selector)
        assertTrue("Timed out positioning text above bottom navigation: $text", node != null && node.visibleBounds.centerY() in 1 until safeTextBottom)
    }

    private fun waitForText(text: String) {
        assertTrue("Timed out waiting for text containing: $text", device.wait(Until.hasObject(By.textContains(text)), 5_000))
        device.waitForIdle()
    }

    private fun capture(name: String) {
        device.waitForIdle()
        val file = File(screenshotDir, "$name.png")
        assertTrue("UiDevice failed to capture ${file.name}", device.takeScreenshot(file))
    }
}
