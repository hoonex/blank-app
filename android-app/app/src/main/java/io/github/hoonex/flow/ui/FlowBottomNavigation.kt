package io.github.hoonex.flow.ui

import android.view.HapticFeedbackConstants
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.math.abs

@Composable
fun FlowBottomNavigation(
    labels: List<String>,
    selectedIndex: Int,
    onSelected: (Int) -> Unit
) {
    val view = LocalView.current
    val labelsKey = labels.joinToString("|")
    val safeSelectedIndex = selectedIndex.coerceIn(0, (labels.size - 1).coerceAtLeast(0))
    var savedSelectedIndex by rememberSaveable(labelsKey) { mutableIntStateOf(safeSelectedIndex) }
    var restoreChecked by remember(labelsKey) { mutableStateOf(false) }
    val animatedIndex = remember(labelsKey) { Animatable(safeSelectedIndex.toFloat()) }
    val animationScope = rememberCoroutineScope()
    var animationJob by remember(labelsKey) { mutableStateOf<Job?>(null) }

    fun moveTo(index: Int) {
        if (index !in labels.indices) return
        savedSelectedIndex = index
        onSelected(index)
        animationJob?.cancel()
        animationJob = animationScope.launch {
            animatedIndex.animateTo(
                targetValue = index.toFloat(),
                animationSpec = tween(durationMillis = 300, easing = FastOutSlowInEasing)
            )
        }
    }

    LaunchedEffect(labelsKey, safeSelectedIndex) {
        if (labels.isEmpty()) return@LaunchedEffect
        if (!restoreChecked) {
            restoreChecked = true
            if (savedSelectedIndex in labels.indices && savedSelectedIndex != safeSelectedIndex) {
                onSelected(savedSelectedIndex)
            }
        } else {
            savedSelectedIndex = safeSelectedIndex
            if (abs(animatedIndex.targetValue - safeSelectedIndex.toFloat()) > 0.001f) {
                animationJob?.cancel()
                animationJob = animationScope.launch {
                    animatedIndex.animateTo(
                        targetValue = safeSelectedIndex.toFloat(),
                        animationSpec = tween(durationMillis = 300, easing = FastOutSlowInEasing)
                    )
                }
            }
        }
    }

    BackHandler(enabled = labels.isNotEmpty() && safeSelectedIndex != 0) {
        moveTo(0)
    }

    Box(
        Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(start = 3.dp, end = 3.dp, top = 2.dp, bottom = 3.dp)
    ) {
        FlowGlassSurface(Modifier.fillMaxWidth()) {
            BoxWithConstraints(
                Modifier
                    .fillMaxWidth()
                    .padding(4.dp)
                    .selectableGroup()
            ) {
                val gap = 2.dp
                val count = labels.size.coerceAtLeast(1)
                val itemWidth = (maxWidth - gap * (count - 1)) / count
                val indicatorX = (itemWidth + gap) * animatedIndex.value

                Box(
                    Modifier
                        .offset(x = indicatorX)
                        .width(itemWidth)
                        .height(56.dp)
                        .clip(RoundedCornerShape(22.dp))
                        .graphicsLayer {
                            shadowElevation = if (FlowPalette.IsDark) 7f else 3f
                        }
                        .background(
                            FlowPalette.Accent.copy(alpha = if (FlowPalette.IsDark) .30f else .17f)
                        )
                )

                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(gap),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    labels.forEachIndexed { index, label ->
                        val active = index == safeSelectedIndex
                        val interaction = remember(label) { MutableInteractionSource() }
                        val pressed by interaction.collectIsPressedAsState()
                        val proximity = (1f - abs(animatedIndex.value - index.toFloat())).coerceIn(0f, 1f)
                        val foreground = lerp(FlowPalette.Muted, FlowPalette.AccentBright, proximity)
                        val scale = (.96f + (.04f * proximity)) * if (pressed) .93f else 1f

                        Box(
                            Modifier
                                .weight(1f)
                                .heightIn(min = 56.dp)
                                .graphicsLayer {
                                    scaleX = scale
                                    scaleY = scale
                                }
                                .selectable(
                                    selected = active,
                                    role = Role.Tab,
                                    interactionSource = interaction,
                                    indication = null,
                                    onClick = {
                                        if (!active) {
                                            view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                                            moveTo(index)
                                        }
                                    }
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(3.dp)
                            ) {
                                FlowIcon(
                                    glyph = flowGlyphForTab(label),
                                    modifier = Modifier.size(20.dp),
                                    tint = foreground
                                )
                                Text(
                                    label,
                                    color = foreground,
                                    fontSize = 10.sp,
                                    lineHeight = 11.sp,
                                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium,
                                    maxLines = 1,
                                    modifier = Modifier.alpha(.76f + (.24f * proximity))
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun flowGlyphForTab(label: String): FlowGlyph = when (label) {
    "오늘", "홈" -> FlowGlyph.HOME
    "시간표" -> FlowGlyph.CALENDAR
    "교통" -> FlowGlyph.TRANSIT
    "캠퍼스" -> FlowGlyph.MAP
    "학교" -> FlowGlyph.SCHOOL
    "설정" -> FlowGlyph.SETTINGS
    else -> FlowGlyph.HOME
}
