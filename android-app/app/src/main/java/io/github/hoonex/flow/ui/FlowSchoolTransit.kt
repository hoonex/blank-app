package io.github.hoonex.flow.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.core.content.ContextCompat
import io.github.hoonex.flow.data.FlowLocation
import io.github.hoonex.flow.data.GeoPoint
import io.github.hoonex.flow.data.SchoolSelection
import io.github.hoonex.flow.data.TransitApi
import io.github.hoonex.flow.data.TransitDestination
import io.github.hoonex.flow.data.TransitRoute
import io.github.hoonex.flow.data.TransitRouteBundle
import kotlinx.coroutines.launch
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

@Composable
fun FlowSchoolTransitScreen(selection: SchoolSelection) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val schoolAddress = remember(selection) {
        listOf(selection.school.address, selection.school.addressDetail).filter(String::isNotBlank).joinToString(" ")
            .ifBlank { selection.school.name }
    }
    var query by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf<TransitDestination?>(null) }
    var suggestions by remember { mutableStateOf<List<TransitDestination>>(emptyList()) }
    var source by remember { mutableStateOf<GeoPoint?>(null) }
    var routes by remember { mutableStateOf<TransitRouteBundle?>(null) }
    var loading by remember { mutableStateOf(false) }
    var searching by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var pendingRoute by remember { mutableStateOf(false) }

    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    fun loadRoutes(point: GeoPoint) {
        loading = true
        error = ""
        scope.launch {
            val destinationQuery = selected?.name ?: query.trim().ifBlank { schoolAddress }
            runCatching { TransitApi.route(point, destinationQuery, selected) }
                .onSuccess { routes = it }
                .onFailure { error = it.message ?: "교통 경로를 불러오지 못했습니다." }
            loading = false
        }
    }

    fun resolveLocationAndRoute() {
        loading = true
        error = ""
        scope.launch {
            val point = runCatching { FlowLocation.current(context) }.getOrNull()
            if (point == null) {
                error = "현재 위치를 확인하지 못했습니다. 위치 서비스를 켜고 다시 시도하세요."
                loading = false
            } else {
                source = point
                loadRoutes(point)
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        val granted = result[Manifest.permission.ACCESS_COARSE_LOCATION] == true || result[Manifest.permission.ACCESS_FINE_LOCATION] == true
        if (granted && pendingRoute) resolveLocationAndRoute()
        else if (pendingRoute) error = "교통 경로 검색에는 현재 위치 권한이 필요합니다."
        pendingRoute = false
    }

    fun routeNow() {
        routes = null
        if (hasPermission()) resolveLocationAndRoute()
        else {
            pendingRoute = true
            permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION))
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp, 28.dp, 20.dp, 34.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            FlowSectionTitle("TRANSIT", "교통", "대구 버스 · 지하철")
            Text("웹페이지 없이 현재 위치와 서버의 실시간 대중교통 JSON을 앱에서 직접 비교합니다.", color = FlowPalette.Muted, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(top = 6.dp))
        }
        item {
            FlowCard(Modifier.fillMaxWidth(), accent = true) {
                Column(Modifier.fillMaxWidth().padding(18.dp)) {
                    Text("출발", color = FlowPalette.Dim, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text(if (source == null) "현재 위치" else "현재 위치 확인됨", color = FlowPalette.Text, fontSize = 16.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 3.dp))
                    Text("도착", color = FlowPalette.Dim, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 14.dp))
                    Text(selected?.name ?: if (query.isBlank()) selection.school.name else query, color = FlowPalette.Text, fontSize = 18.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 3.dp))
                    Text(selected?.address ?: if (query.isBlank()) schoolAddress else "장소 검색 후 실제 위치를 선택할 수 있습니다.", color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 3.dp))
                }
            }
        }
        item {
            FlowTextField(
                value = query,
                onValueChange = {
                    query = it
                    selected = null
                    suggestions = emptyList()
                },
                placeholder = "다른 목적지 검색 (예: 동대구역)",
                modifier = Modifier.fillMaxWidth(),
                leading = "⌕"
            )
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                FlowSecondaryButton(
                    text = if (searching) "검색 중…" else "장소 검색",
                    onClick = {
                        if (query.trim().length < 2 || searching) return@FlowSecondaryButton
                        searching = true
                        error = ""
                        scope.launch {
                            runCatching { TransitApi.searchDestinations(query, source) }
                                .onSuccess { suggestions = it }
                                .onFailure { error = it.message ?: "목적지를 검색하지 못했습니다." }
                            searching = false
                        }
                    },
                    modifier = Modifier.weight(1f)
                )
                FlowSecondaryButton(
                    text = "학교로",
                    onClick = {
                        query = ""
                        selected = null
                        suggestions = emptyList()
                        routes = null
                    },
                    modifier = Modifier.weight(1f)
                )
            }
        }
        if (suggestions.isNotEmpty()) {
            item { FlowSectionTitle("PLACES", "실제 장소", "${suggestions.size}개") }
            items(suggestions, key = { it.id }) { place ->
                FlowCard(
                    modifier = Modifier.fillMaxWidth(),
                    accent = selected?.id == place.id,
                    onClick = {
                        selected = place
                        query = place.name
                        suggestions = emptyList()
                        routes = null
                    }
                ) {
                    Column(Modifier.fillMaxWidth().padding(15.dp)) {
                        Text(place.name, color = FlowPalette.Text, fontSize = 15.sp, fontWeight = FontWeight.Black)
                        Text(listOf(place.category, place.address).filter(String::isNotBlank).joinToString(" · "), color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 4.dp))
                        place.distanceMeters?.let { Text(distanceText(it), color = FlowPalette.Mint, fontSize = 10.sp, modifier = Modifier.padding(top = 4.dp)) }
                    }
                }
            }
        }
        item {
            FlowPrimaryButton(
                text = if (loading) "경로 계산 중…" else if (selected == null && query.isBlank()) "학교까지 경로 찾기" else "이 목적지까지 경로 찾기",
                onClick = ::routeNow,
                enabled = !loading,
                modifier = Modifier.fillMaxWidth()
            )
        }
        if (error.isNotBlank()) {
            item {
                FlowCard(Modifier.fillMaxWidth()) {
                    Text(error, color = FlowPalette.Danger, fontSize = 12.sp, lineHeight = 18.sp, modifier = Modifier.padding(16.dp))
                }
            }
        }
        routes?.let { bundle ->
            item {
                FlowSectionTitle(
                    "ROUTES",
                    bundle.destination?.name ?: selected?.name ?: selection.school.name,
                    if (bundle.realtimeCoverage == "none") "예상 경로" else "실시간 반영"
                )
            }
            if (bundle.routes.isEmpty()) {
                item { NativeTransitState("조건에 맞는 대중교통 경로가 없습니다.", bundle.busError.ifBlank { bundle.mixedError }) }
            } else {
                items(bundle.routes, key = { it.id }) { route -> TransitRouteCard(route) }
            }
        }
        item {
            Text("현재 교통 경로 서비스 범위는 대구광역시 내부입니다. 위치는 경로 요청 시에만 사용하며 앱에 저장하지 않습니다.", color = FlowPalette.Dim, fontSize = 10.sp, lineHeight = 15.sp)
        }
    }
}

