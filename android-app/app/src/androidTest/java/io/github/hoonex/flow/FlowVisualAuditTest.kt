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
import io.github.hoonex.flow.data.Subject
import io.github.hoonex.flow.data.Timetable
import io.github.hoonex.flow.data.University
import io.github.hoonex.flow.data.UniversityMajor
import io.github.hoonex.flow.data.UniversityMetric
import io.github.hoonex.flow.data.UniversityProfile
import io.github.hoonex.flow.data.UniversityStore
import org.junit.After
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

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
        UniversityStore(context).clear()
        device.setOrientationNatural()
    }

    @After
    fun restore() {
        runCatching { device.setOrientationNatural() }
        UniversityStore(context).clear()
    }

    @Test
    fun captureCoreNativeSurfaces() {
        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("대학 찾기")
            capture("01-setup-custom-input")
        }

        seedRepresentativeUniversity()

        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("정동대학교")
            capture("02-home-dashboard")

            scrollUntilText("시간표 다시 동기화")
            clickText("시간표 다시 동기화")
            waitForText("시간표 연결")
            capture("03-everytime-sheet")
            clickText("닫기")

            clickTab("시간표")
            waitForText("2026년 2학기")
            capture("04-schedule-portrait")

            clickTab("학교")
            waitForText("공시 지표")
            capture("05-school-profile")

            clickTab("설정")
            waitForText("고정 알림 켜기")
            capture("06-settings-portrait")

            clickTab("홈")
            waitForText("정동대학교")
            device.setOrientationLeft()
            waitForText("정동대학교")
            device.waitForIdle()
            capture("07-home-landscape")

            clickTab("시간표")
            waitForText("2026년 2학기")
            capture("08-schedule-landscape")
        }

        val captures = screenshotDir.listFiles { file -> file.extension == "png" }.orEmpty()
        assertTrue("expected eight visual-audit screenshots, found ${captures.size}", captures.size == 8)
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
                            CourseTime(
                                day = day,
                                startMinutes = 540,
                                endMinutes = 615,
                                start = "09:00",
                                end = "10:15",
                                place = "공학관 301"
                            )
                        }
                    ),
                    Subject(
                        id = "data-structures",
                        name = "자료구조",
                        professor = "박교수",
                        place = "IT관 204",
                        credit = 3.0,
                        times = (0..4).map { day ->
                            CourseTime(
                                day = day,
                                startMinutes = 780,
                                endMinutes = 855,
                                start = "13:00",
                                end = "14:15",
                                place = "IT관 204"
                            )
                        }
                    )
                )
            )
        )
    }

    private fun clickTab(label: String) = clickText(label)

    private fun clickText(label: String) {
        val textNode = device.wait(Until.findObject(By.text(label)), 5_000)
            ?: error("Could not find text: $label")
        var target = textNode
        while (!target.isClickable) {
            target = target.parent ?: error("Could not resolve clickable parent for: $label")
        }
        target.click()
        device.waitForIdle()
    }

    private fun scrollUntilText(text: String) {
        repeat(6) {
            if (device.hasObject(By.text(text))) return
            val x = device.displayWidth / 2
            device.swipe(x, (device.displayHeight * 0.78f).toInt(), x, (device.displayHeight * 0.32f).toInt(), 18)
            device.waitForIdle()
        }
        assertTrue("Timed out scrolling for text: $text", device.hasObject(By.text(text)))
    }

    private fun waitForText(text: String) {
        assertTrue("Timed out waiting for text: $text", device.wait(Until.hasObject(By.text(text)), 5_000))
        device.waitForIdle()
    }

    private fun capture(name: String) {
        device.waitForIdle()
        val file = File(screenshotDir, "$name.png")
        assertTrue("UiDevice failed to capture ${file.name}", device.takeScreenshot(file))
    }
}
