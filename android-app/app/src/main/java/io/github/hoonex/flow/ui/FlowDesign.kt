package io.github.hoonex.flow.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import io.github.hoonex.flow.R

enum class FlowThemeMode { DARK, LIGHT }

object FlowAppearance {
    private const val PREFS = "flow-appearance-v1"
    private val state = mutableStateOf(FlowThemeMode.DARK)
    private var initialized = false

    val mode: FlowThemeMode get() = state.value
    val isLight: Boolean get() = state.value == FlowThemeMode.LIGHT

    fun initialize(context: Context) {
        if (initialized) return
        state.value = runCatching {
            FlowThemeMode.valueOf(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("theme", FlowThemeMode.DARK.name)!!)
        }.getOrDefault(FlowThemeMode.DARK)
        initialized = true
    }

    fun set(context: Context, mode: FlowThemeMode) {
        state.value = mode
        initialized = true
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("theme", mode.name).apply()
    }

    fun toggle(context: Context) = set(context, if (isLight) FlowThemeMode.DARK else FlowThemeMode.LIGHT)
}

object FlowPalette {
    val Background get() = if (FlowAppearance.isLight) Color(0xFFF5F7F8) else Color(0xFF070A0C)
    val BackgroundLift get() = if (FlowAppearance.isLight) Color(0xFFEEF2F3) else Color(0xFF0A0F12)
    val Surface get() = if (FlowAppearance.isLight) Color(0xFFFFFFFF) else Color(0xFF101619)
    val SurfaceRaised get() = if (FlowAppearance.isLight) Color(0xFFF7F9FA) else Color(0xFF151D21)
    val SurfaceSoft get() = if (FlowAppearance.isLight) Color(0xFFEDF2F3) else Color(0xFF0C1114)
    val Mint get() = if (FlowAppearance.isLight) Color(0xFF087C6B) else Color(0xFF78E9D5)
    val MintBright get() = if (FlowAppearance.isLight) Color(0xFF25AD97) else Color(0xFFD8FFF7)
    val School get() = if (FlowAppearance.isLight) Color(0xFF356FC7) else Color(0xFF8AB4FF)
    val University get() = Mint
    val Planner get() = if (FlowAppearance.isLight) Color(0xFF6757B7) else Color(0xFFB7A8FF)
    val Text get() = if (FlowAppearance.isLight) Color(0xFF101618) else Color(0xFFF5F8F8)
    val Muted get() = if (FlowAppearance.isLight) Color(0xFF56636A) else Color(0xFFA2ADB2)
    val Dim get() = if (FlowAppearance.isLight) Color(0xFF7B878D) else Color(0xFF657179)
    val Stroke get() = if (FlowAppearance.isLight) Color(0xFFD7E0E3) else Color(0xFF222C31)
    val StrokeStrong get() = if (FlowAppearance.isLight) Color(0xFFBECBD0) else Color(0xFF35434A)
    val Danger get() = if (FlowAppearance.isLight) Color(0xFFB93D3D) else Color(0xFFFFA7A7)
    val Warm get() = if (FlowAppearance.isLight) Color(0xFF9B6508) else Color(0xFFFFD49A)
    val OnAccent get() = if (FlowAppearance.isLight) Color.White else Color(0xFF06231E)
    val CardTop get() = if (FlowAppearance.isLight) Color.White else Color(0xFF131A1E)
    val CardBottom get() = if (FlowAppearance.isLight) Color(0xFFF8FAFA) else Color(0xFF0D1215)
    val InputTop get() = if (FlowAppearance.isLight) Color.White else Color(0xFF12181B)
    val SecondaryTop get() = if (FlowAppearance.isLight) Color.White else Color(0xFF151C20)
    val SecondaryBottom get() = if (FlowAppearance.isLight) Color(0xFFF5F8F9) else Color(0xFF101619)
}