@Composable
private fun TransitRouteCard(route: TransitRoute) {
    FlowCard(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(17.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    val badge = route.badges.firstOrNull() ?: "경로"
                    Text(badge.uppercase(), color = FlowPalette.Mint, fontSize = 9.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                    Text("${route.totalMinutes}분", color = FlowPalette.Text, fontSize = 25.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 4.dp))
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("환승 ${route.transfers}회", color = FlowPalette.Muted, fontSize = 11.sp)
                    Text("도보 ${route.walkMeters}m", color = FlowPalette.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
                    if (route.payment > 0) Text("${route.payment}원", color = FlowPalette.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
                }
            }
            route.segments.forEachIndexed { index, segment ->
                val line = segment.lines.joinToString(" · ").ifBlank { if (segment.type == "walk") "도보" else if (segment.type == "bus") "버스" else "지하철" }
                Text(
                    "${index + 1}. $line · ${segment.minutes}분" +
                        if (segment.startName.isNotBlank() || segment.endName.isNotBlank()) " · ${segment.startName.ifBlank { "승차" }} → ${segment.endName.ifBlank { "하차" }}" else "",
                    color = if (index == 0) FlowPalette.Text else FlowPalette.Muted,
                    fontSize = 11.sp,
                    lineHeight = 17.sp,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
            if (route.arrivalAt.isNotBlank()) {
                Text("예상 도착 ${arrivalClock(route.arrivalAt)}", color = FlowPalette.Mint, fontSize = 10.sp, modifier = Modifier.padding(top = 10.dp))
            }
        }
    }
}

@Composable
private fun NativeTransitState(title: String, detail: String) {
    FlowCard(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(17.dp)) {
            Text(title, color = FlowPalette.Text, fontWeight = FontWeight.Black, fontSize = 15.sp)
            if (detail.isNotBlank()) Text(detail, color = FlowPalette.Muted, fontSize = 11.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 5.dp))
        }
    }
}

private fun distanceText(meters: Int): String = if (meters < 1000) "현재 위치에서 약 ${meters}m" else "현재 위치에서 약 ${"%.1f".format(meters / 1000.0)}km"

private fun arrivalClock(value: String): String = runCatching {
    OffsetDateTime.parse(value).format(DateTimeFormatter.ofPattern("HH:mm"))
}.getOrDefault("—")
