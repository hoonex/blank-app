package io.github.hoonex.flow.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.hoonex.flow.R

object FlowPalette {
    val Background = Color(0xFF080B0D)
    val Surface = Color(0xFF111619)
    val SurfaceRaised = Color(0xFF171E22)
    val SurfaceSoft = Color(0xFF0E1316)
    val Mint = Color(0xFF7BE7D6)
    val MintBright = Color(0xFFD9FFF8)
    val Text = Color(0xFFF4F7F7)
    val Muted = Color(0xFFA8B3B8)
    val Dim = Color(0xFF748087)
    val Stroke = Color(0xFF263136)
    val StrokeStrong = Color(0xFF3A4A50)
    val Danger = Color(0xFFFFA7A7)
    val Warm = Color(0xFFFFD49A)
}

private val FlowColorScheme = darkColorScheme(
    primary = FlowPalette.Mint,
    onPrimary = Color(0xFF00201B),
    background = FlowPalette.Background,
    onBackground = FlowPalette.Text,
    surface = FlowPalette.Surface,
    onSurface = FlowPalette.Text,
    surfaceVariant = FlowPalette.SurfaceRaised,
    onSurfaceVariant = FlowPalette.Muted,
    outline = FlowPalette.StrokeStrong,
    error = FlowPalette.Danger
)

@Composable
fun FlowTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = FlowColorScheme, content = content)
}

@Composable
fun FlowBrand(modifier: Modifier = Modifier, compact: Boolean = false) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            Modifier
                .size(if (compact) 32.dp else 40.dp)
                .clip(RoundedCornerShape(if (compact) 11.dp else 14.dp))
                .background(
                    Brush.linearGradient(
                        listOf(Color(0xFF122923), Color(0xFF0C1715))
                    )
                )
                .border(1.dp, Color(0x337BE7D6), RoundedCornerShape(if (compact) 11.dp else 14.dp)),
            contentAlignment = Alignment.Center
        ) {
            Image(
                painter = painterResource(R.drawable.ic_flow_mark),
                contentDescription = null,
                modifier = Modifier.size(if (compact) 25.dp else 31.dp)
            )
        }
        if (!compact) {
            Column {
                Text("Flow", color = FlowPalette.Text, fontSize = 18.sp, fontWeight = FontWeight.Black)
                Text("UNIVERSITY", color = FlowPalette.Mint, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.1.sp)
            }
        }
    }
}

@Composable
fun FlowTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    singleLine: Boolean = true,
    leading: String? = null
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val borderColor by animateColorAsState(
        if (focused) FlowPalette.Mint.copy(alpha = 0.72f) else FlowPalette.Stroke,
        tween(150),
        label = "flow-input-border"
    )
    val glow by animateFloatAsState(if (focused) 1f else 0f, tween(150), label = "flow-input-glow")
    val shape = RoundedCornerShape(20.dp)

    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        textStyle = TextStyle(color = FlowPalette.Text, fontSize = 16.sp, lineHeight = 21.sp),
        cursorBrush = SolidColor(FlowPalette.Mint),
        singleLine = singleLine,
        keyboardOptions = keyboardOptions,
        visualTransformation = visualTransformation,
        interactionSource = interaction,
        decorationBox = { inner ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 58.dp)
                    .graphicsLayer { shadowElevation = 12f * glow }
                    .clip(shape)
                    .background(FlowPalette.SurfaceRaised)
                    .border(1.dp, borderColor, shape)
                    .padding(horizontal = 18.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (leading != null) {
                    Text(leading, color = if (focused) FlowPalette.Mint else FlowPalette.Dim, fontSize = 17.sp)
                }
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty()) Text(placeholder, color = FlowPalette.Dim, fontSize = 16.sp)
                    inner()
                }
            }
        }
    )
}

@Composable
fun FlowPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    Box(
        modifier
            .heightIn(min = 54.dp)
            .clip(RoundedCornerShape(19.dp))
            .background(if (enabled) FlowPalette.Mint else FlowPalette.Stroke)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 15.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = if (enabled) Color(0xFF05211C) else FlowPalette.Dim, fontWeight = FontWeight.Black, fontSize = 15.sp)
    }
}

@Composable
fun FlowSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    danger: Boolean = false
) {
    val tint = if (danger) FlowPalette.Danger else FlowPalette.Text
    Box(
        modifier
            .heightIn(min = 50.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(FlowPalette.SurfaceRaised)
            .border(1.dp, FlowPalette.Stroke, RoundedCornerShape(18.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = tint, fontWeight = FontWeight.Bold, fontSize = 14.sp)
    }
}

@Composable
fun FlowCard(
    modifier: Modifier = Modifier,
    accent: Boolean = false,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    val shape = RoundedCornerShape(26.dp)
    val base = modifier
        .clip(shape)
        .background(
            if (accent) Brush.linearGradient(listOf(Color(0xFF18302B), Color(0xFF111B1A)))
            else Brush.linearGradient(listOf(FlowPalette.SurfaceRaised, FlowPalette.Surface))
        )
        .border(1.dp, if (accent) Color(0x407BE7D6) else FlowPalette.Stroke.copy(alpha = 0.85f), shape)
    Box(if (onClick != null) base.clickable(onClick = onClick) else base) { content() }
}

@Composable
fun FlowSectionTitle(kicker: String, title: String, trailing: String? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.SpaceBetween) {
        Column {
            Text(kicker.uppercase(), color = FlowPalette.Mint, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.3.sp)
            Spacer(Modifier.height(4.dp))
            Text(title, color = FlowPalette.Text, fontSize = 21.sp, fontWeight = FontWeight.Black)
        }
        if (trailing != null) Text(trailing, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.alpha(0.92f))
    }
}
