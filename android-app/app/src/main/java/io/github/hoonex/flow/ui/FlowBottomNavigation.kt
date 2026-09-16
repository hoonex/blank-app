package io.github.hoonex.flow.ui

import android.view.HapticFeedbackConstants
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
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

    Box(
        Modifier
            .fillMaxWidth()
            .background(FlowPalette.Background)
            .navigationBarsPadding()
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) {
        val shell = RoundedCornerShape(22.dp)
        Row(
            Modifier
                .fillMaxWidth()
                .clip(shell)
                .background(FlowPalette.Surface)
                .border(1.dp, FlowPalette.Stroke, shell)
                .padding(6.dp)
                .selectableGroup(),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            labels.forEachIndexed { index, label ->
                val active = index == selectedIndex
                val interaction = remember(label) { MutableInteractionSource() }
                val itemShape = RoundedCornerShape(16.dp)
                val background by animateColorAsState(
                    targetValue = if (active) FlowPalette.Accent.copy(alpha = 0.12f) else FlowPalette.Surface,
                    animationSpec = tween(160),
                    label = "flow-nav-bg"
                )
                val foreground by animateColorAsState(
                    targetValue = if (active) FlowPalette.Accent else FlowPalette.Muted,
                    animationSpec = tween(160),
                    label = "flow-nav-fg"
                )
                val scale by animateFloatAsState(
                    targetValue = if (active) 1f else 0.985f,
                    animationSpec = tween(160),
                    label = "flow-nav-scale"
                )
                val inactiveAlpha by animateFloatAsState(
                    targetValue = if (active) 1f else 0.92f,
                    animationSpec = tween(160),
                    label = "flow-nav-alpha"
                )

                Box(
                    Modifier
                        .weight(1f)
                        .heightIn(min = 48.dp)
                        .graphicsLayer {
                            scaleX = scale
                            scaleY = scale
                        }
                        .clip(itemShape)
                        .background(background)
                        .selectable(
                            selected = active,
                            role = Role.Tab,
                            interactionSource = interaction,
                            indication = null,
                            onClick = {
                                if (!active) {
                                    view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                                    onSelected(index)
                                }
                            }
                        )
                        .padding(horizontal = 6.dp, vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        label,
                        color = foreground,
                        fontSize = 11.sp,
                        fontWeight = if (active) FontWeight.Black else FontWeight.SemiBold,
                        maxLines = 1,
                        modifier = Modifier.alpha(inactiveAlpha)
                    )
                }
            }
        }
    }
}
