package io.github.hoonex.flow.ui

import android.app.Activity
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.hoonex.flow.data.CampusNearby
import io.github.hoonex.flow.data.CampusPlace
import io.github.hoonex.flow.data.CampusSnapshot
import io.github.hoonex.flow.data.CampusWalkRoute
import io.github.hoonex.flow.data.UniversityCampusApi
import io.github.hoonex.flow.data.UniversityStore
import kotlinx.coroutines.launch

class FlowCampusActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        )
        setContent { FlowTheme { FlowCampusScreen() } }
    }
}

@Composable
private fun FlowCampusScreen() {
    val context = LocalContext.current
    val activity = context as? Activity
    val store = remember { UniversityStore(context) }
    val university = remember { store.loadUniversity() }
    val timetable = remember { store.loadTimetable() }
    var snapshot by remember { mutableStateOf<CampusSnapshot?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    var route by remember { mutableStateOf<Pair<CampusPlace, CampusWalkRoute?>?>(null) }
    var routeLoading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun load() {
        val school = university ?: return
        loading = true
        error = ""
        scope.launch {
            runCatching { UniversityCampusApi.load(school, timetable) }
                .onSuccess { snapshot = it }
                .onFailure { error = it.message ?: "캠퍼스 데이터를 불러오지 못했습니다." }
            loading = false
        }
    }

    LaunchedEffect(university?.id) { if (university != null) load() else loading = false }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(FlowPalette.Background).statusBarsPadding(),
        contentPadding = PaddingValues(20.dp, 18.dp, 20.dp, 34.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "‹",
                    color = FlowPalette.Mint,
                    fontSize = 34.sp,
                    modifier = Modifier.clickable { activity?.finish() }.padding(end = 12.dp)
                )
                Column(Modifier.weight(1f)) {
                    Text("캠퍼스", color = FlowPalette.Text, fontSize = 29.sp, fontWeight = FontWeight.Black)
                    Text(university?.name ?: "Flow University", color = FlowPalette.Muted, fontSize = 12.sp)
                }
                FlowBrand(compact = true)
            }
        }

        if (university == null) {
            item { NativeStateCard("대학을 먼저 선택하세요.", "Flow University에서 학교를 선택한 뒤 캠퍼스를 열 수 있습니다.") }
        } else if (loading && snapshot == null) {
            item {
                FlowCard(Modifier.fillMaxWidth(), accent = true) {
                    Row(Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.height(20.dp), color = FlowPalette.Mint, strokeWidth = 2.dp)
                        Text("캠퍼스 좌표와 주변 시설을 찾는 중…", color = FlowPalette.Muted, fontSize = 13.sp, modifier = Modifier.padding(start = 12.dp))
                    }
                }
            }
        }

        if (error.isNotBlank()) {
            item { NativeStateCard("캠퍼스 데이터를 불러오지 못했습니다.", error) }
            item { FlowSecondaryButton("다시 시도", ::load, Modifier.fillMaxWidth()) }
        }

        snapshot?.let { campus ->
            item {
                FlowCard(Modifier.fillMaxWidth(), accent = true) {
                    Column(Modifier.fillMaxWidth().padding(20.dp)) {
                        Text("CAMPUS CENTER", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
                        Text(campus.center.name.ifBlank { university?.name.orEmpty() }, color = FlowPalette.Text, fontSize = 23.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 7.dp))
                        Text(
                            campus.center.roadAddress.ifBlank { campus.center.address }.ifBlank { university?.address.orEmpty() },
                            color = FlowPalette.Muted,
                            fontSize = 12.sp,
                            lineHeight = 18.sp,
                            modifier = Modifier.padding(top = 5.dp)
                        )
                        val resolved = campus.places.count { it.resolved && it.place != null }
                        Text("강의 장소 $resolved/${campus.places.size} · 학식 ${campus.nearby.dining.size} · 카페 ${campus.nearby.cafes.size}", color = FlowPalette.Mint, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
                    }
                }
            }

            if (campus.places.isNotEmpty()) {
                item { FlowSectionTitle("CLASSES", "강의 장소", "탭해서 도보 경로") }
                items(campus.places, key = { "${it.raw}-${it.place?.id}" }) { lecture ->
                    val place = lecture.place
                    FlowCard(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = if (lecture.resolved && place != null) ({
                            routeLoading = true
                            route = place to null
                            scope.launch {
                                val result = runCatching { UniversityCampusApi.walk(campus.center, place) }.getOrNull()
                                route = place to result
                                routeLoading = false
                            }
                        }) else null
                    ) {
                        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(lecture.raw, color = FlowPalette.Text, fontSize = 15.sp, fontWeight = FontWeight.Black)
                                Text(
                                    place?.name ?: "위치 확인 필요",
                                    color = if (lecture.resolved) FlowPalette.Mint else FlowPalette.Dim,
                                    fontSize = 11.sp,
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            }
                            Text(if (lecture.resolved) "${lecture.confidence}%  ›" else "—", color = FlowPalette.Muted, fontSize = 11.sp)
                        }
                    }
                }
            }

            route?.let { (place, walk) ->
                item {
                    FlowCard(Modifier.fillMaxWidth(), accent = true) {
                        Column(Modifier.fillMaxWidth().padding(18.dp)) {
                            Text("WALK", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black)
                            Text("${campus.center.name} → ${place.name}", color = FlowPalette.Text, fontSize = 17.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 6.dp))
                            Text(
                                when {
                                    routeLoading -> "도보 경로 계산 중…"
                                    walk?.status == "OK" -> "약 ${walk.timeSeconds / 60}분 · ${walk.distance}m"
                                    else -> "도보 경로를 찾지 못했습니다."
                                },
                                color = FlowPalette.Muted,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(top = 5.dp)
                            )
                        }
                    }
                }
            }

            campusSection("DINING", "학식 · 구내식당", campus.nearby.dining)
            campusSection("CAFE", "카페", campus.nearby.cafes)
            campusSection("STORE", "편의점", campus.nearby.stores)
            campusSection("FOOD", "주변 식당", campus.nearby.food)
        }
    }
}

private fun androidx.compose.foundation.lazy.LazyListScope.campusSection(kicker: String, title: String, places: List<CampusPlace>) {
    if (places.isEmpty()) return
    item { FlowSectionTitle(kicker, title, "${places.size}곳") }
    items(places.take(6), key = { "$kicker-${it.id}-${it.name}" }) { place ->
        FlowCard(Modifier.fillMaxWidth()) {
            Column(Modifier.fillMaxWidth().padding(15.dp)) {
                Text(place.name, color = FlowPalette.Text, fontSize = 15.sp, fontWeight = FontWeight.Black)
                Text(
                    listOf(place.roadAddress.ifBlank { place.address }, place.phone).filter(String::isNotBlank).joinToString(" · "),
                    color = FlowPalette.Muted,
                    fontSize = 11.sp,
                    lineHeight = 16.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
                if (place.distance > 0) Text("캠퍼스 중심에서 ${place.distance}m", color = FlowPalette.Mint, fontSize = 10.sp, modifier = Modifier.padding(top = 5.dp))
            }
        }
    }
}

@Composable
private fun NativeStateCard(title: String, detail: String) {
    FlowCard(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(18.dp)) {
            Text(title, color = FlowPalette.Text, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Text(detail, color = FlowPalette.Muted, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 5.dp))
        }
    }
}
