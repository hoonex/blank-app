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
import androidx.compose.material3.lightColorScheme
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
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.isSystemInDarkTheme
import io.github.hoonex.flow.R

private data class FlowColorTokens(
    val background: Color,
    val surface: Color,
    val surfaceRaised: Color,
    val surfaceSoft: Color,
    val accent: Color,
    val accentBright: Color,
    val text: Color,
    val muted: Color,
    val dim: Color,
    val stroke: Color,
    val strokeStrong: Color,
    val danger: Color,
    val warm: Color
)

private val LightFlowColors = FlowColorTokens(
    background = Color(0xFFEEF2F6),
    surface = Color(0xFFFFFFFF),
    surfaceRaised = Color(0xFFF0F3F7),
    surfaceSoft = Color(0xFFF5F7FA),
    accent = Color(0xFF5577E9),
    accentBright = Color(0xFF7693F3),
    text = Color(0xFF18212D),
    muted = Color(0xFF697586),
    dim = Color(0xFF9AA4B2),
    stroke = Color(0x172B394E),
    strokeStrong = Color(0x242B394E),
    danger = Color(0xFFD65367),
    warm = Color(0xFFD89546)
)

private val DarkFlowColors = FlowColorTokens(
    background = Color(0xFF151B22),
    surface = Color(0xFF222B36),
    surfaceRaised = Color(0xFF27313D),
    surfaceSoft = Color(0xFF1E2631),
    accent = Color(0xFF8BA7FF),
    accentBright = Color(0xFFA6BAFF),
    text = Color(0xFFF4F6F9),
    muted = Color(0xFFAAB4C0),
    dim = Color(0xFF7E8997),
    stroke = Color(0x14FFFFFF),
    strokeStrong = Color(0x21FFFFFF),
    danger = Color(0xFFFF8999),
    warm = Color(0xFFEFB36D)
)

/**
 * Flow's native color facade intentionally mirrors the web product tokens.
 * Existing screens can keep using FlowPalette while the active token set follows
 * the system appearance through FlowTheme.
 */
object FlowPalette {
    private var active = DarkFlowColors

    internal fun useDarkMode(dark: Boolean) {
        active = if (dark) DarkFlowColors else LightFlowColors
    }

    val Background get() = active.background
    val Surface get() = active.surface
    val SurfaceRaised get() = active.surfaceRaised
    val SurfaceSoft get() = active.surfaceSoft
    val Accent get() = active.accent
    val AccentBright get() = active.accentBright

    // Compatibility aliases while older native surfaces are migrated from the first mint pass.
    val Mint get() = active.accent
    val MintBright get() = active.accentBright

    val Text get() = active.text
    val Muted get() = active.muted
    val Dim get() = active.dim
    val Stroke get() = active.stroke
    val StrokeStrong get() = active.strokeStrong
    val Danger get() = active.danger
    val Warm get() = active.warm
}

private fun flowColorScheme(dark: Boolean) = if (dark) {
    darkColorScheme(
        primary = DarkFlowColors.accent,
        onPrimary = Color.White,
        background = DarkFlowColors.background,
        onBackground = DarkFlowColors.text,
        surface = DarkFlowColors.surface,
        onSurface = DarkFlowColors.text,
        surfaceVariant = DarkFlowColors.surfaceRaised,
        onSurfaceVariant = DarkFlowColors.muted,
        outline = DarkFlowColors.strokeStrong,
        error = DarkFlowColors.danger
    )
} else {
    lightColorScheme(
        primary = LightFlowColors.accent,
        onPrimary = Color.White,
        background = LightFlowColors.background,
        onBackground = LightFlowColors.text,
        surface = LightFlowColors.surface,
        onSurface = LightFlowColors.text,
        surfaceVariant = LightFlowColors.surfaceRaised,
        onSurfaceVariant = LightFlowColors.muted,
        outline = LightFlowColors.strokeStrong,
        error = LightFlowColors.danger
    )
}

