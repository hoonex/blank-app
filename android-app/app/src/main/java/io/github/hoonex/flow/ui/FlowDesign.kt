package io.github.hoonex.flow.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.isSystemInDarkTheme
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat

private data class FlowColorTokens(
    val background: Color,
    val surface: Color,
    val surfaceRaised: Color,
    val surfaceSoft: Color,
    val glassTop: Color,
    val glassBottom: Color,
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
    background = Color(0xFFF2F2F7),
    surface = Color(0xFFFFFFFF),
    surfaceRaised = Color(0xFFF7F7FA),
    surfaceSoft = Color(0xFFE9E9EF),
    glassTop = Color(0xF2FFFFFF),
    glassBottom = Color(0xCFEFF1F7),
    accent = Color(0xFF4967FF),
    accentBright = Color(0xFF6F83FF),
    text = Color(0xFF0A0A0B),
    muted = Color(0xFF6E6E73),
    dim = Color(0xFFA1A1A8),
    stroke = Color(0x12000000),
    strokeStrong = Color(0x22000000),
    danger = Color(0xFFFF3B30),
    warm = Color(0xFFFF9F0A)
)

private val DarkFlowColors = FlowColorTokens(
    background = Color(0xFF000000),
    surface = Color(0xFF1C1C1E),
    surfaceRaised = Color(0xFF2C2C2E),
    surfaceSoft = Color(0xFF161618),
    glassTop = Color(0xE92B2B2F),
    glassBottom = Color(0xD219191C),
    accent = Color(0xFF8395FF),
    accentBright = Color(0xFFA7B2FF),
    text = Color(0xFFF5F5F7),
    muted = Color(0xFF98989D),
    dim = Color(0xFF636366),
    stroke = Color(0x18FFFFFF),
    strokeStrong = Color(0x2AFFFFFF),
    danger = Color(0xFFFF6961),
    warm = Color(0xFFFFB340)
)

/**
 * Flow native identity: Quiet glass, live content.
 *
 * Content stays calm and high-contrast. Glass is reserved for navigation and
 * interaction chrome so hierarchy remains clear and the UI does not become a
 * translucent card wall.
 */
object FlowPalette {
    private var active = DarkFlowColors
    private var dark = true

    internal fun useDarkMode(enabled: Boolean) {
        dark = enabled
        active = if (enabled) DarkFlowColors else LightFlowColors
    }

    val IsDark get() = dark
    val Background get() = active.background
    val Surface get() = active.surface
    val SurfaceRaised get() = active.surfaceRaised
    val SurfaceSoft get() = active.surfaceSoft
    val GlassTop get() = active.glassTop
    val GlassBottom get() = active.glassBottom
    val Accent get() = active.accent
    val AccentBright get() = active.accentBright
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
    val view = LocalView.current
    FlowPalette.useDarkMode(dark)
    SideEffect {
        view.context.findFlowActivity()?.let { activity ->
            WindowCompat.getInsetsController(activity.window, view).apply {
                isAppearanceLightStatusBars = !dark
                isAppearanceLightNavigationBars = !dark
            }
        }
    }
    MaterialTheme(colorScheme = remember(dark) { flowColorScheme(dark) }, content = content)
}

private tailrec fun Context.findFlowActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findFlowActivity()
    else -> null
}

enum class FlowGlyph {
    HOME, CALENDAR, TRANSIT, SCHOOL, UNIVERSITY, SETTINGS, PLANNER, WIDGETS
}

