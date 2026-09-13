package io.github.hoonex.flow.ui

import android.app.Activity
import android.graphics.Color as AndroidColor
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
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import io.github.hoonex.flow.data.CampusPlace
import io.github.hoonex.flow.data.CampusSnapshot
import io.github.hoonex.flow.data.CampusStore
import io.github.hoonex.flow.data.CampusWalkRoute
import io.github.hoonex.flow.data.UniversityCampusApi
import io.github.hoonex.flow.data.UniversityStore
import kotlinx.coroutines.launch
import org.maplibre.android.MapLibre
import org.maplibre.android.annotations.MarkerOptions
import org.maplibre.android.annotations.PolylineOptions
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView

private const val OPEN_FREE_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty"

class FlowCampusActivity : ComponentActivity() {
    private lateinit var mapView: MapView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MapLibre.getInstance(this)
        mapView = MapView(this)
        mapView.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        )
        setContent { FlowTheme { FlowCampusScreen(mapView) } }
    }

    override fun onStart() { super.onStart(); mapView.onStart() }
    override fun onResume() { super.onResume(); mapView.onResume() }
    override fun onPause() { mapView.onPause(); super.onPause() }
    override fun onStop() { mapView.onStop(); super.onStop() }
    override fun onLowMemory() { super.onLowMemory(); mapView.onLowMemory() }
    override fun onDestroy() { mapView.onDestroy(); super.onDestroy() }
    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); mapView.onSaveInstanceState(outState) }
}

