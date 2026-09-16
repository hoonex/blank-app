package io.github.hoonex.flow.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun FlowBottomNavigation(
    labels: List<String>,
    selectedIndex: Int,
    onSelected: (Int) -> Unit
) {
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
                .padding(6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            labels.forEachIndexed { index, label ->
                val active = index == selectedIndex
                val itemShape = RoundedCornerShape(16.dp)
                Box(
                    Modifier
                        .weight(1f)
                        .heightIn(min = 44.dp)
                        .clip(itemShape)
                        .background(if (active) FlowPalette.Accent.copy(alpha = 0.12f) else FlowPalette.Surface)
                        .clickable { onSelected(index) }
                        .padding(horizontal = 6.dp, vertical = 11.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        label,
                        color = if (active) FlowPalette.Accent else FlowPalette.Muted,
                        fontSize = 11.sp,
                        fontWeight = if (active) FontWeight.Black else FontWeight.SemiBold,
                        maxLines = 1
                    )
                }
            }
        }
    }
}