@Composable
fun FlowIcon(
    glyph: FlowGlyph,
    modifier: Modifier = Modifier,
    tint: Color = FlowPalette.Text
) {
    Canvas(modifier) {
        val w = size.width
        val h = size.height
        val stroke = (minOf(w, h) * 0.075f).coerceAtLeast(1.5f)
        val style = Stroke(width = stroke, cap = StrokeCap.Round)

        fun line(x1: Float, y1: Float, x2: Float, y2: Float) {
            drawLine(tint, Offset(w * x1, h * y1), Offset(w * x2, h * y2), stroke, StrokeCap.Round)
        }

        when (glyph) {
            FlowGlyph.HOME -> {
                line(.18f, .48f, .50f, .20f)
                line(.50f, .20f, .82f, .48f)
                drawRoundRect(tint, Offset(w * .25f, h * .43f), Size(w * .50f, h * .40f), CornerRadius(w * .06f), style = style)
                line(.48f, .83f, .48f, .62f)
                line(.48f, .62f, .62f, .62f)
                line(.62f, .62f, .62f, .83f)
            }
            FlowGlyph.CALENDAR -> {
                drawRoundRect(tint, Offset(w * .17f, h * .22f), Size(w * .66f, h * .61f), CornerRadius(w * .10f), style = style)
                line(.17f, .39f, .83f, .39f)
                line(.34f, .15f, .34f, .29f)
                line(.66f, .15f, .66f, .29f)
                drawCircle(tint, w * .035f, Offset(w * .36f, h * .56f))
                drawCircle(tint, w * .035f, Offset(w * .52f, h * .56f))
                drawCircle(tint, w * .035f, Offset(w * .68f, h * .56f))
            }
            FlowGlyph.TRANSIT -> {
                drawRoundRect(tint, Offset(w * .20f, h * .18f), Size(w * .60f, h * .58f), CornerRadius(w * .11f), style = style)
                line(.27f, .40f, .73f, .40f)
                drawCircle(tint, w * .07f, Offset(w * .34f, h * .80f), style = style)
                drawCircle(tint, w * .07f, Offset(w * .66f, h * .80f), style = style)
            }
            FlowGlyph.SCHOOL, FlowGlyph.UNIVERSITY -> {
                line(.18f, .38f, .50f, .18f)
                line(.50f, .18f, .82f, .38f)
                line(.22f, .42f, .78f, .42f)
                line(.26f, .42f, .26f, .78f)
                line(.74f, .42f, .74f, .78f)
                line(.38f, .45f, .38f, .78f)
                line(.62f, .45f, .62f, .78f)
                line(.18f, .80f, .82f, .80f)
            }
            FlowGlyph.SETTINGS -> {
                drawCircle(tint, w * .18f, Offset(w * .50f, h * .50f), style = style)
                drawCircle(tint, w * .05f, Offset(w * .50f, h * .50f))
                line(.50f, .12f, .50f, .27f)
                line(.50f, .73f, .50f, .88f)
                line(.12f, .50f, .27f, .50f)
                line(.73f, .50f, .88f, .50f)
                line(.23f, .23f, .34f, .34f)
                line(.66f, .66f, .77f, .77f)
                line(.77f, .23f, .66f, .34f)
                line(.34f, .66f, .23f, .77f)
            }
            FlowGlyph.PLANNER -> {
                drawRoundRect(tint, Offset(w * .18f, h * .16f), Size(w * .64f, h * .68f), CornerRadius(w * .10f), style = style)
                drawCircle(tint, w * .027f, Offset(w * .32f, h * .38f))
                drawCircle(tint, w * .027f, Offset(w * .32f, h * .56f))
                drawCircle(tint, w * .027f, Offset(w * .32f, h * .72f))
                line(.43f, .38f, .70f, .38f)
                line(.43f, .56f, .70f, .56f)
                line(.43f, .72f, .63f, .72f)
            }
            FlowGlyph.WIDGETS -> {
                drawRoundRect(tint, Offset(w * .15f, h * .15f), Size(w * .29f, h * .29f), CornerRadius(w * .07f), style = style)
                drawRoundRect(tint, Offset(w * .56f, h * .15f), Size(w * .29f, h * .29f), CornerRadius(w * .07f), style = style)
                drawRoundRect(tint, Offset(w * .15f, h * .56f), Size(w * .29f, h * .29f), CornerRadius(w * .07f), style = style)
                drawRoundRect(tint, Offset(w * .56f, h * .56f), Size(w * .29f, h * .29f), CornerRadius(w * .07f), style = style)
            }
        }
    }
}

@Composable
fun FlowMark(modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(Color(0xFF7A8DFF), Color(0xFF3D5BFF)))),
        contentAlignment = Alignment.Center
    ) {
        Canvas(Modifier.fillMaxWidth().height(22.dp)) {
            val style = Stroke(width = 2.15.dp.toPx(), cap = StrokeCap.Round)
            drawArc(Color.White.copy(alpha = .96f), 202f, 228f, false, style = style)
            drawArc(Color.White.copy(alpha = .62f), 18f, 212f, false, style = style)
        }
    }
}

@Composable
fun FlowBrand(modifier: Modifier = Modifier, compact: Boolean = false) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        FlowMark(Modifier.size(if (compact) 28.dp else 34.dp))
        if (!compact) {
            Text(
                "Flow",
                color = FlowPalette.Text,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.55).sp
            )
        }
    }
}

@Composable
fun FlowLargeTitle(title: String, subtitle: String? = null, trailing: String? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.SpaceBetween) {
        Column(Modifier.weight(1f)) {
            Text(
                title,
                color = FlowPalette.Text,
                fontSize = 34.sp,
                lineHeight = 38.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-1.1).sp
            )
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, color = FlowPalette.Muted, fontSize = 14.sp, lineHeight = 20.sp, modifier = Modifier.padding(top = 6.dp))
            }
        }
        if (!trailing.isNullOrBlank()) {
            Text(trailing, color = FlowPalette.Accent, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 12.dp, bottom = 3.dp))
        }
    }
}

