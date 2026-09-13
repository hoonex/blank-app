package io.github.hoonex.flow

import android.content.Context
import android.content.Intent
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import io.github.hoonex.flow.data.CampusLecturePlace
import io.github.hoonex.flow.data.CampusNearby
import io.github.hoonex.flow.data.CampusPlace
import io.github.hoonex.flow.data.CampusSnapshot
import io.github.hoonex.flow.data.CampusStore
import io.github.hoonex.flow.data.University
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.ui.FlowCampusActivity
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class FlowCampusMapVisualTest {
    private lateinit var context: Context
    private lateinit var device: UiDevice
    private lateinit var screenshotDir: File
    private val universityId = "visual-campus-map"

    @Before
    fun prepare() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        context = instrumentation.targetContext
        device = UiDevice.getInstance(instrumentation)
        screenshotDir = File(context.getExternalFilesDir(null), "visual-audit").apply { mkdirs() }
        seedCampus()
        device.setOrientationNatural()
    }

    @After
    fun cleanup() {
        UniversityStore(context).clear()
        CampusStore(context).clear(universityId)
        runCatching { device.setOrientationNatural() }
    }

    @Test
    fun captureInteractiveNativeCampusMap() {
        val intent = Intent(context, FlowCampusActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ActivityScenario.launch<FlowCampusActivity>(intent).use {
            assertTrue("campus header missing", device.wait(Until.hasObject(By.textContains("캠퍼스 지도")), 5_000))
            assertTrue("native map evidence missing", device.wait(Until.hasObject(By.textContains("MapLibre · OpenFreeMap")), 8_000))
            Thread.sleep(5_000)
            device.waitForIdle()
            val file = File(screenshotDir, "16-native-campus-map.png")
            assertTrue("failed to capture native campus map", device.takeScreenshot(file))
            assertTrue("native campus screenshot is empty", file.length() > 10_000)
        }
    }

    private fun seedCampus() {
        UniversityStore(context).apply {
            clear()
            saveUniversity(
                University(
                    id = universityId,
                    name = "Flow 테스트대학교",
                    region = "대구",
                    foundation = "사립",
                    campus = "본교",
                    address = "대구광역시 중구 국채보상로"
                )
            )
        }

        val center = CampusPlace(
            id = "center",
            name = "Flow 테스트대학교",
            address = "대구광역시 중구 국채보상로",
            roadAddress = "대구광역시 중구 국채보상로",
            category = "학교",
            phone = "",
            x = "128.60145",
            y = "35.87143",
            distance = 0
        )
        val engineering = CampusPlace(
            id = "engineering",
            name = "공학관",
            address = "",
            roadAddress = "",
            category = "강의실",
            phone = "",
            x = "128.60305",
            y = "35.87215",
            distance = 180
        )
        val cafe = CampusPlace(
            id = "cafe",
            name = "Flow Cafe",
            address = "",
            roadAddress = "",
            category = "카페",
            phone = "",
            x = "128.59995",
            y = "35.87080",
            distance = 210
        )
        val store = CampusPlace(
            id = "store",
            name = "Campus Store",
            address = "",
            roadAddress = "",
            category = "편의점",
            phone = "",
            x = "128.60210",
            y = "35.87055",
            distance = 160
        )
        val dining = CampusPlace(
            id = "dining",
            name = "학생식당",
            address = "",
            roadAddress = "",
            category = "학식",
            phone = "",
            x = "128.60075",
            y = "35.87235",
            distance = 140
        )

        CampusStore(context).save(
            universityId,
            CampusSnapshot(
                center = center,
                places = listOf(CampusLecturePlace("공학관 301", true, 96, engineering)),
                nearby = CampusNearby(
                    stores = listOf(store),
                    cafes = listOf(cafe),
                    food = emptyList(),
                    dining = listOf(dining)
                )
            )
        )
    }
}