@Composable
fun FlowTheme(content: @Composable () -> Unit) {
    val dark = if (LocalInspectionMode.current) false else isSystemInDarkTheme()
    FlowPalette.useDarkMode(dark)
    MaterialTheme(colorScheme = remember(dark) { flowColorScheme(dark) }, content = content)
}

@Composable
fun FlowBrand(modifier: Modifier = Modifier, compact: Boolean = false) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(
            Modifier
                .size(if (compact) 32.dp else 40.dp)
                .clip(RoundedCornerShape(if (compact) 10.dp else 13.dp))
                .background(
                    Brush.linearGradient(
                        listOf(Color(0xFF6790F4), Color(0xFF3868E8))
                    )
                ),
            contentAlignment = Alignment.Center
        ) {
            Image(
                painter = painterResource(R.drawable.ic_flow_mark),
                contentDescription = null,
                modifier = Modifier.size(if (compact) 24.dp else 30.dp)
            )
        }
        if (!compact) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Flow", color = FlowPalette.Text, fontSize = 18.sp, fontWeight = FontWeight.Black, letterSpacing = (-0.55).sp)
                Text("School · University", color = FlowPalette.Muted, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 2.dp))
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
        if (focused) FlowPalette.Accent.copy(alpha = 0.68f) else FlowPalette.Stroke,
        tween(150),
        label = "flow-input-border"
    )
    val glow by animateFloatAsState(if (focused) 1f else 0f, tween(150), label = "flow-input-glow")
    val shape = RoundedCornerShape(17.dp)

    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        textStyle = TextStyle(color = FlowPalette.Text, fontSize = 16.sp, lineHeight = 21.sp),
        cursorBrush = SolidColor(FlowPalette.Accent),
        singleLine = singleLine,
        keyboardOptions = keyboardOptions,
        visualTransformation = visualTransformation,
        interactionSource = interaction,
        decorationBox = { inner ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 58.dp)
                    .graphicsLayer { shadowElevation = 7f * glow }
                    .clip(shape)
                    .background(FlowPalette.SurfaceRaised)
                    .border(1.dp, borderColor, shape)
                    .padding(horizontal = 16.dp, vertical = 15.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (leading != null) {
                    Text(leading, color = if (focused) FlowPalette.Accent else FlowPalette.Dim, fontSize = 16.sp)
                }
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty()) Text(placeholder, color = FlowPalette.Dim, fontSize = 15.sp)
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
            .heightIn(min = 52.dp)
            .clip(RoundedCornerShape(15.dp))
            .background(if (enabled) FlowPalette.Accent else FlowPalette.StrokeStrong)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = if (enabled) Color.White else FlowPalette.Dim, fontWeight = FontWeight.Black, fontSize = 15.sp)
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
    val shape = RoundedCornerShape(15.dp)
    Box(
        modifier
            .heightIn(min = 48.dp)
            .clip(shape)
            .background(FlowPalette.SurfaceRaised)
            .border(1.dp, FlowPalette.Stroke, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 13.dp),
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
    val shape = RoundedCornerShape(22.dp)
    val base = modifier
        .clip(shape)
        .background(if (accent) FlowPalette.Accent.copy(alpha = if (isSystemInDarkTheme()) 0.12f else 0.085f) else FlowPalette.Surface)
        .border(1.dp, if (accent) FlowPalette.Accent.copy(alpha = 0.20f) else FlowPalette.Stroke, shape)
    Box(if (onClick != null) base.clickable(onClick = onClick) else base) { content() }
}

@Composable
fun FlowSectionTitle(kicker: String, title: String, trailing: String? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.SpaceBetween) {
        Column {
            Text(kicker.uppercase(), color = FlowPalette.Accent, fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 1.2.sp)
            Spacer(Modifier.height(4.dp))
            Text(title, color = FlowPalette.Text, fontSize = 21.sp, fontWeight = FontWeight.Black)
        }
        if (trailing != null) Text(trailing, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.alpha(0.92f))
    }
}