@Composable
fun FlowTheme(content: @Composable () -> Unit) {
    val context = LocalContext.current
    LaunchedEffect(context) { FlowAppearance.initialize(context) }
    val light = FlowAppearance.isLight
    val scheme = if (light) {
        lightColorScheme(
            primary = FlowPalette.Mint,
            onPrimary = FlowPalette.OnAccent,
            background = FlowPalette.Background,
            onBackground = FlowPalette.Text,
            surface = FlowPalette.Surface,
            onSurface = FlowPalette.Text,
            surfaceVariant = FlowPalette.SurfaceRaised,
            onSurfaceVariant = FlowPalette.Muted,
            outline = FlowPalette.StrokeStrong,
            error = FlowPalette.Danger
        )
    } else {
        darkColorScheme(
            primary = FlowPalette.Mint,
            onPrimary = FlowPalette.OnAccent,
            background = FlowPalette.Background,
            onBackground = FlowPalette.Text,
            surface = FlowPalette.Surface,
            onSurface = FlowPalette.Text,
            surfaceVariant = FlowPalette.SurfaceRaised,
            onSurfaceVariant = FlowPalette.Muted,
            outline = FlowPalette.StrokeStrong,
            error = FlowPalette.Danger
        )
    }
    val view = LocalView.current
    SideEffect {
        view.context.findActivity()?.window?.let { window ->
            val controller = WindowCompat.getInsetsController(window, view)
            controller.isAppearanceLightStatusBars = light
            controller.isAppearanceLightNavigationBars = light
        }
    }
    MaterialTheme(colorScheme = scheme, content = content)
}

@Composable
fun FlowBackdrop(
    modifier: Modifier = Modifier,
    accent: Color = FlowPalette.Mint,
    content: @Composable BoxScope.() -> Unit
) {
    Box(modifier.fillMaxSize().background(FlowPalette.Background)) {
        Canvas(Modifier.fillMaxSize()) {
            drawRect(
                Brush.radialGradient(
                    colors = listOf(accent.copy(alpha = if (FlowAppearance.isLight) 0.075f else 0.105f), Color.Transparent),
                    center = Offset(size.width * 0.88f, size.height * 0.04f),
                    radius = size.minDimension * 1.08f
                )
            )
            drawRect(
                Brush.radialGradient(
                    colors = listOf(
                        (if (FlowAppearance.isLight) Color(0xFF8CC8D4) else Color(0xFF274C58)).copy(alpha = if (FlowAppearance.isLight) 0.07f else 0.08f),
                        Color.Transparent
                    ),
                    center = Offset(size.width * 0.05f, size.height * 0.56f),
                    radius = size.minDimension * 0.92f
                )
            )
        }
        content()
    }
}

@Composable
fun FlowBrand(modifier: Modifier = Modifier, compact: Boolean = false) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        val markShape = RoundedCornerShape(if (compact) 10.dp else 13.dp)
        Box(
            Modifier
                .size(if (compact) 32.dp else 40.dp)
                .clip(markShape)
                .background(
                    Brush.linearGradient(
                        if (FlowAppearance.isLight) listOf(Color(0xFFE3F7F2), Color(0xFFF7FBFA))
                        else listOf(Color(0xFF17332E), Color(0xFF0D1B19))
                    )
                )
                .border(1.dp, FlowPalette.Mint.copy(alpha = 0.28f), markShape),
            contentAlignment = Alignment.Center
        ) {
            Image(
                painter = painterResource(R.drawable.ic_flow_mark),
                contentDescription = null,
                modifier = Modifier.size(if (compact) 24.dp else 30.dp)
            )
        }
        if (!compact) {
            Column {
                Text("Flow", color = FlowPalette.Text, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                Text("SCHOOL · UNIVERSITY", color = FlowPalette.Mint, fontSize = 8.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.25.sp)
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
        if (focused) FlowPalette.Mint.copy(alpha = 0.62f) else FlowPalette.Stroke.copy(alpha = 0.86f),
        tween(160),
        label = "flow-input-border"
    )
    val fillTop by animateColorAsState(
        if (focused) {
            if (FlowAppearance.isLight) Color(0xFFF4FBF9) else Color(0xFF182421)
        } else FlowPalette.InputTop,
        tween(160),
        label = "flow-input-fill"
    )
    val shape = RoundedCornerShape(18.dp)

    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        textStyle = TextStyle(color = FlowPalette.Text, fontSize = 15.sp, lineHeight = 21.sp, fontWeight = FontWeight.Medium),
        cursorBrush = SolidColor(FlowPalette.Mint),
        singleLine = singleLine,
        keyboardOptions = keyboardOptions,
        visualTransformation = visualTransformation,
        interactionSource = interaction,
        decorationBox = { inner ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 56.dp)
                    .clip(shape)
                    .background(Brush.verticalGradient(listOf(fillTop, FlowPalette.SurfaceSoft)))
                    .border(1.dp, borderColor, shape)
                    .padding(horizontal = 16.dp, vertical = 15.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(11.dp)
            ) {
                if (leading != null) {
                    Box(
                        Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(9.dp))
                            .background(if (focused) FlowPalette.Mint.copy(alpha = 0.12f) else Color.Transparent),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(leading, color = if (focused) FlowPalette.Mint else FlowPalette.Dim, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                }
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty()) Text(placeholder, color = FlowPalette.Dim, fontSize = 14.sp)
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
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.985f else 1f, tween(90), label = "flow-primary-press")
    val shape = RoundedCornerShape(17.dp)
    Box(
        modifier
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .heightIn(min = 54.dp)
            .clip(shape)
            .background(
                if (enabled) Brush.linearGradient(listOf(FlowPalette.MintBright, FlowPalette.Mint))
                else Brush.linearGradient(listOf(FlowPalette.Stroke, FlowPalette.Stroke))
            )
            .clickable(interactionSource = interaction, indication = null, enabled = enabled, onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 15.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = if (enabled) FlowPalette.OnAccent else FlowPalette.Dim, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, letterSpacing = 0.1.sp)
    }
}

@Composable
fun FlowSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    danger: Boolean = false
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.987f else 1f, tween(90), label = "flow-secondary-press")
    val tint = if (danger) FlowPalette.Danger else FlowPalette.Text
    val shape = RoundedCornerShape(16.dp)
    Box(
        modifier
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .heightIn(min = 49.dp)
            .clip(shape)
            .background(Brush.verticalGradient(listOf(FlowPalette.SecondaryTop, FlowPalette.SecondaryBottom)))
            .border(1.dp, if (danger) FlowPalette.Danger.copy(alpha = 0.28f) else FlowPalette.Stroke, shape)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = tint, fontWeight = FontWeight.Bold, fontSize = 13.sp)
    }
}

