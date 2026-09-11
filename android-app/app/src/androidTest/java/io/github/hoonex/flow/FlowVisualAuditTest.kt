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
            capture("01-setup-portrait")
        }

        seedRepresentativeUniversity()

        ActivityScenario.launch(MainActivity::class.java).use {
            waitForText("정동대학교")
            capture("02-today-portrait")

            clickTab("시간표")
            waitForText("2026년 2학기")
            capture("03-week-portrait")

            clickTab("설정")
            waitForText("고정 알림 켜기")
            capture("04-settings-portrait")

            clickTab("오늘")
            waitForText("정동대학교")
            device.setOrientationLeft()
            waitForText("정동대학교")
            device.waitForIdle()
            capture("05-today-landscape")

            clickTab("시간표")
            waitForText("2026년 2학기")
            capture("06-week-landscape")
        }

        val captures = screenshotDir.listFiles { file -> file.extension == "png" }.orEmpty()
        assertTrue("expected six visual-audit screenshots, found ${captures.size}", captures.size == 6)
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
        store.saveUniversity(
            University(
                id = "visual-audit-university",
                name = "정동대학교",
                region = "대구",
                foundation = "사립",
                campus = "본교",
                address = "대구광역시"
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

    private fun clickTab(label: String) {
        val textNode = device.wait(Until.findObject(By.text(label)), 5_000)
            ?: error("Could not find bottom tab label: $label")
        var target = textNode
        while (!target.isClickable) {
            target = target.parent
                ?: error("Could not resolve clickable parent for bottom tab: $label")
        }
        target.click()
        device.waitForIdle()
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