@Composable
private fun FlowCampusScreen(mapView: MapView) {
    val context = LocalContext.current
    val activity = context as? Activity
    val store = remember { UniversityStore(context) }
    val campusStore = remember { CampusStore(context) }
    val university = remember { store.loadUniversity() }
    val timetable = remember { store.loadTimetable() }
    var snapshot by remember(university?.id) { mutableStateOf(university?.id?.let(campusStore::load)) }
    var loading by remember(university?.id) { mutableStateOf(snapshot == null) }
    var error by remember(university?.id) { mutableStateOf("") }
    var route by remember { mutableStateOf<Pair<CampusPlace, CampusWalkRoute?>?>(null) }
    var routeLoading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun selectPlace(campus: CampusSnapshot, place: CampusPlace) {
        routeLoading = true
        route = place to null
        scope.launch {
            val result = runCatching { UniversityCampusApi.walk(campus.center, place) }.getOrNull()
            route = place to result
            routeLoading = false
        }
    }

    fun load() {
        val school = university ?: return
        loading = true
        error = ""
        scope.launch {
            runCatching { UniversityCampusApi.load(school, timetable) }
                .onSuccess {
                    snapshot = it
                    campusStore.save(school.id, it)
                }
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
                    Text("캠퍼스 지도", color = FlowPalette.Text, fontSize = 29.sp, fontWeight = FontWeight.Black)
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
            item { NativeStateCard(if (snapshot == null) "캠퍼스 데이터를 불러오지 못했습니다." else "최신 데이터 갱신 실패", error) }
            item { FlowSecondaryButton("다시 시도", ::load, Modifier.fillMaxWidth()) }
        }

        snapshot?.let { campus ->
            item {
                NativeCampusMap(
                    mapView = mapView,
                    campus = campus,
                    walkRoute = route?.second
                )
            }
            item {
                FlowCard(Modifier.fillMaxWidth(), accent = true) {
                    Column(Modifier.fillMaxWidth().padding(18.dp)) {
                        Text("LIVE MAP", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
                        Text(campus.center.name.ifBlank { university?.name.orEmpty() }, color = FlowPalette.Text, fontSize = 21.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 6.dp))
                        Text(
                            campus.center.roadAddress.ifBlank { campus.center.address }.ifBlank { university?.address.orEmpty() },
                            color = FlowPalette.Muted,
                            fontSize = 12.sp,
                            lineHeight = 18.sp,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                        val resolved = campus.places.count { it.resolved && it.place != null }
                        Text(
                            "강의 $resolved · 학식 ${campus.nearby.dining.size} · 카페 ${campus.nearby.cafes.size} · 편의점 ${campus.nearby.stores.size} · 식당 ${campus.nearby.food.size}",
                            color = FlowPalette.Mint,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 10.dp)
                        )
                    }
                }
            }

            route?.let { (place, walk) ->
                item {
                    FlowCard(Modifier.fillMaxWidth(), accent = true) {
                        Column(Modifier.fillMaxWidth().padding(18.dp)) {
                            Text("WALK ROUTE", color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black)
                            Text("${campus.center.name} → ${place.name}", color = FlowPalette.Text, fontSize = 17.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 6.dp))
                            Text(
                                when {
                                    routeLoading -> "실제 도보 경로 계산 중…"
                                    walk?.status == "OK" -> "약 ${(walk.timeSeconds / 60).coerceAtLeast(1)}분 · ${walk.distance}m · 경로점 ${walk.points.size}개"
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

            if (campus.places.isNotEmpty()) {
                item { FlowSectionTitle("CLASSES", "강의 장소", "탭하면 지도에 도보 경로") }
                items(campus.places, key = { "${it.raw}-${it.place?.id}" }) { lecture ->
                    val place = lecture.place
                    FlowCard(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = if (lecture.resolved && place != null) ({ selectPlace(campus, place) }) else null
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

            campusSection("DINING", "학식 · 구내식당", campus.nearby.dining) { selectPlace(campus, it) }
            campusSection("CAFE", "카페", campus.nearby.cafes) { selectPlace(campus, it) }
            campusSection("STORE", "편의점", campus.nearby.stores) { selectPlace(campus, it) }
            campusSection("FOOD", "주변 식당", campus.nearby.food) { selectPlace(campus, it) }
        }
    }
}

@Composable
private fun NativeCampusMap(
    mapView: MapView,
    campus: CampusSnapshot,
    walkRoute: CampusWalkRoute?
) {
    var map by remember(mapView) { mutableStateOf<MapLibreMap?>(null) }
    var styleReady by remember(mapView) { mutableStateOf(false) }

    Box(
        Modifier
            .fillMaxWidth()
            .height(350.dp)
            .clip(RoundedCornerShape(26.dp))
            .background(FlowPalette.Surface)
    ) {
        AndroidView(
            factory = {
                mapView.apply {
                    getMapAsync { ready ->
                        ready.uiSettings.isCompassEnabled = true
                        ready.uiSettings.isAttributionEnabled = true
                        ready.uiSettings.isLogoEnabled = true
                        ready.setStyle(OPEN_FREE_MAP_STYLE) {
                            map = ready
                            styleReady = true
                        }
                    }
                }
            },
            modifier = Modifier.fillMaxSize()
        )
        if (!styleReady) {
            Row(
                Modifier.align(Alignment.Center).background(Color(0xCC0D1214), RoundedCornerShape(18.dp)).padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                CircularProgressIndicator(Modifier.height(18.dp), color = FlowPalette.Mint, strokeWidth = 2.dp)
                Text("지도 불러오는 중…", color = FlowPalette.Text, fontSize = 12.sp, modifier = Modifier.padding(start = 10.dp))
            }
        }
        Text(
            "MapLibre · OpenFreeMap",
            color = Color.White,
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.align(Alignment.TopStart).padding(10.dp).background(Color(0xAA08100E), RoundedCornerShape(10.dp)).padding(horizontal = 9.dp, vertical = 6.dp)
        )
    }

    LaunchedEffect(map, styleReady, campus, walkRoute) {
        if (styleReady) map?.let { renderCampusMap(it, campus, walkRoute) }
    }
}

@Suppress("DEPRECATION")
private fun renderCampusMap(map: MapLibreMap, campus: CampusSnapshot, walkRoute: CampusWalkRoute?) {
    val center = campus.center.toLatLng() ?: return
    map.clear()
    map.addMarker(
        MarkerOptions()
            .position(center)
            .title(campus.center.name.ifBlank { "캠퍼스 중심" })
            .snippet("Flow · Campus center")
    )

    val seen = mutableSetOf<String>()
    fun addPlace(place: CampusPlace, prefix: String) {
        val point = place.toLatLng() ?: return
        val key = "${point.latitude},${point.longitude}"
        if (!seen.add(key)) return
        map.addMarker(
            MarkerOptions()
                .position(point)
                .title("$prefix · ${place.name}")
                .snippet(place.roadAddress.ifBlank { place.address })
        )
    }

    campus.places.mapNotNull { it.place }.forEach { addPlace(it, "강의") }
    campus.nearby.dining.forEach { addPlace(it, "학식") }
    campus.nearby.cafes.forEach { addPlace(it, "카페") }
    campus.nearby.stores.forEach { addPlace(it, "편의점") }
    campus.nearby.food.forEach { addPlace(it, "식당") }

    val routePoints = walkRoute?.points.orEmpty().map { LatLng(it.latitude, it.longitude) }
    if (routePoints.size >= 2) {
        map.addPolyline(
            PolylineOptions()
                .addAll(routePoints)
                .color(AndroidColor.rgb(123, 231, 214))
                .width(7f)
                .alpha(0.95f)
        )
        map.animateCamera(CameraUpdateFactory.newLatLngZoom(routePoints.last(), 16.4), 500)
    } else {
        map.cameraPosition = CameraPosition.Builder().target(center).zoom(15.6).build()
    }
}

private fun CampusPlace.toLatLng(): LatLng? {
    val lat = latitude ?: return null
    val lng = longitude ?: return null
    if (lat !in -90.0..90.0 || lng !in -180.0..180.0) return null
    return LatLng(lat, lng)
}

private fun androidx.compose.foundation.lazy.LazyListScope.campusSection(
    kicker: String,
    title: String,
    places: List<CampusPlace>,
    onPlace: (CampusPlace) -> Unit
) {
    if (places.isEmpty()) return
    item { FlowSectionTitle(kicker, title, "${places.size}곳 · 탭해서 경로") }
    items(places.take(6), key = { "$kicker-${it.id}-${it.name}" }) { place ->
        FlowCard(Modifier.fillMaxWidth(), onClick = { onPlace(place) }) {
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
