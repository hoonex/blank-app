package io.github.hoonex.flow.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.hoonex.flow.MainActivity
import io.github.hoonex.flow.data.UniversityApi
import io.github.hoonex.flow.data.UniversityStore
import io.github.hoonex.flow.widget.UniversityWidgets

class FlowShareActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        )
        val shared = intent?.takeIf { it.action == Intent.ACTION_SEND }
            ?.getStringExtra(Intent.EXTRA_TEXT)
            .orEmpty()
        val url = extractEverytimeUrl(shared)

        setContent {
            FlowTheme {
                ShareImportScreen(url = url, close = ::finish, openUniversity = ::openUniversity)
            }
        }
    }

    private fun openUniversity() {
        startActivity(Intent(this, MainActivity::class.java).setAction(MainActivity.ACTION_OPEN_UNIVERSITY))
        finish()
    }
}

@Composable
private fun FlowShareActivity.ShareImportScreen(
    url: String?,
    close: () -> Unit,
    openUniversity: () -> Unit
) {
    var state by remember { mutableStateOf(if (url == null) "unsupported" else "loading") }
    var message by remember { mutableStateOf(if (url == null) "에브리타임 공개 공유 링크를 찾지 못했습니다." else "공개 공유 링크에서 시간표를 가져오는 중입니다.") }

    LaunchedEffect(url) {
        if (url == null) return@LaunchedEffect
        runCatching { UniversityApi.importEverytime(url) }
            .onSuccess { timetable ->
                UniversityStore(this@ShareImportScreen).saveTimetable(timetable)
                FlowModeStore(this@ShareImportScreen).save(FlowMode.UNIVERSITY)
                UniversityWidgets.updateAll(this@ShareImportScreen)
                state = "success"
                message = "시간표를 가져왔습니다. Flow University에서 바로 확인할 수 있습니다."
            }
            .onFailure { error ->
                state = "error"
                message = error.message ?: "시간표를 가져오지 못했습니다."
            }
    }

    Column(
        modifier = Modifier.fillMaxSize().background(FlowPalette.Background).statusBarsPadding().navigationBarsPadding().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.Start
    ) {
        Text("EVERYTIME → FLOW", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.3.sp)
        Text(
            when (state) {
                "loading" -> "시간표 가져오는 중"
                "success" -> "가져오기 완료"
                else -> "가져올 수 없음"
            },
            color = FlowPalette.Text,
            fontSize = 28.sp,
            fontWeight = FontWeight.Black,
            modifier = Modifier.padding(top = 8.dp)
        )
        Text(message, color = FlowPalette.Muted, fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 8.dp))
        if (state == "loading") {
            CircularProgressIndicator(color = FlowPalette.Mint, strokeWidth = 2.dp, modifier = Modifier.padding(top = 22.dp))
        } else if (state == "success") {
            FlowPrimaryButton("Flow University 열기", openUniversity, Modifier.fillMaxWidth().padding(top = 22.dp))
        } else {
            FlowPrimaryButton("닫기", close, Modifier.fillMaxWidth().padding(top = 22.dp))
        }
    }
}

private fun extractEverytimeUrl(text: String): String? {
    return Regex("https?://[^\\s]+", RegexOption.IGNORE_CASE)
        .findAll(text)
        .map { it.value.trimEnd('.', ',', ';', ')', ']', '}') }
        .firstOrNull { it.contains("everytime.kr", ignoreCase = true) }
}
