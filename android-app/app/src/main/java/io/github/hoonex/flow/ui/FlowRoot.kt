package io.github.hoonex.flow.ui

import android.content.Context
import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.hoonex.flow.data.SchoolStore
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.widget.FlowWidgetGalleryActivity

enum class FlowMode { SCHOOL, UNIVERSITY }

class FlowModeStore(context: Context) {
    private val prefs = context.getSharedPreferences("flow-native-shell-v1", Context.MODE_PRIVATE)
    fun load(): FlowMode? = prefs.getString("mode", null)?.let { runCatching { FlowMode.valueOf(it) }.getOrNull() }
    fun save(mode: FlowMode) { prefs.edit().putString("mode", mode.name).apply() }
}

@Composable
fun FlowRoot(enablePinnedNotification: () -> Unit, disablePinnedNotification: () -> Unit, checkUpdate: () -> Unit) {
    val context = LocalContext.current
    val store = remember { FlowModeStore(context) }
    val initialMode = remember {
        store.load() ?: when {
            SchoolStore(context).loadSelection() != null -> FlowMode.SCHOOL
            UniversityStore(context).loadUniversity() != null -> FlowMode.UNIVERSITY
            else -> null
        }
    }
    var mode by remember { mutableStateOf(initialMode) }
    fun choose(next: FlowMode) { store.save(next); mode = next }
    BackHandler(enabled = mode != null) { mode = null }

    when (mode) {
        FlowMode.SCHOOL -> FlowSchoolRoot(onSwitchUniversity = { choose(FlowMode.UNIVERSITY) }, checkUpdate = checkUpdate)
        FlowMode.UNIVERSITY -> FlowUniversityNativeRoot(enablePinnedNotification, disablePinnedNotification, checkUpdate)
        null -> FlowHub(
            chooseSchool = { choose(FlowMode.SCHOOL) },
            chooseUniversity = { choose(FlowMode.UNIVERSITY) },
            openWidgets = { context.startActivity(Intent(context, FlowWidgetGalleryActivity::class.java)) }
        )
    }
}

@Composable
private fun FlowHub(chooseSchool: () -> Unit, chooseUniversity: () -> Unit, openWidgets: () -> Unit) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(FlowPalette.Background),
        contentPadding = PaddingValues(22.dp, 48.dp, 22.dp, 42.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            FlowBrand()
            Spacer(Modifier.height(30.dp))
            Text("학교도, 대학도\n하나의 Flow.", color = FlowPalette.Text, fontSize = 38.sp, lineHeight = 42.sp, fontWeight = FontWeight.Black)
            Text("시간표·급식·일정·공시·교통·캠퍼스 데이터를 받아 앱이 직접 화면·캐시·위젯으로 씁니다.", color = FlowPalette.Muted, fontSize = 14.sp, lineHeight = 21.sp, modifier = Modifier.padding(top = 12.dp))
        }
        item {
            FlowCard(modifier = Modifier.fillMaxWidth(), accent = true, onClick = chooseSchool) {
                Column(Modifier.padding(20.dp)) {
                    Text("SCHOOL", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    Text("학교 찾기 · Flow School", color = FlowPalette.Text, fontSize = 24.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 8.dp))
                    Text("오늘 시간표 · 급식 · 학사일정 · 주간 시간표 · 네이티브 교통", color = FlowPalette.Muted, fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 7.dp))
                }
            }
        }
        item {
            FlowCard(modifier = Modifier.fillMaxWidth(), onClick = chooseUniversity) {
                Column(Modifier.padding(20.dp)) {
                    Text("UNIVERSITY", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    Text("대학 찾기 · Flow University", color = FlowPalette.Text, fontSize = 24.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 8.dp))
                    Text("에브리타임 · 공시 · 학과 · 네이티브 캠퍼스 · 위젯 · 알림", color = FlowPalette.Muted, fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 7.dp))
                }
            }
        }
        item {
            FlowCard(modifier = Modifier.fillMaxWidth(), onClick = openWidgets) {
                Column(Modifier.padding(20.dp)) {
                    Text("SURFACES", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black)
                    Text("Flow 위젯 갤러리", color = FlowPalette.Text, fontSize = 21.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 7.dp))
                    Text("다음 흐름 · 오늘 · 주간 · 미니를 앱에서 바로 홈 화면에 추가하고 위젯별로 School/University를 설정합니다.", color = FlowPalette.Muted, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 6.dp))
                }
            }
        }
        item { Text("앱 아이콘을 길게 눌러 School / University / Widgets로 바로 들어갈 수도 있습니다.", color = FlowPalette.Dim, fontSize = 11.sp, lineHeight = 17.sp) }
    }
}