@Composable
fun FlowCard(
    modifier: Modifier = Modifier,
    accent: Boolean = false,
    onClick: (() -> Unit)? = null,
    accentColor: Color = FlowPalette.Mint,
    content: @Composable () -> Unit
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed && onClick != null) 0.991f else 1f, tween(100), label = "flow-card-press")
    val shape = RoundedCornerShape(23.dp)
    val top = if (accent) accentColor.copy(alpha = if (FlowAppearance.isLight) 0.08f else 0.15f).compositeOver(FlowPalette.CardTop) else FlowPalette.CardTop
    val bottom = FlowPalette.CardBottom
    var base = modifier
        .graphicsLayer { scaleX = scale; scaleY = scale }
        .clip(shape)
        .background(Brush.verticalGradient(listOf(top, bottom)))
        .border(1.dp, if (accent) accentColor.copy(alpha = 0.25f) else FlowPalette.Stroke.copy(alpha = 0.82f), shape)
    if (onClick != null) base = base.clickable(interactionSource = interaction, indication = null, onClick = onClick)
    Box(base) { content() }
}

@Composable
fun FlowPill(
    text: String,
    color: Color = FlowPalette.Mint,
    modifier: Modifier = Modifier
) {
    Box(
        modifier
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = if (FlowAppearance.isLight) 0.08f else 0.105f))
            .border(1.dp, color.copy(alpha = 0.2f), RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Text(text, color = color, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.65.sp)
    }
}

@Composable
fun FlowSectionTitle(kicker: String, title: String, trailing: String? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.SpaceBetween) {
        Column {
            Text(kicker.uppercase(), color = FlowPalette.Mint, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.45.sp)
            Spacer(Modifier.height(5.dp))
            Text(title, color = FlowPalette.Text, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.25).sp)
        }
        if (trailing != null) Text(trailing, color = FlowPalette.Muted, fontSize = 11.sp, modifier = Modifier.alpha(0.9f))
    }
}

private fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

private fun Color.compositeOver(background: Color): Color {
    val sourceAlpha = alpha
    if (sourceAlpha <= 0f) return background
    val outA = sourceAlpha + background.alpha * (1f - sourceAlpha)
    if (outA <= 0f) return Color.Transparent
    return Color(
        red = (red * sourceAlpha + background.red * background.alpha * (1f - sourceAlpha)) / outA,
        green = (green * sourceAlpha + background.green * background.alpha * (1f - sourceAlpha)) / outA,
        blue = (blue * sourceAlpha + background.blue * background.alpha * (1f - sourceAlpha)) / outA,
        alpha = outA
    )
}
