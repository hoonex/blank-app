package io.github.hoonex.flow.ui

import android.view.HapticFeedbackConstants
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun FlowSegmentedControl(
    options: List<String>,
    selectedIndex: Int,
    onSelected: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    if (options.isEmpty()) return
    val safeIndex = selectedIndex.coerceIn(options.indices)
    val view = LocalView.current

    BoxWithConstraints(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(15.dp))
            .background(FlowPalette.SurfaceSoft)
            .padding(3.dp)
    ) {
        val gap = 2.dp
        val itemWidth = (maxWidth - gap * (options.size - 1)) / options.size
        val targetX = (itemWidth + gap) * safeIndex
        val indicatorX by animateDpAsState(
            targetValue = targetX,
            animationSpec = spring(
                dampingRatio = 0.84f,
                stiffness = Spring.StiffnessMediumLow
            ),
            label = "flow-segment-x"
        )

        Box(
            Modifier
                .offset(x = indicatorX)
                .width(itemWidth)
                .height(38.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(FlowPalette.Surface)
        )

        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(gap),
            verticalAlignment = Alignment.CenterVertically
        ) {
            options.forEachIndexed { index, label ->
                Box(
                    Modifier
                        .weight(1f)
                        .height(38.dp)
                        .clickable {
                            if (index != safeIndex) {
                                view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                                onSelected(index)
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        label,
                        color = if (index == safeIndex) FlowPalette.Text else FlowPalette.Muted,
                        fontSize = 13.sp,
                        fontWeight = if (index == safeIndex) FontWeight.SemiBold else FontWeight.Medium
                    )
                }
            }
        }
    }
}
