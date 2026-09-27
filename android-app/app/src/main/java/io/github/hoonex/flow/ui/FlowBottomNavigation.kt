package io.github.hoonex.flow.ui

import android.view.HapticFeedbackConstants
import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

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
    var lastObservedSelectedIndex by remember(labelsKey) { mutableIntStateOf(safeSelectedIndex) }

    LaunchedEffect(labelsKey, safeSelectedIndex, savedSelectedIndex) {
        if (labels.isEmpty()) return@LaunchedEffect
        if (safeSelectedIndex != lastObservedSelectedIndex) {
            savedSelectedIndex = safeSelectedIndex
            lastObservedSelectedIndex = safeSelectedIndex
        } else if (savedSelectedIndex in labels.indices && savedSelectedIndex != safeSelectedIndex) {
            lastObservedSelectedIndex = savedSelectedIndex
            onSelected(savedSelectedIndex)
        }
    }

    BackHandler(enabled = labels.isNotEmpty() && safeSelectedIndex != 0) {
        savedSelectedIndex = 0
        lastObservedSelectedIndex = 0
        onSelected(0)
    }

    Box(
        Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(start = 7.dp, end = 7.dp, top = 3.dp, bottom = 6.dp)
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
                val targetX = (itemWidth + gap) * safeSelectedIndex
                val indicatorX by animateDpAsState(
                    targetValue = targetX,
                    animationSpec = spring(
                        dampingRatio = 0.82f,
                        stiffness = Spring.StiffnessMediumLow
                    ),
                    label = "flow-tab-indicator-x"
                )

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
                            FlowPalette.Accent.copy(alpha = if (FlowPalette.IsDark) .24f else .14f)
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
                        val foreground by animateColorAsState(
                            targetValue = if (active) FlowPalette.AccentBright else FlowPalette.Muted,
                            animationSpec = tween(180),
                            label = "flow-tab-fg"
                        )
                        val scale by animateFloatAsState(
                            targetValue = if (active) 1f else .96f,
                            animationSpec = spring(
                                dampingRatio = Spring.DampingRatioNoBouncy,
                                stiffness = Spring.StiffnessMedium
                            ),
                            label = "flow-tab-scale"
                        )

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
                                            savedSelectedIndex = index
                                            view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                                            onSelected(index)
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
                                    modifier = Modifier.alpha(if (active) 1f else .80f)
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
    "학교" -> FlowGlyph.SCHOOL
    "설정" -> FlowGlyph.SETTINGS
    else -> FlowGlyph.HOME
}