@Composable
fun FlowGlassSurface(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val shape = RoundedCornerShape(26.dp)
    Box(
        modifier
            .shadow(14.dp, shape, clip = false)
            .clip(shape)
            .background(Brush.verticalGradient(listOf(FlowPalette.GlassTop, FlowPalette.GlassBottom)))
            .border(0.75.dp, if (FlowPalette.IsDark) Color.White.copy(alpha = .13f) else Color.White.copy(alpha = .92f), shape)
    ) {
        content()
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
    val fill by animateColorAsState(
        if (focused) FlowPalette.Surface else FlowPalette.SurfaceSoft,
        tween(140),
        label = "flow-input-fill"
    )
    val glow by animateFloatAsState(if (focused) 1f else 0f, tween(140), label = "flow-input-glow")
    val shape = RoundedCornerShape(13.dp)

    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        textStyle = TextStyle(color = FlowPalette.Text, fontSize = 16.sp, lineHeight = 21.sp, fontWeight = FontWeight.Medium),
        cursorBrush = SolidColor(FlowPalette.Accent),
        singleLine = singleLine,
        keyboardOptions = keyboardOptions,
        visualTransformation = visualTransformation,
        interactionSource = interaction,
        decorationBox = { inner ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 52.dp)
                    .graphicsLayer { shadowElevation = 5f * glow }
                    .clip(shape)
                    .background(fill)
                    .border(if (focused) 1.dp else 0.5.dp, if (focused) FlowPalette.Accent.copy(alpha = .38f) else FlowPalette.Stroke, shape)
                    .padding(horizontal = 14.dp, vertical = 13.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (leading != null) Text(leading, color = if (focused) FlowPalette.Accent else FlowPalette.Muted, fontSize = 16.sp)
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty()) Text(placeholder, color = FlowPalette.Dim, fontSize = 15.sp)
                    inner()
                }
            }
        }
    )
}

@Composable
fun FlowPrimaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Box(
        modifier
            .heightIn(min = 50.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(if (enabled) FlowPalette.Accent else FlowPalette.SurfaceSoft)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 13.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = if (enabled) Color.White else FlowPalette.Dim, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
    }
}

@Composable
fun FlowSecondaryButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, danger: Boolean = false) {
    val tint = if (danger) FlowPalette.Danger else FlowPalette.Accent
    val shape = RoundedCornerShape(999.dp)
    Box(
        modifier
            .heightIn(min = 48.dp)
            .clip(shape)
            .background(if (danger) FlowPalette.Danger.copy(alpha = .09f) else FlowPalette.Surface)
            .border(0.5.dp, if (danger) FlowPalette.Danger.copy(alpha = .16f) else FlowPalette.Stroke, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 17.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = tint, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
    }
}

@Composable
fun FlowCard(
    modifier: Modifier = Modifier,
    accent: Boolean = false,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit
) {
    val shape = RoundedCornerShape(18.dp)
    val background = if (accent) {
        Brush.linearGradient(
            listOf(
                FlowPalette.Accent.copy(alpha = if (FlowPalette.IsDark) .16f else .10f),
                FlowPalette.Surface
            )
        )
    } else {
        Brush.linearGradient(listOf(FlowPalette.Surface, FlowPalette.Surface))
    }
    val base = modifier
        .clip(shape)
        .background(background)
        .border(0.5.dp, if (accent) FlowPalette.Accent.copy(alpha = .18f) else FlowPalette.Stroke, shape)
    Box(if (onClick != null) base.clickable(onClick = onClick) else base) { content() }
}

@Composable
fun FlowSectionTitle(kicker: String, title: String, trailing: String? = null) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 2.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(title, color = FlowPalette.Text, fontSize = 20.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.35).sp)
        if (trailing != null) {
            Text(trailing, color = FlowPalette.Muted, fontSize = 12.sp, modifier = Modifier.alpha(.90f).padding(start = 10.dp, bottom = 2.dp))
        }
    }
}

@Composable
fun FlowListRow(
    title: String,
    subtitle: String? = null,
    glyph: FlowGlyph? = null,
    value: String? = null,
    danger: Boolean = false,
    onClick: (() -> Unit)? = null
) {
    val contentColor = if (danger) FlowPalette.Danger else FlowPalette.Text
    val modifier = Modifier
        .fillMaxWidth()
        .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
        .padding(horizontal = 16.dp, vertical = 13.dp)

    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(13.dp)) {
        if (glyph != null) {
            Box(
                Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(
                    if (danger) FlowPalette.Danger.copy(alpha = .10f) else FlowPalette.Accent.copy(alpha = .10f)
                ),
                contentAlignment = Alignment.Center
            ) {
                FlowIcon(glyph, Modifier.size(19.dp), if (danger) FlowPalette.Danger else FlowPalette.Accent)
            }
        }
        Column(Modifier.weight(1f)) {
            Text(title, color = contentColor, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, color = FlowPalette.Muted, fontSize = 11.5.sp, lineHeight = 16.sp, modifier = Modifier.padding(top = 3.dp))
            }
        }
        if (!value.isNullOrBlank()) Text(value, color = FlowPalette.Muted, fontSize = 13.sp)
        if (onClick != null) Text("›", color = FlowPalette.Dim, fontSize = 23.sp, fontWeight = FontWeight.Medium)
    }
}
